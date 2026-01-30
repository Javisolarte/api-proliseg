import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateVisitaTecnicaDto, UpdateVisitaTecnicaDto } from "./dto/visita-tecnica.dto";

@Injectable()
export class VisitasTecnicasService {
    private readonly logger = new Logger(VisitasTecnicasService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll(filters?: { puesto_id?: number; tipo_visitante?: string; fecha_desde?: string }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `
        SELECT vt.*, p.nombre as puesto_nombre, u.nombre as registrado_por_nombre
        FROM visitas_tecnicas_puesto vt
        LEFT JOIN puestos_trabajo p ON vt.puesto_id = p.id
        LEFT JOIN usuarios_externos u ON vt.registrado_por = u.id
        WHERE 1=1
      `;

            if (filters?.puesto_id) query += ` AND vt.puesto_id = ${filters.puesto_id}`;
            if (filters?.tipo_visitante) query += ` AND vt.tipo_visitante = '${filters.tipo_visitante}'`;
            if (filters?.fecha_desde) query += ` AND vt.fecha_llegada >= '${filters.fecha_desde}'`;

            query += ` ORDER BY vt.fecha_llegada DESC`;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) throw new BadRequestException("Error al obtener visitas técnicas");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            this.logger.error("Error en findAll:", error);
            throw error;
        }
    }

    async findOne(id: number) {
        try {
            const supabase = this.supabaseService.getClient();
            const query = `
        SELECT vt.*, p.nombre as puesto_nombre
        FROM visitas_tecnicas_puesto vt
        LEFT JOIN puestos_trabajo p ON vt.puesto_id = p.id
        WHERE vt.id = ${id}
      `;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) throw new BadRequestException("Error al obtener visita técnica");
            const result = Array.isArray(data) ? data : [];
            if (result.length === 0) throw new NotFoundException(`Visita técnica ${id} no encontrada`);

            return result[0];
        } catch (error) {
            this.logger.error(`Error en findOne(${id}):`, error);
            throw error;
        }
    }

    async create(createDto: CreateVisitaTecnicaDto, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();

            const { data, error } = await supabase
                .from("visitas_tecnicas_puesto")
                .insert({
                    puesto_id: createDto.puesto_id,
                    tipo_visitante: createDto.tipo_visitante,
                    nombre_visitante: createDto.nombre_visitante,
                    empresa: createDto.empresa || null,
                    motivo_visita: createDto.motivo_visita || null,
                    registrado_por: userId,
                    foto_evidencia_url: createDto.foto_evidencia_url || null,
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error al registrar visita técnica");

            this.logger.log(`✅ Visita técnica registrada: ${data.id}`);
            return data;
        } catch (error) {
            this.logger.error("Error en create:", error);
            throw error;
        }
    }

    async registrarSalida(id: number, updateDto: UpdateVisitaTecnicaDto) {
        try {
            const supabase = this.supabaseService.getClient();

            const { data, error } = await supabase
                .from("visitas_tecnicas_puesto")
                .update({
                    fecha_salida: new Date().toISOString(),
                    resultado_observaciones: updateDto.resultado_observaciones || null,
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al registrar salida de visita técnica");

            this.logger.log(`✅ Salida de visita técnica ${id} registrada`);
            return data;
        } catch (error) {
            this.logger.error(`Error en registrarSalida(${id}):`, error);
            throw error;
        }
    }

    async subirEvidencia(id: number, url: string) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("visitas_tecnicas_puesto")
            .update({ foto_evidencia_url: url })
            .eq("id", id)
            .select()
            .single();

        if (error) throw new BadRequestException("Error subiendo evidencia");
        return data;
    }

    async getReportes(filtros: any) {
        const supabase = this.supabaseService.getClient();
        // Simple count por ahora
        const { count } = await supabase.from("visitas_tecnicas_puesto").select("*", { count: "exact", head: true });
        return { total_visitas_tecnicas: count || 0 };
    }
}
