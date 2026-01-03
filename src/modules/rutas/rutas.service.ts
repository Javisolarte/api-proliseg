import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import {
    CreateRutaGpsDto, CreateRecorridoSupervisorDto, CreateRondaRonderoDto,
    CreateRutaSupervisionDto, UpdateRutaSupervisionDto, CreateRutaPuntoDto,
    CreateRutaAsignacionDto, CreateRutaEjecucionDto, FinalizarRutaEjecucionDto, CreateRutaEventoDto
} from "./dto/ruta.dto";

@Injectable()
export class RutasService {
    constructor(private readonly supabaseService: SupabaseService) { }

    // --- Rutas GPS (Legacy / Simplificado) ---
    async createRutaGps(createDto: CreateRutaGpsDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("rutas_gps").insert(createDto).select().single();
        if (error) throw error;
        return data;
    }

    async getRutasGps(empleadoId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("rutas_gps").select("*");
        if (empleadoId) query = query.eq("empleado_id", empleadoId);
        const { data, error } = await query.order("timestamp", { ascending: false });
        if (error) throw error;
        return data;
    }

    // --- Recorridos Supervisor (Legacy) ---
    async createRecorrido(createDto: CreateRecorridoSupervisorDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("recorridos_supervisor").insert(createDto).select().single();
        if (error) throw error;
        return data;
    }

    async getRecorridos(supervisorId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("recorridos_supervisor").select("*");
        if (supervisorId) query = query.eq("supervisor_id", supervisorId);
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }

    // --- Rondas Ronderos (Legacy) ---
    async createRonda(createDto: CreateRondaRonderoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("rondas_ronderos").insert(createDto).select().single();
        if (error) throw error;
        return data;
    }

    async getRondas(ronderoId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("rondas_ronderos").select("*");
        if (ronderoId) query = query.eq("rondero_id", ronderoId);
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }

    // ==========================================
    // NUEVO SISTEMA DE SUPERVISIÓN
    // ==========================================

    // 1. PLANIFICACIÓN (Rutas Sugeridas)
    async findAllRutas() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision')
            .select(`
                *,
                puntos:rutas_supervision_puntos(
                    *,
                    puesto:puestos_trabajo(id, nombre)
                )
            `)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async findOneRuta(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision')
            .select(`
                *,
                puntos:rutas_supervision_puntos(
                    *,
                    puesto:puestos_trabajo(id, nombre, latitud, longitud)
                )
            `)
            .eq('id', id)
            .single();

        if (error || !data) throw new NotFoundException(`Ruta ${id} no encontrada`);
        // Ordenar puntos
        if (data.puntos) {
            data.puntos.sort((a, b) => a.orden - b.orden);
        }
        return data;
    }

    async createRuta(dto: CreateRutaSupervisionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision').insert(dto).select().single();
        if (error) throw error;
        return data;
    }

    async updateRuta(id: number, dto: UpdateRutaSupervisionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision').update(dto).eq('id', id).select().single();
        if (error) throw error;
        return data;
    }

    async deleteRuta(id: number) {
        const supabase = this.supabaseService.getClient();
        // Primero eliminar puntos asociados (cascade debería encargarse, pero por seguridad)
        await supabase.from('rutas_supervision_puntos').delete().eq('ruta_id', id);
        const { error } = await supabase.from('rutas_supervision').delete().eq('id', id);
        if (error) throw error;
        return { message: 'Ruta eliminada' };
    }

