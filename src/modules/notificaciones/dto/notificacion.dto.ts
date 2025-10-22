import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsBoolean } from "class-validator";

export class CreateNotificacionDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  para_usuario_id: number;

  @ApiProperty({ example: "Se ha asignado un nuevo turno" })
  @IsString()
  mensaje: string;

  @ApiProperty({ example: "sistema", required: false })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  leido?: boolean;

  @ApiProperty({ example: "alerta", required: false })
  @IsOptional()
  @IsString()
  categoria?: string;
}

export class UpdateNotificacionDto extends PartialType(CreateNotificacionDto) {}
