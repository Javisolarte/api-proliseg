import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean, IsArray, ValidateNested, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ==========================================
// CHECKLISTS GRANULARES (NUEVO)
// ==========================================

export class TipoChequeoItemDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 1 })
    tipo_chequeo_id: number;

    @ApiProperty({ example: '¿Vigilante porta carnet?' })
    pregunta: string;

    @ApiProperty({ example: 'Verificar carnet físico' })
    descripcion: string;

    @ApiProperty({ example: true })
    obligatorio: boolean;

    @ApiProperty({ example: 1 })
    orden: number;
}

export class RespuestaCheckItemDto {
    @ApiProperty({ example: 1, description: 'ID del ítem (pregunta)' })
    @IsNotEmpty()
    @IsNumber()
    item_id: number;

    @ApiProperty({ example: 'cumple', description: 'Resultado: cumple, no_cumple, na' })
    @IsNotEmpty()
    @IsString()
    resultado: string;

    @ApiPropertyOptional({ example: 'Carnet vencido', description: 'Observación por ítem' })
    @IsOptional()
    @IsString()
    observacion?: string;
}

export class ChecklistResponseDto {
    @ApiProperty({ example: 1, description: 'ID de la categoría' })
    tipo_chequeo_id: number;

    @ApiProperty({ example: 'Supervisión Nocturna' })
    nombre: string;

    @ApiProperty({ type: [TipoChequeoItemDto] })
    items: TipoChequeoItemDto[];
}

// ==========================================
// MI RUTA ASIGNADA
// ==========================================

export class MiRutaAsignadaResponseDto {
    @ApiProperty({ example: 1, description: 'ID de la asignación' })
    asignacion_id: number;

    @ApiProperty({ example: 3, description: 'ID de la ruta' })
    ruta_id: number;

    @ApiProperty({ example: 'RUTA DIA', description: 'Nombre de la ruta' })
    ruta_nombre: string;

    @ApiProperty({ example: 'Supervisión zona norte', description: 'Descripción de la ruta' })
    ruta_descripcion: string;

    @ApiProperty({ example: '2026-01-15', description: 'Fecha del turno' })
    fecha: string;

    @ApiProperty({ example: '06:00:00', description: 'Hora inicio turno' })
    hora_inicio: string;

    @ApiProperty({ example: '18:00:00', description: 'Hora fin turno' })
    hora_fin: string;

    @ApiProperty({ example: 'DIA', description: 'Tipo de turno' })
    tipo_turno: string;

    @ApiProperty({ example: 2, description: 'ID del vehículo asignado' })
    vehiculo_id: number;

    @ApiProperty({ example: 'ABC123', description: 'Placa del vehículo' })
    vehiculo_placa: string;

    @ApiProperty({ example: 'moto', description: 'Tipo de vehículo' })
    vehiculo_tipo: string;

    @ApiProperty({
        type: 'array',
        description: 'Lista de puntos a visitar',
        example: [
            {
                punto_id: 1,
                puesto_id: 10,
                puesto_nombre: 'PUESTO CENTRO',
                orden: 1,
                radio_metros: 50,
                latitud: 1.2136,
                longitud: -77.2811,
                visitado: false
            }
        ]
    })
    puntos: Array<{
        punto_id: number;
        puesto_id: number;
        puesto_nombre: string;
        orden: number;
        radio_metros: number;
        latitud: number;
        longitud: number;
        visitado: boolean;
    }>;

    @ApiPropertyOptional({ example: 100, description: 'ID de ejecución actual (si existe)' })
    ejecucion_id?: number;

    @ApiPropertyOptional({ example: 'en_progreso', description: 'Estado de la ejecución' })
    estado_ejecucion?: string;

    @ApiPropertyOptional({ example: '2026-01-15T06:05:00Z', description: 'Fecha inicio ejecución' })
    fecha_inicio_ejecucion?: string;
}

// ==========================================
// INICIAR SUPERVISIÓN
// ==========================================

