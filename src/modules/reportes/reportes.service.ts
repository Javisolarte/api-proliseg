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

    async generarReporteOperativo(puesto_id: number, fecha_inicio: string, fecha_fin: string) {
        const db = this.supabaseService.getClient();

        // 1. Obtener información del Puesto
        const { data: puesto } = await db.from('puestos_trabajo').select('nombre, cliente:cliente_id(nombre_comercial)').eq('id', puesto_id).single();

        // 2. Asistencias (Entry/Exit)
        // Link via Turnos -> Subpuestos -> Puesto
        // Or using historic table 'asistencias' if it has 'puesto_id' (legacy) or join
        // Let's use 'turnos_asistencia' joined with 'turnos' filtered by date and puesto
        const { data: asistencias } = await db
            .from('turnos_asistencia')
            .select(`
                *,
                empleado:empleado_id(nombre_completo),
                turno:turno_id!inner(
                    subpuesto:subpuesto_id!inner(puesto_id)
                )
            `)
            .eq('turno.subpuesto.puesto_id', puesto_id)
            .gte('hora_entrada', fecha_inicio)
            .lte('hora_entrada', fecha_fin);

        // 3. Rondas (Minutas tipo 'ronda')
        // Minutas table has puesto_id directly
        const { data: rondas } = await db
            .from('minutas')
            .select('*')
            .eq('puesto_id', puesto_id)
            .eq('tipo', 'ronda')
            .gte('created_at', fecha_inicio)
            .lte('created_at', fecha_fin);

        // 4. Novedades (Incidentes)
        // Novedades usually link to turno or directly puesto?
        // Let's assume linkage via turno or direct if schema evolved.
        // Assuming direct puesto link or join
        const { data: novedades } = await db
            .from('novedades')
            .select('*, turnos!inner( subpuesto:subpuesto_id!inner(puesto_id) )')
            .eq('turnos.subpuesto.puesto_id', puesto_id)
            .gte('fecha_hora', fecha_inicio)
            .lte('fecha_hora', fecha_fin);

        // 5. Visitantes (Access Log)
        // 'visitas_registro' table
        const { data: visitas } = await db
            .from('visitas_registro')
            .select('*, visitante:visitante_id(nombre_completo)')
            .eq('puesto_id', puesto_id)
            .gte('fecha_entrada', fecha_inicio)
            .lte('fecha_entrada', fecha_fin);

        // Aggregation
        return {
            meta: {
                puesto: puesto?.nombre,
                cliente: (puesto?.cliente as any)?.nombre_comercial,
                rango: { inicio: fecha_inicio, fin: fecha_fin },
                generado_el: new Date().toISOString()
            },
            resumen: {
                total_asistencias: asistencias?.length || 0,
                total_rondas: rondas?.length || 0,
                total_novedades: novedades?.length || 0,
                total_visitas: visitas?.length || 0
            },
            detalle: {
                asistencias: asistencias?.map(a => ({
                    empleado: (a.empleado as any)?.nombre_completo,
                    entrada: a.hora_entrada,
                    salida: a.hora_salida,
                    estado: a.estado_asistencia
                })),
                rondas: rondas?.map(r => ({
                    titulo: r.titulo,
                    hora: r.hora,
                    contenido: r.contenido,
                    guardia: r.creada_por // id
                })),
                novedades: novedades?.map(n => ({
                    tipo: n.tipo_novedad,
                    descripcion: n.descripcion,
                    fecha: n.fecha_hora
                }))
            }
        };
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
