import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
  IsInt,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from "class-validator";

export class CreatePuestoDto {
  @ApiProperty({
    example: 1,
    description: "ID del contrato asociado al puesto",
  })
  @IsInt({ message: "El campo contrato_id debe ser un número entero" })
  contrato_id: number;

  @ApiProperty({
    example: "Puesto Central",
    description: "Nombre del puesto de trabajo",
  })
  @IsString({ message: "El campo nombre debe ser texto" })
  nombre: string;

  @ApiProperty({
    example: "Cra 10 #25-30, Cali",
    required: false,
    description: "Dirección del puesto",
  })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({
    example: "Cali",
    required: false,
    description: "Ciudad donde se encuentra el puesto",
  })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiProperty({
    example: 3.4516,
    required: false,
    description: "Latitud (coordenadas GPS)",
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ApiProperty({
    example: -76.5320,
    required: false,
    description: "Longitud (coordenadas GPS)",
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud?: number;

  @ApiProperty({
    example: 5,
    required: false,
    description: "Número de guardas asignados al puesto",
  })
  @IsOptional()
  @IsInt()
  numero_guardas?: number;

  @ApiProperty({
    example: 1,
    required: false,
    description: "ID del puesto padre (si es un subpuesto)",
  })
  @IsOptional()
  @IsInt()
  parent_id?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: "Estado activo del puesto",
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({
    example: 2,
    required: false,
    description: "Configuración de turnos asociada al puesto",
  })
  @IsOptional()
  @IsInt()
  configuracion_id?: number;
}

export class UpdatePuestoDto extends PartialType(CreatePuestoDto) {}