export class IniciarSupervisionDto {
    @ApiProperty({ example: 1, description: 'ID de la asignación de ruta' })
    @IsNotEmpty()
    @IsNumber()
    asignacion_id: number;

    @ApiPropertyOptional({ example: 2, description: 'ID del vehículo (opcional si ya está en asignación)' })
    @IsOptional()
    @IsNumber()
    vehiculo_id?: number;

    @ApiPropertyOptional({ example: 1.2136, description: 'Latitud de inicio' })
    @IsOptional()
    @IsNumber()
    latitud_inicio?: number;

    @ApiPropertyOptional({ example: -77.2811, description: 'Longitud de inicio' })
    @IsOptional()
    @IsNumber()
    longitud_inicio?: number;
}

export class IniciarSupervisionResponseDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución creada' })
    ejecucion_id: number;

    @ApiProperty({ example: 'en_progreso', description: 'Estado de la ejecución' })
    estado: string;

    @ApiProperty({ example: '2026-01-15T06:05:00Z', description: 'Fecha y hora de inicio' })
    fecha_inicio: string;

    @ApiProperty({ example: 'Supervisión iniciada correctamente' })
    mensaje: string;
}

// ==========================================
// REGISTRAR UBICACIÓN (GPS TRACKING)
// ==========================================

export class RegistrarUbicacionDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    @IsNotEmpty()
    @IsNumber()
    ejecucion_id: number;

    @ApiProperty({ example: 1.2136, description: 'Latitud' })
    @IsNotEmpty()
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -77.2811, description: 'Longitud' })
    @IsNotEmpty()
    @IsNumber()
    longitud: number;

    @ApiPropertyOptional({ example: 10, description: 'Precisión en metros' })
    @IsOptional()
    @IsNumber()
    precision?: number;

    @ApiPropertyOptional({ example: 'gps', description: 'Tipo de evento' })
    @IsOptional()
    @IsString()
    tipo_evento?: string; // 'gps', 'llegada', 'salida', 'detencion'

    @ApiPropertyOptional({ example: 'Punto de control', description: 'Observación' })
    @IsOptional()
    @IsString()
    observacion?: string;
}

// ==========================================
// VALIDAR LLEGADA A PUESTO
// ==========================================

export class ValidarLlegadaPuestoDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    @IsNotEmpty()
    @IsNumber()
    ejecucion_id: number;

    @ApiProperty({ example: 10, description: 'ID del puesto' })
    @IsNotEmpty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty({ example: 1.2136, description: 'Latitud actual' })
    @IsNotEmpty()
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -77.2811, description: 'Longitud actual' })
    @IsNotEmpty()
    @IsNumber()
    longitud: number;
}

export class ValidarLlegadaResponseDto {
    @ApiProperty({ example: true, description: 'Si está dentro del radio permitido' })
    dentro_radio: boolean;

    @ApiProperty({ example: 25.5, description: 'Distancia en metros al puesto' })
    distancia_metros: number;

    @ApiProperty({ example: 50, description: 'Radio permitido en metros' })
    radio_permitido: number;

    @ApiProperty({ example: 10, description: 'ID del puesto' })
    puesto_id: number;

    @ApiProperty({ example: 'PUESTO CENTRO', description: 'Nombre del puesto' })
    puesto_nombre: string;

    @ApiProperty({ example: 'Dentro del radio permitido. Puede crear minuta.', description: 'Mensaje' })
    mensaje: string;

    @ApiPropertyOptional({ example: true, description: 'Si puede crear minuta' })
    puede_crear_minuta: boolean;
}

// ==========================================
// CREAR MINUTA DE RUTA
// ==========================================

