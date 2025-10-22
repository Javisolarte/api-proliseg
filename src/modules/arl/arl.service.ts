import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateArlDto, UpdateArlDto } from "./dto/arl.dto";

@Injectable()
export class ArlService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("arl").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("arl").select("*").eq("id", id).single();
    if (error || !data) throw new NotFoundException(`ARL con ID ${id} no encontrada`);
    return data;
  }

  async create(createArlDto: CreateArlDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("arl").insert(createArlDto).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: number, updateArlDto: UpdateArlDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("arl").update(updateArlDto).eq("id", id).select().single();
    if (error || !data) throw new NotFoundException(`ARL con ID ${id} no encontrada`);
    return data;
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("arl").delete().eq("id", id).select().single();
    if (error || !data) throw new NotFoundException(`ARL con ID ${id} no encontrada`);
    return { message: "ARL eliminada exitosamente", data };
  }
}
