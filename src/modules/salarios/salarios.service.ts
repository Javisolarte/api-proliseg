import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateSalarioDto, UpdateSalarioDto } from "./dto/salarios.dto";

@Injectable()
export class SalariosService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("salarios").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("salarios").select("*").eq("id", id).single();
        if (error || !data) throw new NotFoundException(`Salario con ID ${id} no encontrado`);
        return data;
    }

    async create(createSalarioDto: CreateSalarioDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("salarios").insert(createSalarioDto).select().single();
        if (error) throw error;
        return data;
    }

    async update(id: number, updateSalarioDto: UpdateSalarioDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("salarios").update(updateSalarioDto).eq("id", id).select().single();
        if (error || !data) throw new NotFoundException(`Salario con ID ${id} no encontrado`);
        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("salarios").delete().eq("id", id).select().single();
        if (error || !data) throw new NotFoundException(`Salario con ID ${id} no encontrado`);
        return { message: "Salario eliminado exitosamente", data };
    }
}
