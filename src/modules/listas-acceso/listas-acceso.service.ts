import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateListaAccesoDto } from "./dto/lista-acceso.dto";
import { ImportService } from "../../common/services/import.service";
import { CreateListaAccesoDto as CreateDto } from "./dto/lista-acceso.dto";

@Injectable()
export class ListasAccesoService {
    private readonly logger = new Logger(ListasAccesoService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly importService: ImportService
    ) { }

    async findAll(filters?: { puesto_id?: number; tipo_lista?: string; activo?: boolean }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `
        SELECT la.*, p.nombre as puesto_nombre
        FROM listas_acceso la
        LEFT JOIN puestos_trabajo p ON la.puesto_id = p.id
        WHERE 1=1
      `;

            if (filters?.puesto_id) query += ` AND la.puesto_id = ${filters.puesto_id}`;
            if (filters?.tipo_lista) query += ` AND la.tipo_lista = '${filters.tipo_lista}'`;
            if (filters?.activo !== undefined) query += ` AND la.activo = ${filters.activo}`;

            query += ` ORDER BY la.created_at DESC`;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) throw new BadRequestException("Error al obtener listas de acceso");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            this.logger.error("Error en findAll:", error);
            throw error;
        }
    }

    async create(createDto: CreateListaAccesoDto, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();

            // Validar que al menos documento o placa estén presentes
            if (!createDto.documento && !createDto.placa) {
                throw new BadRequestException("Debe proporcionar al menos un documento o placa");
            }

            const { data, error } = await supabase
                .from("listas_acceso")
                .insert({
                    puesto_id: createDto.puesto_id || null,
                    documento: createDto.documento || null,
                    placa: createDto.placa ? createDto.placa.toUpperCase() : null,
                    tipo_lista: createDto.tipo_lista,
                    motivo: createDto.motivo || null,
                    fecha_vencimiento: createDto.fecha_vencimiento || null,
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error al crear entrada en lista de acceso");

            this.logger.log(`✅ Entrada creada en lista de acceso: ${data.id}`);
            return data;
        } catch (error) {
            this.logger.error("Error en create:", error);
            throw error;
        }
    }

    async verificarDocumento(documento: string, puestoId?: number) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `
        SELECT tipo_lista, motivo, fecha_vencimiento, activo
        FROM listas_acceso
        WHERE documento = '${documento}'
        AND activo = true
        AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)
      `;

            if (puestoId) {
                query += ` AND (puesto_id = ${puestoId} OR puesto_id IS NULL)`;
            }

            query += ` ORDER BY tipo_lista DESC LIMIT 1`;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) throw new BadRequestException("Error al verificar lista de acceso");
            const result = Array.isArray(data) ? data : [];

            if (result.length === 0) {
                return { en_lista: false, tipo_lista: null, puede_ingresar: true };
            }

            const registro = result[0];
            return {
                en_lista: true,
                tipo_lista: registro.tipo_lista,
                puede_ingresar: registro.tipo_lista === 'blanca',
                motivo: registro.motivo,
                fecha_vencimiento: registro.fecha_vencimiento
            };
        } catch (error) {
            this.logger.error(`Error en verificarDocumento(${documento}):`, error);
            throw error;
        }
    }

    async verificarPlaca(placa: string, puestoId?: number) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `
        SELECT tipo_lista, motivo, fecha_vencimiento, activo
        FROM listas_acceso
        WHERE placa = '${placa.toUpperCase()}'
        AND activo = true
        AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)
      `;

            if (puestoId) {
                query += ` AND (puesto_id = ${puestoId} OR puesto_id IS NULL)`;
            }

            query += ` ORDER BY tipo_lista DESC LIMIT 1`;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) throw new BadRequestException("Error al verificar lista de acceso");
            const result = Array.isArray(data) ? data : [];

            if (result.length === 0) {
                return { en_lista: false, tipo_lista: null, puede_ingresar: true };
            }

            const registro = result[0];
            return {
                en_lista: true,
                tipo_lista: registro.tipo_lista,
                puede_ingresar: registro.tipo_lista === 'blanca',
                motivo: registro.motivo,
                fecha_vencimiento: registro.fecha_vencimiento
            };
        } catch (error) {
            this.logger.error(`Error en verificarPlaca(${placa}):`, error);
            throw error;
        }
    }

    async desactivar(id: number) {
        try {
            const supabase = this.supabaseService.getClient();

            const { data, error } = await supabase
                .from("listas_acceso")
                .update({ activo: false })
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al desactivar entrada");

            this.logger.log(`✅ Entrada ${id} desactivada`);
            return data;
        } catch (error) {
            this.logger.error(`Error en desactivar(${id}):`, error);
            throw error;
        }
    }

    async importarMasivo(datos: any[], userId: number) {
        if (!Array.isArray(datos) || datos.length === 0) {
            throw new BadRequestException("Datos inválidos para importación");
        }

        const supabase = this.supabaseService.getClient();
        // Mapear datos
        const registros = datos.map(d => ({
            puesto_id: d.puesto_id || null,
            documento: d.documento ? String(d.documento) : null,
            placa: d.placa ? String(d.placa).toUpperCase() : null,
            tipo_lista: d.tipo_lista || 'blanca',
            motivo: d.motivo || 'Importación masiva',
        }));

        const { data, error } = await supabase.from("listas_acceso").insert(registros).select();

        if (error) {
            this.logger.error("Error importación masiva:", error);
            throw new BadRequestException("Error importando datos: " + error.message);
        }

        return { procesados: registros.length, importados: data };
    }

    async importarExcel(buffer: Buffer, userId: number) {
        const mapping = {
            'Puesto ID': 'puesto_id',
            'Documento': 'documento',
            'Placa': 'placa',
            'Tipo Lista': 'tipo_lista',
            'Motivo': 'motivo',
            'Fecha Vencimiento': 'fecha_vencimiento'
        };

        const result = await this.importService.processExcel<CreateDto>(
            buffer,
            CreateDto,
            mapping
        );

        if (result.success.length > 0) {
            const supabase = this.supabaseService.getClient();
            const registros = result.success.map(reg => ({
                puesto_id: reg.puesto_id || null,
                documento: reg.documento ? String(reg.documento) : null,
                placa: reg.placa ? String(reg.placa).toUpperCase() : null,
                tipo_lista: reg.tipo_lista,
                motivo: reg.motivo || 'Importación masiva (Excel)',
                fecha_vencimiento: reg.fecha_vencimiento || null
            }));

            const { error } = await supabase.from("listas_acceso").insert(registros);
            if (error) {
                this.logger.error("Error al insertar registros validados:", error);
                throw new BadRequestException("Error al insertar registros: " + error.message);
            }
        }

        return {
            mensaje: "Procesamiento completado",
            ...result.summary,
            errores: result.errors
        };
    }

    async getHistorial() {
        const supabase = this.supabaseService.getClient();
        // Consultar auditoría
        const { data } = await supabase
            .from("auditoria")
            .select("*")
            .eq("entidad", "listas_acceso")
            .order("created_at", { ascending: false })
            .limit(100);

        return data || [];
    }
}
