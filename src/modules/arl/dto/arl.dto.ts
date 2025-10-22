import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional } from "class-validator";

export class CreateArlDto {
  @ApiProperty({ example: "ARL SURA" })
  @IsString()
  nombre: string;

  @ApiProperty({ example: "ARL001", required: false })
  @IsOptional()
  @IsString()
  codigo?: string;
}

export class UpdateArlDto extends PartialType(CreateArlDto) {}
