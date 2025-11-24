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

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("auditoria").select("*").eq("id", id).single();
        if (error || !data) throw new NotFoundException(`Registro de auditoría con ID ${id} no encontrado`);
        return data;
    }
}
