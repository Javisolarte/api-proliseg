import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional } from "class-validator";

export class CreateFondoPensionDto {
  @ApiProperty({ example: "Porvenir" })
  @IsString()
  nombre: string;

  @ApiProperty({ example: "FP001", required: false })
  @IsOptional()
  @IsString()
  codigo?: string;
}

export class UpdateFondoPensionDto extends PartialType(CreateFondoPensionDto) {}