export class CrearMinutaRutaDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    @IsNotEmpty()
    @IsNumber()
    ejecucion_id: number;

    @ApiProperty({ example: 10, description: 'ID del puesto visitado' })
    @IsNotEmpty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty({ example: 1, description: 'ID del tipo de chequeo' })
    @IsNotEmpty()
    @IsNumber()
    tipo_chequeo_id: number;

    @ApiProperty({ example: 'Personal en posición, instalaciones en buen estado', description: 'Detalle operativo' })
    @IsNotEmpty()
    @IsString()
    detalle_operativo: string;

    @ApiPropertyOptional({ example: 'Cambio de guardia sin novedades', description: 'Novedades' })
    @IsOptional()
    @IsString()
    novedades?: string;

    @ApiPropertyOptional({ example: 'Mejorar iluminación sector norte', description: 'Mejoras sugeridas' })
    @IsOptional()
    @IsString()
    mejoras_sugeridas?: string;

    @ApiPropertyOptional({
        type: 'array',
        example: ['https://bucket.com/foto1.jpg', 'https://bucket.com/foto2.jpg'],
        description: 'URLs de fotos evidencia'
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    fotos?: string[];

    @ApiPropertyOptional({
        type: 'array',
        example: ['https://bucket.com/audio1.mp3'],
        description: 'URLs de audios'
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    audios?: string[];

    @ApiPropertyOptional({ example: 1.2136, description: 'Latitud donde se crea minuta' })
    @IsOptional()
    @IsNumber()
    latitud?: number;

    @ApiPropertyOptional({ example: -77.2811, description: 'Longitud donde se crea minuta' })
    @IsOptional()
    @IsNumber()
    longitud?: number;

    @ApiPropertyOptional({
        type: [RespuestaCheckItemDto],
        description: 'Resultados del checklist granular (ítems Sí/No/NA)'
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RespuestaCheckItemDto)
    check_items?: RespuestaCheckItemDto[];
}

export class CrearMinutaRutaResponseDto {
    @ApiProperty({ example: 5, description: 'ID de la minuta creada' })
    minuta_id: number;

    @ApiProperty({ example: 'Minuta creada correctamente' })
    mensaje: string;

    @ApiProperty({ example: '2026-01-15T08:30:00Z', description: 'Fecha de creación' })
    fecha_creacion: string;
}

// ==========================================
// FINALIZAR SUPERVISIÓN
// ==========================================

export class FinalizarSupervisionDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    @IsNotEmpty()
    @IsNumber()
    ejecucion_id: number;

    @ApiPropertyOptional({ example: 'Ruta completada sin novedades', description: 'Observaciones finales' })
    @IsOptional()
    @IsString()
    observaciones?: string;

    @ApiPropertyOptional({ example: 1.2136, description: 'Latitud de finalización' })
    @IsOptional()
    @IsNumber()
    latitud_fin?: number;

    @ApiPropertyOptional({ example: -77.2811, description: 'Longitud de finalización' })
    @IsOptional()
    @IsNumber()
    longitud_fin?: number;
}

export class FinalizarSupervisionResponseDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    ejecucion_id: number;

    @ApiProperty({ example: 'finalizada', description: 'Estado final' })
    estado: string;

    @ApiProperty({ example: '2026-01-15T06:05:00Z', description: 'Fecha de inicio' })
    fecha_inicio: string;

    @ApiProperty({ example: '2026-01-15T17:55:00Z', description: 'Fecha de fin' })
    fecha_fin: string;

    @ApiProperty({ example: 710, description: 'Duración total en minutos' })
    duracion_minutos: number;

    @ApiProperty({ example: '11h 50m', description: 'Duración formateada' })
    duracion_formateada: string;

    @ApiProperty({ example: 5, description: 'Total de puntos en la ruta' })
    total_puntos: number;

    @ApiProperty({ example: 5, description: 'Puntos visitados' })
    puntos_visitados: number;

    @ApiProperty({ example: 3, description: 'Minutas creadas' })
    minutas_creadas: number;

    @ApiProperty({ example: 'Supervisión finalizada correctamente' })
    mensaje: string;
}

// ==========================================
// CONSULTAR MI HISTORIAL
// ==========================================

export class ConsultarHistorialDto {
    @ApiPropertyOptional({ example: '2026-01-01', description: 'Fecha desde' })
    @IsOptional()
    @IsDateString()
    fecha_desde?: string;

    @ApiPropertyOptional({ example: '2026-01-31', description: 'Fecha hasta' })
    @IsOptional()
    @IsDateString()
    fecha_hasta?: string;

    @ApiPropertyOptional({ example: 'finalizada', description: 'Filtrar por estado' })
    @IsOptional()
    @IsString()
    estado?: string;

    @ApiPropertyOptional({ example: 10, description: 'Límite de resultados' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number;
}

export class HistorialEjecucionDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    ejecucion_id: number;

    @ApiProperty({ example: 'RUTA DIA', description: 'Nombre de la ruta' })
    ruta_nombre: string;

    @ApiProperty({ example: '2026-01-15', description: 'Fecha' })
    fecha: string;

    @ApiProperty({ example: '06:05:00', description: 'Hora de inicio' })
    hora_inicio: string;

    @ApiProperty({ example: '17:55:00', description: 'Hora de fin' })
    hora_fin: string;

    @ApiProperty({ example: 'finalizada', description: 'Estado' })
    estado: string;

    @ApiProperty({ example: '11h 50m', description: 'Duración' })
    duracion: string;

    @ApiProperty({ example: 5, description: 'Puntos visitados' })
    puntos_visitados: number;

    @ApiProperty({ example: 3, description: 'Minutas creadas' })
    minutas_creadas: number;
}

// ==========================================
// REPORTE DE RUTA
// ==========================================

export class ReporteRutaDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    ejecucion_id: number;

    @ApiProperty({ example: 'RUTA DIA', description: 'Nombre de la ruta' })
    ruta_nombre: string;

    @ApiProperty({ example: 'JUAN PEREZ', description: 'Supervisor' })
    supervisor_nombre: string;

    @ApiProperty({ example: 'ABC123', description: 'Vehículo' })
    vehiculo_placa: string;

    @ApiProperty({ example: '2026-01-15', description: 'Fecha' })
    fecha: string;

    @ApiProperty({ example: '06:05:00', description: 'Hora inicio' })
    hora_inicio: string;

    @ApiProperty({ example: '17:55:00', description: 'Hora fin' })
    hora_fin: string;

    @ApiProperty({ example: '11h 50m', description: 'Duración total' })
    duracion_total: string;

    @ApiProperty({
        type: 'array',
        description: 'Detalles de puntos visitados',
        example: [{
            puesto_nombre: 'PUESTO CENTRO',
            hora_llegada: '06:10:00',
            hora_salida: '06:15:00',
            minuta_creada: true,
            novedades: 'Sin novedades'
        }]
    })
    puntos: Array<{
        puesto_nombre: string;
        hora_llegada: string;
        hora_salida: string;
        minuta_creada: boolean;
        novedades: string;
    }>;

    @ApiProperty({
        type: 'array',
        description: 'Mapa de recorrido (coordenadas GPS)',
        example: [{
            lat: 1.2136,
            lng: -77.2811,
            timestamp: '2026-01-15T06:10:00Z'
        }]
    })
    mapa_recorrido: Array<{
        lat: number;
        lng: number;
        timestamp: string;
    }>;

    @ApiProperty({ example: 150, description: 'Distancia total recorrida en km' })
    distancia_total_km: number;

    @ApiProperty({ example: 'finalizada', description: 'Estado' })
    estado: string;
}

// ==========================================
// VISITAS A PUESTOS
// ==========================================

export class IniciarVisitaDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    @IsNotEmpty()
    @IsNumber()
    ejecucion_id: number;

    @ApiProperty({ example: 10, description: 'ID del puesto' })
    @IsNotEmpty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty({ example: 1.2136, description: 'Latitud de llegada' })
    @IsNotEmpty()
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -77.2811, description: 'Longitud de llegada' })
    @IsNotEmpty()
    @IsNumber()
    longitud: number;
}

