import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateSubpuestoDto, UpdateSubpuestoDto } from "./dto/subpuesto.dto";

@Injectable()
export class SubpuestosService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // 🔹 Listar todos los subpuestos
  async findAll() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("subpuestos_trabajo")
      .select(`
        *,
        puesto:puesto_id (
          id,
          nombre,
          contrato_id,
          numero_guardas
        ),
        configuracion:configuracion_id (
          id,
          nombre,
          tipo_turno
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  // 🔹 Obtener un subpuesto por ID
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("subpuestos_trabajo")
      .select(`
        *,
        puesto:puesto_id (
          id,
          nombre,
          contrato_id,
          numero_guardas
        ),
        configuracion:configuracion_id (
          id,
          nombre,
          tipo_turno
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) throw new NotFoundException("Subpuesto no encontrado");
    return data;
  }

  // 🔹 Crear un nuevo subpuesto
  async create(dto: CreateSubpuestoDto, userId: number) {
    const supabase = this.supabaseService.getClient();

    // 1️⃣ Verificar que el puesto padre exista
    const { data: puesto, error: puestoError } = await supabase
      .from("puestos_trabajo")
      .select("id, contrato_id, numero_guardas")
      .eq("id", dto.parent_id)
      .single();

    if (puestoError || !puesto)
      throw new NotFoundException("Puesto padre no encontrado");

    // 2️⃣ Verificar que el puesto padre tenga 0 guardas
    if (puesto.numero_guardas > 0)
      throw new BadRequestException(
        "El puesto padre debe tener 0 guardas para crear subpuestos"
      );

    // 3️⃣ Obtener el contrato y el límite de guardas
    const { data: contrato, error: contratoError } = await supabase
      .from("contratos")
      .select("id, numero_guardas")
      .eq("id", puesto.contrato_id)
      .single();

    if (contratoError || !contrato)
      throw new NotFoundException("Contrato asociado no encontrado");

    // 4️⃣ Calcular el total actual de guardas de los subpuestos del puesto padre
    const { data: subpuestos, error: subError } = await supabase
      .from("subpuestos_trabajo")
      .select("numero_guardas")
      .eq("puesto_id", dto.parent_id);

    if (subError) throw subError;

    const totalActual = subpuestos.reduce((acc, s) => acc + (s.numero_guardas || 0), 0);
    const totalNuevo = totalActual + dto.numero_guardas;

    if (totalNuevo > contrato.numero_guardas)
      throw new BadRequestException(
        `El total de guardas (${totalNuevo}) supera el límite permitido del contrato (${contrato.numero_guardas}).`
      );

    // 5️⃣ Crear subpuesto
    const { data, error } = await supabase
      .from("subpuestos_trabajo")
      .insert({
        puesto_id: dto.parent_id,
        nombre: dto.nombre,
        descripcion: dto.direccion,
        ciudad: dto.ciudad,
        numero_guardas: dto.numero_guardas,
        configuracion_id: dto.configuracion_id ?? null, // 🔹 referencia opcional
        activo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { message: "Subpuesto creado exitosamente", data };
  }

  // 🔹 Actualizar subpuesto existente
  async update(id: number, dto: UpdateSubpuestoDto, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findError } = await supabase
      .from("subpuestos_trabajo")
      .select("id")
      .eq("id", id)
      .single();

    if (findError || !existing)
      throw new NotFoundException("Subpuesto no encontrado");

    const { data, error } = await supabase
      .from("subpuestos_trabajo")
      .update({
        nombre: dto.nombre,
        descripcion: dto.direccion,
        ciudad: dto.ciudad,
        numero_guardas: dto.numero_guardas,
        configuracion_id: dto.configuracion_id ?? null, // 🔹 se actualiza si lo envían
        activo: dto.activo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { message: "Subpuesto actualizado exitosamente", data };
  }

  // 🔹 Soft delete (eliminar lógicamente)
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("subpuestos_trabajo")
      .update({
        activo: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { message: "Subpuesto eliminado (soft delete) exitosamente", data };
  }
}
