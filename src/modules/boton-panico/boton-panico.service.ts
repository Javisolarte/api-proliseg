import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivarPanicoDto, AtenderPanicoDto, FilterPanicoDto, CerrarPanicoDto } from './dto/boton-panico.dto';
import { BotonPanicoGateway } from './boton-panico.gateway';

@Injectable()
export class BotonPanicoService {
    private readonly logger = new Logger(BotonPanicoService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly gateway: BotonPanicoGateway
    ) { }

    /**
     * 🚨 1. Activar Botón de Pánico
     */
    async activar(dto: ActivarPanicoDto, ipAddress: string) {
        const db = this.supabase.getClient();

        // 1. Insertar el evento principal
        const { data: evento, error: err } = await db
            .from('boton_panico_eventos')
            .insert({
                ...dto,
                ip_origen: ipAddress,
                estado: 'activo',
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (err) throw err;

        // 2. Crear registro en Minuta si hay un puesto relacionado
        if (dto.puesto_id) {
            await db.from('minutas').insert({
                puesto_id: dto.puesto_id,
                turno_id: dto.turno_id || null,
                creada_por: dto.usuario_id,
                contenido: `🚨 BOTÓN DE PÁNICO ACTIVADO. Origen: ${dto.origen.toUpperCase()}.`,
                tipo: 'seguridad',
                titulo: 'ALERTA DE SEGURIDAD',
                nivel_riesgo: 'crítico',
                ubicacion_lat: dto.latitud,
                ubicacion_lng: dto.longitud,
                ip_origen: ipAddress,
                dispositivo: dto.dispositivo,
                version_app: dto.version_app
            });
        }

        // 3. Obtener evento enriquecido (con datos de usuario, puesto, etc.) para emitir
        const eventoEnriquecido = await this.getDetalle(evento.id);

        // 4. Emitir alerta en tiempo real vía WebSocket
        this.gateway.emitPanicEvent(eventoEnriquecido);

        return eventoEnriquecido;
    }

    /**
     * 📡 2. Listar Activos
     */
    async getActivos(puesto_id?: number, origen?: string) {
        const db = this.supabase.getClient();
        let query = db
            .from('boton_panico_eventos')
            .select(`
        *,
        empleados(nombre_completo),
        clientes(nombre_empresa),
        puestos_trabajo(nombre)
      `)
            .eq('estado', 'activo');

        if (puesto_id) query = query.eq('puesto_id', puesto_id);
        if (origen) query = query.eq('origen', origen);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    /**
     * 🔍 3. Obtener Detalle
     */
    async getDetalle(id: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('boton_panico_eventos')
            .select(`
        *,
        empleados(nombre_completo, cedula, telefono),
        clientes(nombre_empresa, nit, contacto),
        puestos_trabajo(nombre, direccion, ciudad),
        usuarios_externos!usuario_id(nombre_completo),
        atendido_por_usuario:usuarios_externos!atendido_por(nombre_completo)
      `)
            .eq('id', id)
            .single();

        if (error || !data) throw new NotFoundException('Evento no encontrado');

        // Buscar minutas relacionadas por texto o metadatos si fuera necesario
        // Por simplicidad, retornamos el evento principal.
        return data;
    }

    /**
     * 👷 4. Atender Pánico
     */
    async atender(id: number, dto: AtenderPanicoDto) {
        const db = this.supabase.getClient();

        // Calcular tiempo de respuesta
        const { data: evento } = await this.getDetalle(id);
        const start = new Date(evento.created_at).getTime();
        const now = new Date();
        const diff = Math.floor((now.getTime() - start) / 1000);

        const { data, error } = await db
            .from('boton_panico_eventos')
            .update({
                estado: 'atendido',
                atendido_por: dto.atendido_por,
                fecha_atencion: now.toISOString(),
                tiempo_respuesta_segundos: diff
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * ❌ 5. Marcar como Falso
     */
    async marcarFalso(id: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('boton_panico_eventos')
            .update({ estado: 'falso' })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    /**
     * ✅ 6. Cerrar Evento
     */
    async cerrar(id: number, dto: CerrarPanicoDto) {
        const db = this.supabase.getClient();

        // Consulta simple sin joins para evitar problemas
        const { data: evento, error: fetchError } = await db
            .from('boton_panico_eventos')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !evento) {
            this.logger.error(`Error al buscar evento ${id}: ${fetchError?.message || 'No encontrado'}`);
            throw new NotFoundException(`Evento de pánico con ID ${id} no encontrado`);
        }

        // Permitir cerrar eventos que están en estado 'atendido' o 'falso'
        if (evento.estado !== 'atendido' && evento.estado !== 'falso') {
            throw new BadRequestException(`El evento debe estar en estado 'atendido' o 'falso' para cerrarse. Estado actual: ${evento.estado}`);
        }

        // Calcular tiempo total de respuesta (desde creación hasta cierre)
        const createdAt = new Date(evento.created_at).getTime();
        const now = new Date();
        const tiempoTotalSegundos = Math.floor((now.getTime() - createdAt) / 1000);

        const { data, error } = await db
            .from('boton_panico_eventos')
            .update({
                estado: 'cerrado',
                tiempo_respuesta_segundos: tiempoTotalSegundos,
                atendido_por: dto.cerrado_por // Guardamos quién cerró el evento
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        this.logger.log(`Evento ${id} cerrado por empleado ${dto.cerrado_por}. Tiempo total: ${tiempoTotalSegundos}s`);
        return data;
    }

    /**
     * 📜 7. Historial
     */
    async getHistorial(filters: FilterPanicoDto) {
        const db = this.supabase.getClient();
        let query = db
            .from('boton_panico_eventos')
            .select(`
        *,
        puestos_trabajo(nombre),
        empleados(nombre_completo)
      `);

        if (filters.desde) query = query.gte('created_at', filters.desde);
        if (filters.hasta) query = query.lte('created_at', filters.hasta);
        if (filters.origen) query = query.eq('origen', filters.origen);
        if (filters.empleado_id) query = query.eq('empleado_id', filters.empleado_id);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    /**
     * 📊 8. Métricas
     */
    async getMetricas() {
        const db = this.supabase.getClient();
        const { data: eventos, error } = await db.from('boton_panico_eventos').select('*');
        if (error) throw error;

        const total = eventos.length;
        const atendidos = eventos.filter(e => e.estado === 'atendido' || e.estado === 'cerrado');
        const falsos = eventos.filter(e => e.estado === 'falso').length;

        const avgResponse = atendidos.length > 0
            ? atendidos.reduce((acc, e) => acc + (e.tiempo_respuesta_segundos || 0), 0) / atendidos.length
            : 0;

        // Conteo por puesto
        const porPuesto = eventos.reduce((acc, e) => {
            acc[e.puesto_id] = (acc[e.puesto_id] || 0) + 1;
            return acc;
        }, {});

        return {
            total_activaciones: total,
            tiempo_promedio_atencion_seg: Math.round(avgResponse),
            porcentaje_falsas_alarmas: total > 0 ? (falsos / total) * 100 : 0,
            eventos_por_puesto: porPuesto
        };
    }
}
