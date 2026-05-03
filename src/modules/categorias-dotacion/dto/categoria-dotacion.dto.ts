import { IsNotEmpty, IsOptional, IsString, IsNumber, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoriaDotacionDto {
    @ApiProperty({ description: 'Nombre de la categoría', example: 'Uniformes' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ description: 'Descripción de la categoría', example: 'Ropa de trabajo para guardas', required: false })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiProperty({ description: 'ID de la plantilla para el acta', required: false })
    @IsNumber()
    @IsOptional()
    plantilla_acta_id?: number;

    @ApiProperty({ description: 'ID de la plantilla para el reporte', required: false })
    @IsNumber()
    @IsOptional()
    plantilla_reporte_id?: number;

    @ApiProperty({ description: 'Tipo de destinatario por defecto', enum: ['empleado', 'puesto', 'cliente'], required: false })
    @IsString()
    @IsOptional()
    @IsIn(['empleado', 'puesto', 'cliente'])
    tipo_destinatario_default?: string;
}

export class UpdateCategoriaDotacionDto {
    @ApiProperty({ description: 'Nombre de la categoría', example: 'Uniformes', required: false })
    @IsString()
    @IsOptional()
    nombre?: string;

    @ApiProperty({ description: 'Descripción de la categoría', example: 'Ropa de trabajo para guardas', required: false })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiProperty({ description: 'ID de la plantilla para el acta', required: false })
    @IsNumber()
    @IsOptional()
    plantilla_acta_id?: number;

    @ApiProperty({ description: 'ID de la plantilla para el reporte', required: false })
    @IsNumber()
    @IsOptional()
    plantilla_reporte_id?: number;

    @ApiProperty({ description: 'Tipo de destinatario por defecto', enum: ['empleado', 'puesto', 'cliente'], required: false })
    @IsString()
    @IsOptional()
    @IsIn(['empleado', 'puesto', 'cliente'])
    tipo_destinatario_default?: string;
}
