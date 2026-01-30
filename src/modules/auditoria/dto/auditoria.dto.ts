import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsString, IsOptional, IsJSON, IsIP, IsDate, IsEnum } from "class-validator";
import { Transform, Type } from "class-transformer";

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

export class AuditoriaQueryDto {
    @ApiProperty({ required: false, example: "2024-01-01" })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    desde?: Date;

    @ApiProperty({ required: false, example: "2024-12-31" })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    hasta?: Date;

    @ApiProperty({ required: false, example: 1 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    usuario_id?: number;

    @ApiProperty({ required: false, example: "INSERT" })
    @IsOptional()
    @IsString()
    accion?: string;

    @ApiProperty({ required: false, example: "empleados" })
    @IsOptional()
    @IsString()
    tabla?: string;

    @ApiProperty({ required: false, example: 100, default: 100 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    limit?: number = 100;

    @ApiProperty({ required: false, example: 0, default: 0 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    offset?: number = 0;
}
