import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateVisitaPreliminarDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    cliente_potencial_id: string; // UUID

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    tipo_visitante: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    nombre_visitante: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    motivo_visita?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    fotos_evidencia_urls?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    estado?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    asignado_a?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    fecha_programada?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    hora_programada?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notas_programacion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    solicitado_por_tipo?: 'usuario' | 'cliente';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    solicitado_por_id?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    novedades?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    conclusion?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    notificar_por?: string[];

    // Inspección Física
    @ApiProperty({ required: false }) @IsOptional() @IsString() tipo_perimetro?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() estado_perimetro?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() vulnerabilidades_perimetro?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() iluminacion_exterior?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() iluminacion_interior?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() puntos_acceso_peatonal?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() puntos_acceso_vehicular?: number;

    // Inspección Tecnológica
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() tiene_cctv_actual?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsString() estado_cctv_actual?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() cantidad_camaras_sugeridas?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() tipo_camaras_sugeridas?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() tiene_control_acceso_actual?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() controles_acceso_sugeridos?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() tipo_control_acceso?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() tiene_alarma_actual?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() sistema_alarma_sugerido?: boolean;

    // Infraestructura
    @ApiProperty({ required: false }) @IsOptional() @IsString() red_electrica_estado?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() energia_respaldo?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsString() conexion_internet?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() proveedor_internet?: string;

    // Presupuesto
    @ApiProperty({ required: false }) @IsOptional() @IsString() nivel_riesgo_general?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() prioridad_instalacion?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() presupuesto_estimado?: number;
}

export class UpdateVisitaPreliminarDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() resultado_observaciones?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() estado?: string;
    @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) fotos_evidencia_urls?: string[];
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() documento_generado_id?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() novedades?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() conclusion?: string;

    // Doble Firma
    @ApiProperty({ required: false, description: 'Firma del técnico en Base64' }) @IsOptional() @IsString() firma_tecnico?: string;
    @ApiProperty({ required: false, description: 'Firma del cliente en Base64' }) @IsOptional() @IsString() firma_cliente?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() nombre_cliente_firma?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() cargo_cliente_firma?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() cedula_cliente_firma?: string;

    // Inspección Física
    @ApiProperty({ required: false }) @IsOptional() @IsString() tipo_perimetro?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() estado_perimetro?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() vulnerabilidades_perimetro?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() iluminacion_exterior?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() iluminacion_interior?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() puntos_acceso_peatonal?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() puntos_acceso_vehicular?: number;

    // Inspección Tecnológica
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() tiene_cctv_actual?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsString() estado_cctv_actual?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() cantidad_camaras_sugeridas?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() tipo_camaras_sugeridas?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() tiene_control_acceso_actual?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() controles_acceso_sugeridos?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() tipo_control_acceso?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() tiene_alarma_actual?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() sistema_alarma_sugerido?: boolean;

    // Infraestructura
    @ApiProperty({ required: false }) @IsOptional() @IsString() red_electrica_estado?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() energia_respaldo?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsString() conexion_internet?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() proveedor_internet?: string;

    // Presupuesto
    @ApiProperty({ required: false }) @IsOptional() @IsString() nivel_riesgo_general?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() prioridad_instalacion?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() presupuesto_estimado?: number;
}
