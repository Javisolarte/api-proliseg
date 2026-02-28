import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateSedeDto, UpdateSedeDto } from "./dto/sede.dto";

@Injectable()
export class SedesService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("sedes").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("sedes").select("*").eq("id", id).single();
        if (error || !data) throw new NotFoundException(`Sede con ID ${id} no encontrada`);
        return data;
    }

    async create(createSedeDto: CreateSedeDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("sedes").insert(createSedeDto).select().single();
        if (error) throw error;
        return data;
    }

    async update(id: number, updateSedeDto: UpdateSedeDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("sedes").update(updateSedeDto).eq("id", id).select().single();
        if (error || !data) throw new NotFoundException(`Sede con ID ${id} no encontrada`);
        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("sedes").delete().eq("id", id).select().single();
        if (error || !data) throw new NotFoundException(`Sede con ID ${id} no encontrada`);
        return { message: "Sede eliminada exitosamente", data };
    }
}
