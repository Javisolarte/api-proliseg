import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';

@Injectable()
export class ExportService {
    private readonly logger = new Logger(ExportService.name);

    async exportToExcel(data: any[], headers: string[], filename: string, res: Response) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Datos');

        // Add headers
        worksheet.addRow(headers);

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1976D2' },
        };
        worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

        // Add data rows
        data.forEach(item => {
            const row = headers.map(header => {
                const key = header.toLowerCase().replace(/ /g, '_');
                return item[key] || '';
            });
            worksheet.addRow(row);
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            if (column && column.eachCell) {
                column.eachCell({ includeEmpty: true }, cell => {
                    const cellLength = cell.value ? cell.value.toString().length : 10;
                    if (cellLength > maxLength) {
                        maxLength = cellLength;
                    }
                });
                column.width = Math.min(maxLength + 2, 50);
            }
        });

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
        res.send(buffer);
    }

    async exportToCSV(data: any[], headers: string[], filename: string, res: Response) {
        const csvRows: string[] = [];

        // Add headers
        csvRows.push(headers.join(','));

        // Add data
        data.forEach(item => {
            const values = headers.map(header => {
                const key = header.toLowerCase().replace(/ /g, '_');
                const value = item[key] || '';
                // Escape commas and quotes
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });

        const csvContent = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
        res.send('\uFEFF' + csvContent); // UTF-8 BOM
    }

    async exportToPDF(data: any[], headers: string[], filename: string, res: Response) {
        // TODO: Implement PDF generation using pdfkit or puppeteer
        // Por ahora retornar un placeholder
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);

        doc.pipe(res);

        doc.fontSize(20).text(`Reporte: ${filename}`, 50, 50);
        doc.fontSize(12).text(`Total de registros: ${data.length}`, 50, 100);

        // TODO: Add table with data
        // This is a basic implementation
        let y = 150;
        headers.forEach((header, index) => {
            doc.text(header, 50 + (index * 100), y);
        });

        y += 30;
        data.slice(0, 20).forEach(item => {
            headers.forEach((header, index) => {
                const key = header.toLowerCase().replace(/ /g, '_');
                doc.text(String(item[key] || '').slice(0, 15), 50 + (index * 100), y);
            });
            y += 20;
        });

        doc.end();
    }
}
