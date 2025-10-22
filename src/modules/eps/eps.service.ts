import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateEpsDto, UpdateEpsDto } from "./dto/eps.dto";

@Injectable()
export class EpsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("eps").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("eps").select("*").eq("id", id).single();
    if (error || !data) throw new NotFoundException(`EPS con ID ${id} no encontrada`);
    return data;
  }

  async create(createEpsDto: CreateEpsDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("eps").insert(createEpsDto).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: number, updateEpsDto: UpdateEpsDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("eps").update(updateEpsDto).eq("id", id).select().single();
    if (error || !data) throw new NotFoundException(`EPS con ID ${id} no encontrada`);
    return data;
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("eps").delete().eq("id", id).select().single();
    if (error || !data) throw new NotFoundException(`EPS con ID ${id} no encontrada`);
    return { message: "EPS eliminada exitosamente", data };
  }
}
