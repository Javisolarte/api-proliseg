import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateNotificacionDto, UpdateNotificacionDto } from "./dto/notificacion.dto";

@Injectable()
export class NotificacionesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    return data;
  }

  async create(createNotificacionDto: CreateNotificacionDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .insert(createNotificacionDto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: number, updateNotificacionDto: UpdateNotificacionDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .update(updateNotificacionDto)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    return data;
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    return { message: "Notificación eliminada exitosamente", data };
  }
}
