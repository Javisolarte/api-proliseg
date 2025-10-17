import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreatePuestoDto, UpdatePuestoDto } from "./dto/puesto.dto";

@Injectable()
export class PuestosService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // 🔹 Obtener todos los puestos
  async findAll() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .select(`
        *,
        contrato:contrato_id(nombre, id),
        configuracion:configuracion_id(nombre, id),
        parent:parent_id(nombre, id)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  // 🔹 Obtener un puesto por ID
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .select(`
        *,
        contrato:contrato_id(nombre, id),
        configuracion:configuracion_id(nombre, id),
        parent:parent_id(nombre, id)
      `)
      .eq("id", id)
      .single();

    if (error || !data)
      throw new NotFoundException(`Puesto de trabajo con ID ${id} no encontrado`);

    return data;
  }

  // 🔹 Crear puesto
  async create(dto: CreatePuestoDto, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .insert({
        ...dto,
        creado_por: userId,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 🔹 Actualizar puesto
  async update(id: number, dto: UpdatePuestoDto, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findError } = await supabase
      .from("puestos_trabajo")
      .select("id")
      .eq("id", id)
      .single();

    if (findError || !existing)
      throw new NotFoundException(`Puesto con ID ${id} no encontrado`);

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .update({
        ...dto,
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 🔹 Soft delete
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findError } = await supabase
      .from("puestos_trabajo")
      .select("id, activo")
      .eq("id", id)
      .single();

    if (findError || !existing)
      throw new NotFoundException(`Puesto con ID ${id} no encontrado`);

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .update({
        activo: false,
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { message: "Puesto marcado como inactivo exitosamente", data };
  }
}
