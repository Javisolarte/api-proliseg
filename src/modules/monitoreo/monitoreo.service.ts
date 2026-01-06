import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RegistrarUbicacionDto, DispararPanicoDto } from './dto/monitoreo.dto';

@Injectable()
export class MonitoreoService {
    private readonly logger = new Logger(MonitoreoService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * ✅ Registrar ubicación periódica de un empleado
     */
    async registrarUbicacion(dto: RegistrarUbicacionDto, userId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener empleado_id por userId
        const { data: empleado, error: empError } = await supabase
            .from('empleados')
            .select('id')
            .eq('usuario_id', userId)
            .single();

        if (empError || !empleado) {
            throw new NotFoundException('Empleado no encontrado para este usuario');
        }

        // 2. Insertar ubicación
        const { data, error } = await supabase
            .from('empleado_ubicaciones')
            .insert({
                empleado_id: empleado.id,
                usuario_id: userId,
                latitud: dto.latitud,
                longitud: dto.longitud,
                precision_metros: dto.precision_metros,
                velocidad: dto.velocidad,
                bateria: dto.bateria,
                origen: dto.origen || 'app',
                evento: dto.evento,
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`Error registrando ubicación: ${error.message}`);
            throw error;
        }

        return data;
    }

    /**
     * 🚨 Disparar Botón de Pánico
     */
    async dispararPanico(dto: DispararPanicoDto, userId: number, ipAddress: string) {
        const supabase = this.supabaseService.getClient();
        let empleado_id: number | null = null;
        let cliente_id: number | null = null;
        let puesto_id = dto.puesto_id;
        let turno_id: number | null = null;
        let contrato_id: number | null = null;

        // 1. Identificar Origen y Contexto
        if (dto.origen === 'empleado') {
            const { data: emp } = await supabase
                .from('empleados')
                .select('id')
                .eq('usuario_id', userId)
                .single();
            empleado_id = emp?.id || null;

            // Buscar turno activo para contexto
            const { data: turno } = await supabase
                .from('turnos')
                .select('id, puesto_id')
                .eq('empleado_id', empleado_id)
                .eq('estado_turno', 'parcial') // 'parcial' es el estado "En Curso"
                .maybeSingle();

            if (turno) {
                turno_id = turno.id;
                puesto_id = puesto_id || turno.puesto_id;
            }
        } else {
            const { data: cli } = await supabase
                .from('clientes')
                .select('id')
                .eq('usuario_id', userId)
                .single();
            cliente_id = cli?.id || null;
        }

        // 2. Obtener contrato_id si tenemos puesto_id
        if (puesto_id) {
            const { data: puesto } = await supabase
                .from('puestos_trabajo')
                .select('contrato_id')
                .eq('id', puesto_id)
                .single();
            contrato_id = puesto?.contrato_id || null;
        }

        // 3. Registrar Evento de Pánico
        const { data: evento, error: panicoError } = await supabase
            .from('boton_panico_eventos')
            .insert({
                origen: dto.origen,
                empleado_id,
                cliente_id,
                usuario_id: userId,
                puesto_id,
                contrato_id,
                turno_id,
                latitud: dto.latitud,
                longitud: dto.longitud,
                precision_metros: dto.precision_metros,
                ip_origen: ipAddress,
                dispositivo: dto.dispositivo,
                version_app: dto.version_app,
                estado: 'activo',
            })
            .select()
            .single();

        if (panicoError) {
            this.logger.error(`Error registrando evento de pánico: ${panicoError.message}`);
            throw panicoError;
        }

        // 4. Crear Registro en Minuta del Puesto (Audit Trail)
        if (puesto_id) {
            const { error: minutaError } = await supabase
                .from('minutas')
                .insert({
                    puesto_id,
                    turno_id: turno_id || null,
                    creada_por: userId,
                    contenido: `🚨 BOTÓN DE PÁNICO ACTIVADO por ${dto.origen.toUpperCase()}. ID Evento: ${evento.id}. Ubicación: ${dto.latitud}, ${dto.longitud}`,
                    tipo: 'pánico',
                    titulo: 'ALERTA: Botón de Pánico',
                    categoria: 'seguridad',
                    nivel_riesgo: 'crítico',
                    ubicacion_lat: dto.latitud,
                    ubicacion_lng: dto.longitud,
                    estado: 'activo',
                    ip_origen: ipAddress,
                    dispositivo: dto.dispositivo,
                    version_app: dto.version_app,
                });

            if (minutaError) {
                this.logger.warn(`Evento de pánico registrado pero falló la creación de minuta: ${minutaError.message}`);
            }
        }

        return {
            message: '🚨 ALERTA DE PÁNICO REGISTRADA Y NOTIFICADA',
            evento_id: evento.id,
        };
    }
}