export class FinalizarVisitaDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    @IsNotEmpty()
    @IsNumber()
    ejecucion_id: number;

    @ApiProperty({ example: 10, description: 'ID del puesto' })
    @IsNotEmpty()
    @IsNumber()
    puesto_id: number;

    @ApiPropertyOptional({ example: 1.2136, description: 'Latitud de salida' })
    @IsOptional()
    @IsNumber()
    latitud?: number;

    @ApiPropertyOptional({ example: -77.2811, description: 'Longitud de salida' })
    @IsOptional()
    @IsNumber()
    longitud?: number;
}

// ==========================================
// REGISTRAR CHECKEO / REVISIÓN
// ==========================================

export class RegistrarCheckeoDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución' })
    @IsNotEmpty()
    @IsNumber()
    ejecucion_id: number;

    @ApiProperty({ example: 10, description: 'ID del puesto' })
    @IsNotEmpty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty({ example: 1, description: 'ID del tipo de chequeo' })
    @IsNotEmpty()
    @IsNumber()
    tipo_chequeo_id: number;

    @ApiProperty({ example: 'Satisctorio', description: 'Resultado' })
    @IsNotEmpty()
    @IsString()
    resultado: string;

    @ApiPropertyOptional({ example: 'Todo en orden', description: 'Observaciones' })
    @IsOptional()
    @IsString()
    observaciones?: string;
}

