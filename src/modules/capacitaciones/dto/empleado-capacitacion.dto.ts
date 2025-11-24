import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsString, IsOptional, IsBoolean, IsDateString, IsNumber } from "class-validator";
import { Transform } from "class-transformer";

export class CreateEmpleadoCapacitacionDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    empleado_id: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    capacitacion_id: number;

    @ApiProperty({ example: "2023-10-27", required: false })
    @IsOptional()
    @IsDateString()
    fecha_realizacion?: string;

    @ApiProperty({ example: "2024-10-27", required: false })
    @IsOptional()
    @IsDateString()
    fecha_vencimiento?: string;

    @ApiProperty({ example: "https://example.com/certificado.pdf", required: false })
    @IsOptional()
    @IsString()
    certificado_url?: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    aprobado?: boolean;

    @ApiProperty({ example: 95.5, required: false })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    puntuacion?: number;

    @ApiProperty({ example: "Instructor Name", required: false })
    @IsOptional()
    @IsString()
    instructor?: string;
}

export class UpdateEmpleadoCapacitacionDto extends PartialType(CreateEmpleadoCapacitacionDto) { }
