import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import fetch from "node-fetch"; // npm install node-fetch
import type { CreateTurnoReemplazoDto, UpdateTurnoReemplazoDto } from "./dto/turnos_reemplazos.dto";

interface Coordenadas {
  lat: number;
  lon: number;
}

interface Empleado {
  id: number;
  nombre: string;
  direccion: string;
}

interface SugerenciaEmpleado {
  id: number;
  nombre: string;
  direccion: string;
  distancia_km: number;
  score_ia: number;
  afinidad: number;
}

interface Turno {
  id: number;
  empleado_id: number;
  puesto_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

@Injectable()
export class TurnosReemplazosService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // 🌍 Obtener coordenadas desde una dirección textual (Nominatim / OpenStreetMap)
  private async obtenerCoordenadasDesdeDireccion(direccion: string): Promise<Coordenadas | null> {
    if (!direccion) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "ProlisegApp/1.0 (contacto@proliseg.com)" },
      });
      const data = (await res.json()) as any[];
      if (data?.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
      return null;
    } catch (error) {
      console.error("❌ Error obteniendo coordenadas:", error);
      return null;
    }
  }

  // 🧮 Calcular distancia (en km) entre dos coordenadas (Haversine)
  private calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // 🤖 IA simple: prioriza empleados con experiencia previa en el puesto
  private calcularScoreIA(empleadoId: number, historialTurnos: Turno[], puestoId: number): number {
    const experiencia = historialTurnos.filter(
      (t) => t.empleado_id === empleadoId && t.puesto_id === puestoId
    ).length;
    return experiencia;
  }

  // ✅ Crear o sugerir reemplazo inteligente
  async create(dto: CreateTurnoReemplazoDto) {
    const supabase = this.supabaseService.getClient();

    // 1️⃣ Obtener turno original
    const { data: turno, error: turnoError } = await supabase
      .from("turnos")
      .select("*")
      .eq("id", dto.turno_original_id)
      .single<Turno>();

    if (turnoError || !turno) throw new BadRequestException("El turno original no existe");

    // 2️⃣ Obtener dirección del puesto
    const { data: puesto } = await supabase
      .from("puestos")
      .select("id, nombre, direccion")
      .eq("id", turno.puesto_id)
      .single<{ id: number; nombre: string; direccion: string }>();

    const coordsPuesto = await this.obtenerCoordenadasDesdeDireccion(puesto?.direccion ?? "");

    // 3️⃣ Obtener empleados asignados al puesto
    const { data: asignados } = await supabase
      .from("asignacion_guardas_puesto")
      .select("empleado_id")
      .eq("puesto_id", turno.puesto_id)
      .eq("activo", true);

    const asignaciones = (asignados ?? []) as { empleado_id: number }[];
    if (asignaciones.length === 0)
      throw new BadRequestException("No hay empleados asociados al puesto");

    const idsCandidatos = asignaciones.map((a) => a.empleado_id);

    // 4️⃣ Verificar disponibilidad
    const { data: ocupados } = await supabase
      .from("turnos")
      .select("empleado_id")
      .in("empleado_id", idsCandidatos)
      .eq("fecha", turno.fecha)
      .or(`and(hora_inicio.lte.${turno.hora_fin},hora_fin.gte.${turno.hora_inicio})`);

    const empleadosOcupados = (ocupados ?? []).map((o) => o.empleado_id);
    const disponibles = idsCandidatos.filter((id) => !empleadosOcupados.includes(id));

    // 5️⃣ Obtener datos de empleados
    const { data: empleados } = await supabase.from("empleados").select("id, nombre, direccion");
    const empleadosLista = (empleados ?? []) as Empleado[];

    // 6️⃣ Historial de turnos
    const { data: historialTurnos } = await supabase
      .from("turnos")
      .select("empleado_id, puesto_id");
    const historial = (historialTurnos ?? []) as Turno[];

    // 7️⃣ Calcular sugerencias
    const sugerencias: SugerenciaEmpleado[] = [];
    for (const id of disponibles) {
      const empleado = empleadosLista.find((e) => e.id === id);
      if (!empleado) continue;

      const coordsEmpleado = await this.obtenerCoordenadasDesdeDireccion(empleado.direccion);
      const distancia =
        coordsPuesto && coordsEmpleado
          ? this.calcularDistancia(
              coordsEmpleado.lat,
              coordsEmpleado.lon,
              coordsPuesto.lat,
              coordsPuesto.lon
            )
          : 9999;

      const scoreIA = this.calcularScoreIA(empleado.id, historial, turno.puesto_id);

      sugerencias.push({
        id: empleado.id,
        nombre: empleado.nombre,
        direccion: empleado.direccion,
        distancia_km: parseFloat(distancia.toFixed(2)),
        score_ia: scoreIA,
        afinidad: Math.max(0, 100 - distancia * 3 + scoreIA * 10),
      });
    }

    sugerencias.sort((a, b) => b.afinidad - a.afinidad);
    const top3 = sugerencias.slice(0, 3);

    // 8️⃣ Si no se elige reemplazo → solo sugerir
    if (!dto.empleado_reemplazo_id) {
      return {
        mensaje: "🔎 Sugerencias de reemplazo (basadas en dirección y experiencia previa)",
        turno_original: turno,
        sugerencias: top3,
      };
    }

    // 9️⃣ Crear reemplazo y nuevo turno
    const empleadoReemplazoId = dto.empleado_reemplazo_id;

    const { data: reemplazo, error: errorReemplazo } = await supabase
      .from("turnos_reemplazos")
      .insert({
        turno_original_id: dto.turno_original_id,
        empleado_reemplazo_id: empleadoReemplazoId,
        motivo: dto.motivo ?? "Reemplazo manual con IA",
        autorizado_por: dto.autorizado_por ?? null,
        estado: "aprobado",
      })
      .select()
      .single();

    if (errorReemplazo) throw errorReemplazo;

    const nuevoTurno = {
      empleado_id: empleadoReemplazoId,
      puesto_id: turno.puesto_id,
      fecha: turno.fecha,
      hora_inicio: turno.hora_inicio,
      hora_fin: turno.hora_fin,
      tipo_turno: "reemplazo",
      asignado_por: dto.autorizado_por ?? null,
      estado_turno: "programado",
      turno_reemplazo_id: turno.id,
    };

    const { data: turnoCreado, error: errTurno } = await supabase
      .from("turnos")
      .insert(nuevoTurno)
      .select()
      .single();

    if (errTurno) throw errTurno;

    return {
      mensaje: "✅ Reemplazo creado correctamente",
      reemplazo,
      nuevo_turno: turnoCreado,
      sugerencias_usadas: top3,
    };
  }

  // 📋 Listar todos los reemplazos
  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("turnos_reemplazos")
      .select("*, empleado_reemplazo:empleados(nombre), turno_original:turnos(*)")
      .order("id", { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  // 🔍 Buscar un reemplazo por ID
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("turnos_reemplazos")
      .select("*, empleado_reemplazo:empleados(nombre), turno_original:turnos(*)")
      .eq("id", id)
      .single();
    if (error || !data) throw new NotFoundException(`Reemplazo con ID ${id} no encontrado`);
    return data;
  }

  // ✏️ Actualizar un reemplazo
  async update(id: number, dto: UpdateTurnoReemplazoDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("turnos_reemplazos")
      .update(dto)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return { mensaje: "✅ Reemplazo actualizado", data };
  }

  // 🗑️ Eliminar un reemplazo
  async remove(id: number) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from("turnos_reemplazos").delete().eq("id", id);
    if (error) throw new InternalServerErrorException(error.message);
    return { mensaje: `🗑️ Reemplazo ${id} eliminado correctamente` };
  }
}
