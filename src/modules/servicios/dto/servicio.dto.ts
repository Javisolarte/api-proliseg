import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsNumber, IsBoolean } from "class-validator";

export class CreateServicioDto {
  @ApiProperty({ example: "Vigilancia 24/7", description: "Nombre del servicio" })
  @IsString()
  nombre: string;

  @ApiProperty({ example: "Vigilancia", description: "Categoría del servicio", required: false })
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiProperty({ example: "Cobertura de seguridad durante el día", required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: "12h diurna", required: false })
  @IsOptional()
  @IsString()
  modalidad?: string;

  @ApiProperty({ example: 1200000, required: false })
  @IsOptional()
  @IsNumber()
  valor_base?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ example: 5, description: "ID del usuario que crea el servicio", required: false })
  @IsOptional()
  @IsNumber()
  creado_por?: number;
}

export class UpdateServicioDto extends CreateServicioDto {}
