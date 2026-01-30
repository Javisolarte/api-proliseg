import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateAuditoriaDto } from "./dto/auditoria.dto";

@Injectable()
export class AuditoriaService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createAuditoriaDto: CreateAuditoriaDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("auditoria").insert(createAuditoriaDto).select().single();
        if (error) throw error;
        return data;
    }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("auditoria")
            .select(`
        *,
        usuarios_externos(id, nombre_completo)
      `)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }

    async findWithFilters(query: any) {
        const supabase = this.supabaseService.getClient();
        let queryBuilder = supabase
            .from("auditoria")
            .select(`
                *,
                usuarios_externos(id, nombre_completo)
            `, { count: 'exact' });

        // Apply filters
        if (query.desde) {
            queryBuilder = queryBuilder.gte('created_at', query.desde);
        }

        if (query.hasta) {
            queryBuilder = queryBuilder.lte('created_at', query.hasta);
        }

        if (query.usuario_id) {
            queryBuilder = queryBuilder.eq('usuario_id', query.usuario_id);
        }

        if (query.accion) {
            queryBuilder = queryBuilder.eq('accion', query.accion);
        }

        if (query.tabla) {
            queryBuilder = queryBuilder.eq('tabla_afectada', query.tabla);
        }

        // Pagination
        const limit = query.limit || 100;
        const offset = query.offset || 0;

        queryBuilder = queryBuilder
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await queryBuilder;

        if (error) throw error;

        return {
            data,
            total: count,
            limit,
            offset
        };
    }

    async findByUsuario(usuario_id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("auditoria")
            .select(`
                *,
                usuarios_externos(id, nombre_completo)
            `)
            .eq('usuario_id', usuario_id)
            .order("created_at", { ascending: false })
            .limit(500);

        if (error) throw error;
        return data;
    }

    async findByEntidad(tipo: string, id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('auditoria')
            .select(`
                *,
                usuarios_externos(nombre_completo)
            `)
            .eq('tabla_afectada', tipo)
            .eq('registro_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("auditoria").select("*").eq("id", id).single();
        if (error || !data) throw new NotFoundException(`Registro de auditoría con ID ${id} no encontrado`);
        return data;
    }

    async getByRegistro(tabla: string, registroId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('auditoria')
            .select(`
                *,
                usuarios_externos(nombre_completo)
            `)
            .eq('tabla_afectada', tabla)
            .eq('registro_id', registroId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }
}
