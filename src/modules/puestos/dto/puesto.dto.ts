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
    example: 1,
    required: false,
    description: "ID del puesto padre (para jerarquías de puestos)",
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
    example: false,
    required: false,
    description: "Indica si el puesto tiene armas",
  })
  @IsOptional()
  @IsBoolean()
  tiene_arma?: boolean;

  @ApiProperty({
    example: 0,
    required: false,
    description: "Cantidad de armas en el puesto",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  cantidad_armas?: number;

  @ApiProperty({
    example: false,
    required: false,
    description: "Indica si el puesto tiene CCTV",
  })
  @IsOptional()
  @IsBoolean()
  tiene_cctv?: boolean;

  @ApiProperty({
    example: 0,
    required: false,
    description: "Cantidad de cámaras de CCTV",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  cantidad_camaras?: number;
}

export class UpdatePuestoDto extends PartialType(CreatePuestoDto) { }