    // Puntos de Ruta
    async addPunto(rutaId: number, dto: CreateRutaPuntoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_puntos').insert({
            ruta_id: rutaId,
            ...dto
        }).select().single();
        if (error) throw error;
        return data;
    }

    async updatePunto(rutaId: number, dto: CreateRutaPuntoDto) { // Reusing DTO for ease, though partial usually
        // Aquí asumo que se envia todo para actualizar, o se podria crear UpdatePuntoDto
        // Como el endpoint sugerido es PUT /rutas/:id/puestos, supongo quiza reemplazo de lista o un punto especifico?
        // El endpoint era DELETE /api/rutas/{id}/puestos/{ruta_puesto_id} -> especifico
        // Asumiré que este method requiere ID del punto, no de la ruta.
        // Ajustaré en controller.
        return null; // Implementado via updatePuntoDirecto abajo
    }

    async deletePunto(puntoId: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('rutas_supervision_puntos').delete().eq('id', puntoId);
        if (error) throw error;
        return { message: 'Punto eliminado' };
    }

    // 2. ASIGNACIÓN
    async asignarRuta(dto: CreateRutaAsignacionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_asignacion').insert(dto).select().single();
        if (error) throw error;
        return data;
    }

    async getAsignacionPorTurno(turnoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_asignacion')
            .select(`
                *,
                ruta:rutas_supervision(*),
                vehiculo:vehiculos(*)
            `)
            .eq('turno_id', turnoId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || { message: 'No hay ruta asignada a este turno' };
    }

    async deleteAsignacion(id: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('rutas_supervision_asignacion').delete().eq('id', id);
        if (error) throw error;
        return { message: 'Asignación eliminada' };
    }

    // 3. EJECUCIÓN (Real-time)
    async iniciarEjecucion(dto: CreateRutaEjecucionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_ejecucion').insert({
            ...dto,
            fecha_inicio: new Date().toISOString(),
            estado: 'en_progreso'
        }).select().single();

        if (error) throw error;

        // Log event 'inicio'
        await this.registrarEvento({
            ejecucion_id: data.id,
            latitud: 0, // Should come from request ideally
            longitud: 0,
            tipo_evento: 'inicio_ruta',
            observacion: 'Ruta iniciada'
        });

        return data;
    }

    async finalizarEjecucion(dto: FinalizarRutaEjecucionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_ejecucion').update({
            fecha_fin: new Date().toISOString(),
            estado: 'finalizada'
        }).eq('id', dto.ejecucion_id).select().single();

        if (error) throw error;
        return data;
    }

    async getEjecucion(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                 *,
                 asignacion:rutas_supervision_asignacion(
                     *,
                     ruta:rutas_supervision(
                         *,
                         puntos:rutas_supervision_puntos(*)
                     )
                 )
             `)
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    }

    async getEjecucionPorTurno(turnoId: number) {
        // Buscar la asignacion del turno, y luego la ejecucion
        const supabase = this.supabaseService.getClient();
        // Join complejo
        const { data, error } = await supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                *,
                asignacion:rutas_supervision_asignacion!inner(turno_id)
            `)
            .eq('asignacion.turno_id', turnoId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || { message: 'No hay ejecución iniciada para este turno' };
    }

    async getEjecucionPorSupervisor(supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('*')
            .eq('supervisor_id', supervisorId)
            .order('fecha_inicio', { ascending: false });
        if (error) throw error;
        return data;
    }

    // 4. EVENTOS (GPS Tracking)
    async registrarEvento(dto: CreateRutaEventoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_eventos').insert({
            ...dto,
            fecha: new Date().toISOString()
        }).select().single();
        if (error) throw error;
        return data;
    }

    async getEventos(ejecucionId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_eventos')
            .select('*')
            .eq('ejecucion_id', ejecucionId)
            .order('fecha', { ascending: true });
        if (error) throw error;
        return data;
    }

    async getMapa(ejecucionId: number) {
        // Retorna GeoJSON o lista simple para mapa
        const eventos = await this.getEventos(ejecucionId);
        const path = eventos.filter(e => e.tipo_evento === 'gps' || e.latitud !== 0).map(e => ({
            lat: e.latitud,
            lng: e.longitud,
            timestamp: e.fecha
        }));
        return { ruta: path, eventos: eventos.filter(e => e.tipo_evento !== 'gps') };
    }

}
