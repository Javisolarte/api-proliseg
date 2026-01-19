import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEventoDto, UpdateEventoDto, CreateRecordatorioDto } from './dto/calendario.dto';

@Injectable()
export class CalendarioService {
    private readonly logger = new Logger(CalendarioService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    // --- EVENTOS ---

    async findEventos(usuarioId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from('calendario_eventos').select('*');

        if (usuarioId) {
            query = query.eq('usuario_id', usuarioId);
        }

        const { data, error } = await query.order('fecha_inicio', { ascending: true });
        if (error) throw error;
        return data;
    }

    async findOneEvento(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('calendario_eventos')
            .select('*, recordatorios:calendario_recordatorios(*)')
            .eq('id', id)
            .single();

        if (error || !data) throw new NotFoundException(`Evento con ID ${id} no encontrado`);
        return data;
    }

    async createEvento(dto: CreateEventoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('calendario_eventos')
            .insert(dto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateEvento(id: number, dto: UpdateEventoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('calendario_eventos')
            .update({ ...dto, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) throw new NotFoundException(`Evento con ID ${id} no encontrado`);
        return data;
    }

    async removeEvento(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('calendario_eventos')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error || !data) throw new NotFoundException(`Evento con ID ${id} no encontrado`);
        return { message: "Evento eliminado", data };
    }

    // --- RECORDATORIOS ---

    async createRecordatorio(dto: CreateRecordatorioDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('calendario_recordatorios')
            .insert(dto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async removeRecordatorio(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('calendario_recordatorios')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error || !data) throw new NotFoundException(`Recordatorio no encontrado`);
        return data;
    }

    /**
     * 🔔 Procesar recordatorios pendientes
     * Busca los que deben enviarse ahora y crea la notificación en la tabla principal
     */
    async procesarRecordatoriosPendientes() {
        const supabase = this.supabaseService.getClient();
        const ahora = new Date().toISOString();

        // 1. Buscar recordatorios no enviados cuya fecha_programada sea <= ahora
        const { data: recordatorios, error } = await supabase
            .from('calendario_recordatorios')
            .select(`
                *,
                evento:calendario_eventos(*)
            `)
            .eq('enviado', false)
            .lte('fecha_programada', ahora);

        if (error) throw error;
        if (!recordatorios || recordatorios.length === 0) return { procesados: 0 };

        let total = 0;
        for (const rec of recordatorios) {
            try {
                // 2. Crear notificación en la tabla 'notificaciones'
                await supabase.from('notificaciones').insert({
                    para_usuario_id: rec.evento.usuario_id,
                    mensaje: `🔔 RECORDATORIO: ${rec.evento.titulo}. Inicia: ${new Date(rec.evento.fecha_inicio).toLocaleString()}`,
                    tipo: rec.tipo_notificacion || 'sistema',
                    categoria: 'calendario',
                    leido: false,
                    created_at: ahora
                });

                // 3. Marcar como enviado
                await supabase
                    .from('calendario_recordatorios')
                    .update({ enviado: true })
                    .eq('id', rec.id);

                total++;
            } catch (err) {
                this.logger.error(`Error procesando recordatorio ${rec.id}: ${err.message}`);
            }
        }

        return { procesados: total };
    }

    /**
     * 📅 Agenda diaria
     * Notificar a todos los usuarios sus eventos de hoy a primera hora
     */
    async enviarAgendaDiaria() {
        const supabase = this.supabaseService.getClient();
        const hoy = new Date();
        const inicioHoy = new Date(hoy.setHours(0, 0, 0, 0)).toISOString();
        const finHoy = new Date(hoy.setHours(23, 59, 59, 999)).toISOString();

        // Obtener usuarios que tienen eventos hoy
        const { data: eventos, error } = await supabase
            .from('calendario_eventos')
            .select('*')
            .gte('fecha_inicio', inicioHoy)
            .lte('fecha_inicio', finHoy);

        if (error) throw error;
        if (!eventos || eventos.length === 0) return { notificados: 0 };

        // Agrupar por usuario
        const eventosPorUsuario = eventos.reduce((acc, current) => {
            if (!acc[current.usuario_id]) acc[current.usuario_id] = [];
            acc[current.usuario_id].push(current.titulo);
            return acc;
        }, {});

        let count = 0;
        for (const usuarioId in eventosPorUsuario) {
            const titulos = eventosPorUsuario[usuarioId].join(', ');
            await supabase.from('notificaciones').insert({
                para_usuario_id: usuarioId,
                mensaje: `📅 AGENDA HOY: Tienes ${eventosPorUsuario[usuarioId].length} evento(s): ${titulos}.`,
                tipo: 'sistema',
                categoria: 'calendario_agenda',
                leido: false
            });
            count++;
        }

        return { notificados: count };
    }
}
