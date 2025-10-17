import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsBoolean, IsOptional } from "class-validator";

export class AsignarPermisoDto {
  @ApiProperty({ example: 12, description: "ID del usuario externo" })
  @IsNumber()
  usuario_id: number;

  @ApiProperty({ example: 3, description: "ID del módulo" })
  @IsNumber()
  modulo_id: number;

  @ApiProperty({ example: true, description: "Si el permiso está concedido", required: false })
  @IsOptional()
  @IsBoolean()
  concedido?: boolean = true;
}

export class ActualizarPermisoDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  concedido: boolean;
}
