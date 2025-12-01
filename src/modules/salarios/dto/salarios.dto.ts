import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, IsNumber } from "class-validator";
import { Transform } from "class-transformer";

export class CreateSalarioDto {
  @ApiProperty({ example: "Salario Básico Guardia", description: "Nombre descriptivo del salario" })
  @IsString()
  nombre_salario: string;

  @ApiProperty({ example: 1300000, description: "Valor del salario en pesos colombianos" })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  valor: number;
}

export class UpdateSalarioDto extends PartialType(CreateSalarioDto) {}
