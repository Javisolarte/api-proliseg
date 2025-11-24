import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsString, IsOptional, IsJSON, IsIP } from "class-validator";
import { Transform } from "class-transformer";

export class CreateAuditoriaDto {
    @ApiProperty({ example: "empleados" })
    @IsString()
    tabla_afectada: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    registro_id: number;

    @ApiProperty({ example: "INSERT" })
    @IsString()
    accion: string;

    @ApiProperty({ example: {}, required: false })
    @IsOptional()
    @IsJSON()
    datos_anteriores?: any;

    @ApiProperty({ example: {}, required: false })
    @IsOptional()
    @IsJSON()
    datos_nuevos?: any;

    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    usuario_id?: number;

    @ApiProperty({ example: "192.168.1.1", required: false })
    @IsOptional()
    @IsIP()
    ip_address?: string;

    @ApiProperty({ example: "Mozilla/5.0...", required: false })
    @IsOptional()
    @IsString()
    user_agent?: string;
}

export class UpdateAuditoriaDto extends PartialType(CreateAuditoriaDto) { }
