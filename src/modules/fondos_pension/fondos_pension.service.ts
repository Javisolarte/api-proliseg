import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateFondoPensionDto, UpdateFondoPensionDto } from "./dto/fondos_pension.dto";

@Injectable()
export class FondosPensionService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("fondos_pension").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("fondos_pension").select("*").eq("id", id).single();
    if (error || !data) throw new NotFoundException(`Fondo de pensión con ID ${id} no encontrado`);
    return data;
  }

  async create(createFondoPensionDto: CreateFondoPensionDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("fondos_pension").insert(createFondoPensionDto).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: number, updateFondoPensionDto: UpdateFondoPensionDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("fondos_pension").update(updateFondoPensionDto).eq("id", id).select().single();
    if (error || !data) throw new NotFoundException(`Fondo de pensión con ID ${id} no encontrado`);
    return data;
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from("fondos_pension").delete().eq("id", id).select().single();
    if (error || !data) throw new NotFoundException(`Fondo de pensión con ID ${id} no encontrado`);
    return { message: "Fondo de pensión eliminado exitosamente", data };
  }
}