// ==========================================
// CARGAR EVIDENCIA
// ==========================================

export class CargarEvidenciaDto {
    @ApiProperty({ example: 100, description: 'ID de la ejecución o minuta' })
    @IsNotEmpty()
    @IsNumber()
    referencia_id: number;

    @ApiProperty({ example: 'minuta', description: 'Tipo de referencia (minuta/ejecucion)' })
    @IsNotEmpty()
    @IsString()
    tipo_referencia: string;

    @ApiProperty({ example: 'https://cdn.com/foto.jpg', description: 'URL de la evidencia' })
    @IsNotEmpty()
    @IsString()
    url: string;

    @ApiProperty({ example: 'foto', description: 'Tipo de archivo (foto/audio/video)' })
    @IsNotEmpty()
    @IsString()
    tipo_archivo: string;
}

// ==========================================
// RESPUESTAS ESPECIALIZADAS
// ==========================================

export class UbicacionActualResponseDto {
    @ApiProperty({ example: 1.2136 })
    latitud: number;
    @ApiProperty({ example: -77.2811 })
    longitud: number;
    @ApiProperty({ example: '2026-01-15T10:30:00Z' })
    fecha: string;
    @ApiProperty({ example: 'gps' })
    tipo_evento: string;
}

export class VehiculoAsignadoResponseDto {
    @ApiProperty({ example: 2 })
    id: number;
    @ApiProperty({ example: 'ABC123' })
    placa: string;
    @ApiProperty({ example: 'moto' })
    tipo: string;
    @ApiProperty({ example: 'Honda' })
    marca: string;
    @ApiProperty({ example: 'XRE 300' })
    modelo: string;
}

// ==========================================
// TIPOS DE CHEQUEO
// ==========================================

export class TipoChequeoDto {
    @ApiProperty({ example: 1, description: 'ID del tipo de chequeo' })
    id: number;

    @ApiProperty({ example: 'Revisión de Personal', description: 'Nombre' })
    nombre: string;

    @ApiProperty({ example: 'Verificación de asistencia y estado del personal', description: 'Descripción' })
    descripcion: string;

    @ApiProperty({ example: true, description: 'Si está activo' })
    activo: boolean;
}// ==========================================
// HEARTBEAT / ESTADO
// ==========================================

export class HeartbeatDto {
    @ApiProperty({ example: 85, description: 'Nivel de batería (0-100)' })
    @IsNumber()
    @Min(0)
    @Max(100)
    bateria: number;

    @ApiProperty({ example: '4G', description: 'Tipo de red' })
    @IsString()
    red: string;

    @ApiProperty({ example: 1.2136 })
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -77.2811 })
    @IsNumber()
    longitud: number;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    en_movimiento?: boolean;
}

// ==========================================
// SINCRONIZACIÓN OFFLINE
// ==========================================

