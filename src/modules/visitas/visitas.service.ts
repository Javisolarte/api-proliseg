import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateVisitaDto, CreateTipoChequeoDto, UpdateTipoChequeoDto, CreateChequeoDto, CreateTipoChequeoItemDto, UpdateTipoChequeoItemDto } from './dto/create-visita.dto';

@Injectable()
export class VisitasService {
    constructor(private readonly supabaseService: SupabaseService) { }

    // --- VISITAS (Eventos de Llegada) ---
    // No hay una tabla "visitas" explicita en el esquema, pero hay "rutas_supervision_eventos" con tipo 'llegada'
    // O podemos usar "rutas_supervision_eventos" para loguear la visita.
    // El usuario pillo: POST /api/visitas.
    // Lo mapearemos a un evento de tipo 'llegada' en 'rutas_supervision_eventos'.

    async registrarVisita(dto: CreateVisitaDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_eventos').insert({
            ejecucion_id: dto.ejecucion_id,
            tipo_evento: 'llegada',
            latitud: dto.latitud,
            longitud: dto.longitud,
            observacion: `Visita a puesto ${dto.puesto_id}. ${dto.observacion || ''}`
        }).select().single();

        if (error) throw error;
        return data;
    }

    async getVisitasPorEjecucion(ejecucionId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_eventos')
            .select('*')
            .eq('ejecucion_id', ejecucionId)
            .eq('tipo_evento', 'llegada')
            .order('fecha', { ascending: false });
        if (error) throw error;
        return data;
    }

    // --- TIPOS DE CHEQUEO ---
    async createTipoChequeo(dto: CreateTipoChequeoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('tipos_chequeo').insert(dto).select().single();
        if (error) throw new BadRequestException(`Error al crear tipo de chequeo: ${error.message}`);
        return data;
    }

    async findAllTiposChequeo() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('tipos_chequeo').select('*').eq('activo', true);
        if (error) throw new BadRequestException(`Error al obtener tipos de chequeo: ${error.message}`);
        return data;
    }

    async updateTipoChequeo(id: number, dto: UpdateTipoChequeoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('tipos_chequeo').update(dto).eq('id', id).select().single();
        if (error) throw new BadRequestException(`Error al actualizar tipo de chequeo: ${error.message}`);
        return data;
    }

    async deleteTipoChequeo(id: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('tipos_chequeo').update({ activo: false }).eq('id', id); // Soft delete default
        if (error) throw error;
        return { message: 'Tipo de chequeo desactivado' };
    }

    // --- MINUTAS RUTAS (Checkeos Reales) ---
    // Tabla: minutas_rutas
    async registrarChequeo(dto: CreateChequeoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('minutas_rutas').insert(dto).select().single();
        if (error) throw error;
        return data;
    }

    async getChequeo(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('minutas_rutas')
            .select(`
              *,
              tipo_chequeo:tipos_chequeo(*),
              puesto:puestos_trabajo(id, nombre),
              supervisor:empleados(id, nombre_completo),
              evidencias:minutas_rutas_evidencias(*),
              resultados:minutas_rutas_check_resultados(*, item:tipos_chequeo_items(pregunta))
          `)
            .eq('id', id)
            .single();

        if (error || !data) throw new NotFoundException('Chequeo no encontrado');
        return data;
    }

    async getChequeosPorVisita(visitaId: number) {
        // "visita_id" no existe en minutas_rutas directamente, se linkea por ejecucion y puesto probablemente.
        // O el usuario asume que "visita" retorna un ID que luego usa. 
        // Si "visita" es un evento, tiene ID. Pero minutas_rutas no tiene FK a eventos eventos.
        // ASUMIREMOS: visita_id == id de ejecucion (error conceptual del usuario?) O filtraremos por ejecucion?
        // El request dice: GET /api/checkeos/visita/{visita_id}
        // Si registramos visita como evento, tenemos un ID evento.
        // Pero minutas_rutas solo tiene "ejecucion_id".
        // Quizas deberiamos agregar el campo "evento_visita_id" a minutas_rutas? No puedo modificar schema.
        // Retornaremos vacio o error not implemented si no se puede linkear.
        // WORKAROUND: Asumiremos que el frontend pasa el ID de la EJECUCION aqui, o implementaremos busqueda por puesto+ejecucion.
        // Voy a interpretar ruta "visita/{visita_id}" como obtener chequeos ASOCIADOS a esa visita... 
        // Dado el schema, obtendre por ejecucion_id.

        throw new BadRequestException("Endpoint no soportado directamente por schema actual. Use filtro por ejecución.");
    }

    // --- ÍTEMS DE CHEQUEO (CONFIGURACIÓN) ---

    async findItemsByTipo(tipoId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from('tipos_chequeo_items').select('*');

        if (tipoId && !isNaN(tipoId) && tipoId > 0) {
            query = query.eq('tipo_chequeo_id', tipoId);
        }

        const { data, error } = await query
            .eq('activo', true)
            .order('orden', { ascending: true });

        if (error) {
            console.error('Error fetching checkpoint items:', error);
            throw new BadRequestException(`Error al obtener ítems: ${error.message}`);
        }
        return data || [];
    }

    async createItem(dto: CreateTipoChequeoItemDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('tipos_chequeo_items').insert(dto).select().single();
        if (error) throw error;
        return data;
    }

    async updateItem(id: number, dto: UpdateTipoChequeoItemDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('tipos_chequeo_items').update(dto).eq('id', id).select().single();
        if (error) throw error;
        return data;
    }

    async deleteItem(id: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('tipos_chequeo_items').delete().eq('id', id);
        if (error) throw error;
        return { message: 'Ítem eliminado correctamente' };
    }
}
