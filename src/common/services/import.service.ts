import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export interface ImportResult<T> {
    success: T[];
    errors: Array<{ row: number; errors: string[] }>;
    summary: {
        total: number;
        processed: number;
        failed: number;
    };
}

@Injectable()
export class ImportService {
    private readonly logger = new Logger(ImportService.name);

    /**
     * Procesa un buffer de Excel y lo valida contra un DTO
     * @param buffer El archivo en memoria
     * @param dtoClass La clase del DTO para validar (ej: CreateListasAccesoDto)
     * @param mapping Mapeo de columnas de Excel a llaves del DTO { "Nombre": "nombre", "Email": "email" }
     */
    async processExcel<T>(
        buffer: any,
        dtoClass: any,
        mapping: Record<string, string>
    ): Promise<ImportResult<T>> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
            throw new BadRequestException('El archivo Excel está vacío o no tiene hojas');
        }

        const results: T[] = [];
        const errors: Array<{ row: number; errors: string[] }> = [];
        const headers: string[] = [];

        // 1. Obtener cabeceras
        worksheet.getRow(1).eachCell((cell) => {
            headers.push(cell.text.trim());
        });

        // 2. Procesar filas
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Saltar cabecera

            const rowData: any = {};
            row.eachCell((cell, colNumber) => {
                const header = headers[colNumber - 1];
                const dtoKey = mapping[header];
                if (dtoKey) {
                    // Manejar diferentes tipos de celdas
                    if (cell.type === ExcelJS.ValueType.Formula) {
                        rowData[dtoKey] = cell.result;
                    } else {
                        rowData[dtoKey] = cell.value;
                    }
                }
            });

            results.push(rowData);
        });

        // 3. Validar cada objeto resultante
        const validatedResults: T[] = [];
        const finalErrors: Array<{ row: number; errors: string[] }> = [];

        for (let i = 0; i < results.length; i++) {
            const dtoInstance = plainToInstance(dtoClass, results[i]);
            const validationErrors = await validate(dtoInstance as object);

            if (validationErrors.length > 0) {
                finalErrors.push({
                    row: i + 2, // +2 porque saltamos cabecera y es 1-indexed
                    errors: validationErrors.map((e) => Object.values(e.constraints || {}).join(', ')),
                });
            } else {
                validatedResults.push(dtoInstance as T);
            }
        }

        return {
            success: validatedResults,
            errors: finalErrors,
            summary: {
                total: results.length,
                processed: validatedResults.length,
                failed: finalErrors.length,
            },
        };
    }
}