export class SyncDataDto {
    @ApiProperty({ type: [RegistrarUbicacionDto], description: 'GPS pendientes' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RegistrarUbicacionDto)
    gps: RegistrarUbicacionDto[];

    @ApiProperty({ type: [IniciarVisitaDto], description: 'Visitas pendientes' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IniciarVisitaDto)
    visitas: IniciarVisitaDto[];

    @ApiProperty({ type: [CrearMinutaRutaDto], description: 'Minutas pendientes' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CrearMinutaRutaDto)
    minutas: CrearMinutaRutaDto[];

    @ApiProperty({ type: [CargarEvidenciaDto], description: 'Evidencias en cola' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CargarEvidenciaDto)
    evidencias: CargarEvidenciaDto[];
}

// ==========================================
// PAUSAR / REANUDAR RUTA
// ==========================================

export class PausarReanudarRutaDto {
    @ApiProperty({ example: 100 })
    @IsNumber()
    ejecucion_id: number;

    @ApiPropertyOptional({ example: 'Hora de almuerzo' })
    @IsOptional()
    @IsString()
    motivo?: string;

    @ApiProperty({ example: 1.2136 })
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -77.2811 })
    @IsNumber()
    longitud: number;
}

// ==========================================
// REPORTAR NOVEDAD INMEDIATA
// ==========================================

export class ReportarNovedadDto {
    @ApiProperty({ example: 'Accidente de tránsito', description: 'Tipo de novedad' })
    @IsString()
    tipo_novedad: string;

    @ApiProperty({ example: 'Colisión menor en vía principal' })
    @IsString()
    descripcion: string;

    @ApiProperty({ example: 1.2136 })
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -77.2811 })
    @IsNumber()
    longitud: number;

    @ApiPropertyOptional({ type: [String], example: ['url1', 'url2'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    fotos?: string[];

    @ApiPropertyOptional({ example: 100, description: 'ID de ejecución si aplica' })
    @IsOptional()
    @IsNumber()
    ejecucion_id?: number;
}

// ==========================================
// CONFIRMACIÓN DE RECEPCIÓN (ACK)
// ==========================================

export class ConfirmacionAckDto {
    @ApiProperty({ example: [1, 2, 3], description: 'IDs de eventos confirmados' })
    @IsArray()
    @IsNumber({}, { each: true })
    eventos_ids: number[];

    @ApiProperty({ example: [10, 11], description: 'IDs de minutas confirmadas' })
    @IsArray()
    @IsNumber({}, { each: true })
    minutas_ids: number[];
}

// ==========================================
// ESTADO DEL DISPOSITIVO
// ==========================================

export class DispositivoInfoDto {
    @ApiProperty({ example: 'Samsung' })
    @IsString()
    marca: string;

    @ApiProperty({ example: 'Galaxy S21' })
    @IsString()
    modelo: string;

    @ApiProperty({ example: 'Android 13' })
    @IsString()
    sistema_operativo: string;

    @ApiProperty({ example: '1.0.5' })
    @IsString()
    version_app: string;

    @ApiProperty({ example: 'uuid-unico-dispositivo' })
    @IsString()
    imei_o_uuid: string;
}

export class DeviceInfoResponseDto {
    @ApiProperty({ example: true })
    registrado: boolean;
    @ApiProperty({ example: 'Dispositivo verificado' })
    mensaje: string;
}

// ==========================================
// HORARIOS Y RUTAS ASIGNADAS (Calendario)
// ==========================================

export class MisHorariosResponseDto {
    @ApiProperty({ example: '2026-01-15' })
    fecha: string;
    @ApiProperty({ example: '06:00' })
    hora_inicio: string;
    @ApiProperty({ example: '18:00' })
    hora_fin: string;
    @ApiProperty({ example: 'diurno' })
    tipo_turno: string;
    @ApiProperty({ example: 'RUTA NORTE' })
    ruta_nombre: string;
    @ApiProperty({ example: 'ACTIVA' })
    estado: string;
}
