import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateReporteDto, UpdateReporteDto } from "./dto/reporte.dto";

@Injectable()
export class ReportesService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createReporteDto: CreateReporteDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("reportes").insert(createReporteDto).select().single();
        if (error) throw error;
        return data;
    }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("reportes")
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
        const { data, error } = await supabase.from("reportes").select("*").eq("id", id).single();
        if (error || !data) throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
        return data;
    }

    async update(id: number, updateReporteDto: UpdateReporteDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("reportes")
            .update(updateReporteDto)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("reportes").delete().eq("id", id).select().single();
        if (error) throw error;
        return { message: "Reporte eliminado", data };
    }
}
