import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional } from "class-validator";

export class CreateEpsDto {
  @ApiProperty({ example: "EPS Salud Total" })
  @IsString()
  nombre: string;

  @ApiProperty({ example: "EPS001", required: false })
  @IsOptional()
  @IsString()
  codigo?: string;
}

export class UpdateEpsDto extends PartialType(CreateEpsDto) {}
