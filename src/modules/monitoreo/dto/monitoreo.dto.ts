import { IsNumber, IsOptional, IsString, IsIn, IsNotEmpty } from 'class-validator';

export class RegistrarUbicacionDto {
    @IsNumber()
    latitud: number;

    @IsNumber()
    longitud: number;

    @IsOptional()
    @IsNumber()
    precision_metros?: number;

    @IsOptional()
    @IsNumber()
    velocidad?: number;

    @IsOptional()
    @IsNumber()
    bateria?: number;

    @IsOptional()
    @IsString()
    origen?: string = 'app';

    @IsOptional()
    @IsString()
    evento?: string;
}

export class DispararPanicoDto {
    @IsString()
    @IsNotEmpty()
    @IsIn(['empleado', 'cliente'])
    origen: 'empleado' | 'cliente';

    @IsOptional()
    @IsNumber()
    puesto_id?: number;

    @IsOptional()
    @IsNumber()
    latitud?: number;

    @IsOptional()
    @IsNumber()
    longitud?: number;

    @IsOptional()
    @IsNumber()
    precision_metros?: number;

    @IsOptional()
    @IsString()
    dispositivo?: string;

    @IsOptional()
    @IsString()
    version_app?: string;
}
