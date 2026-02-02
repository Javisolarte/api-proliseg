import { Injectable, NotFoundException, Logger, BadRequestException, ConflictException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreatePlantillaDto, UpdatePlantillaDto } from "./dto/plantilla.dto";

@Injectable()
export class PlantillasService {
    private readonly logger = new Logger(PlantillasService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createDto: CreatePlantillaDto, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();

            const { data, error } = await supabase
                .from("plantillas_documentos")
                .insert({
                    nombre: createDto.nombre,
                    tipo: createDto.tipo,
                    contenido_html: createDto.contenido_html,
                    variables_requeridas: createDto.variables_requeridas,
                    creado_por: userId,
                    version: 1,
                    activa: true
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error al crear plantilla");
            return data;
        } catch (error) {
            this.logger.error("Error en create:", error);
            throw error;
        }
    }

    async update(id: number, updateDto: UpdatePlantillaDto, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Verificar si existen documentos generados con esta plantilla
            const { count } = await supabase
                .from("documentos_generados")
                .select("*", { count: "exact", head: true })
                .eq("plantilla_id", id)
                .neq("estado", "borrador");

            if (count && count > 0) {
                // Trazabilidad legal: Si ya se usó, no se debe editar, sino versionar.
                // Opción A: Bloquear edición (solicitado: "NO permitir editar plantilla")
                // Opción B: Versionar automáticamente (solicitado: "Al editar → crear nueva versión")

                // Vamos a implementar Versionamiento: Desactivar actual y crear nueva versión
                const { data: current } = await supabase.from("plantillas_documentos").select("*").eq("id", id).single();

                if (!current) throw new NotFoundException("Plantilla no encontrada");

                // Desactivar anterior
                await supabase.from("plantillas_documentos").update({ activa: false }).eq("id", id);

                // Crear nueva versión
                const { data: newVersion, error } = await supabase
                    .from("plantillas_documentos")
                    .insert({
                        nombre: updateDto.nombre || current.nombre,
                        tipo: updateDto.tipo || current.tipo,
                        contenido_html: updateDto.contenido_html || current.contenido_html,
                        variables_requeridas: updateDto.variables_requeridas || current.variables_requeridas,
                        creado_por: userId,
                        version: current.version + 1,
                        activa: true
                    })
                    .select()
                    .single();

                if (error) throw new BadRequestException("Error al crear nueva versión de plantilla");

                this.logger.log(`✅ Plantilla ${id} versionada a nueva ID ${newVersion.id}`);
                return newVersion;
            }

            // Si no tiene documentos asociados, edición directa permitida
            const updates: any = { ...updateDto, updated_at: new Date().toISOString() };
            const { data, error } = await supabase
                .from("plantillas_documentos")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al actualizar plantilla");
            return data;
        } catch (error) {
            this.logger.error(`Error en update(${id}):`, error);
            throw error;
        }
    }

    async validateVariables(id: number, datosJson: any) {
        const supabase = this.supabaseService.getClient();
        const { data: plantilla } = await supabase.from("plantillas_documentos").select("variables_requeridas").eq("id", id).single();

        if (!plantilla) throw new NotFoundException("Plantilla no encontrada");

        const required = plantilla.variables_requeridas as string[];
        const provided = Object.keys(datosJson);

        // Filter out placeholders that are injected by the system (firma_1, huella_1, etc.)
        const missing = required.filter(v =>
            !provided.includes(v) &&
            !v.startsWith('firma_') &&
            !v.startsWith('huella_')
        );

        if (missing.length > 0) {
            throw new BadRequestException(`Faltan variables requeridas: ${missing.join(", ")}`);
        }
        return true;
    }

    // ... resto de métodos (findAll, findOne) se mantienen igual
    async findAll(filters?: any) { /* implementation from previous steps */
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("plantillas_documentos").select("*").eq("activa", true);
        if (filters?.tipo) query = query.eq("tipo", filters.tipo);
        const { data, error } = await query;
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("plantillas_documentos").select("*").eq("id", id).single();
        if (error) throw new NotFoundException("Plantilla no encontrada");
        return data;
    }
    async softDelete(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from("plantillas_documentos").update({ activa: false }).eq("id", id);
        if (error) throw new BadRequestException("Error desactivando plantilla");
        return { success: true };
    }

    async renderPreview(id: number, data: any) {
        const plantilla = await this.findOne(id);
        let html = plantilla.contenido_html;
        if (data) {
            for (const key of Object.keys(data)) {
                html = html.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
            }
        }
        return { html };
    }

    async obtenerVersiones(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data: actual } = await supabase.from("plantillas_documentos").select("nombre").eq("id", id).single();
        if (!actual) throw new NotFoundException("Plantilla no encontrada");

        const { data } = await supabase
            .from("plantillas_documentos")
            .select("id, version, created_at, activa, creado_por, tipo")
            .eq("nombre", actual.nombre)
            .order("version", { ascending: false });

        return data;
    }

    async crearNuevaVersionManual(id: number, userId: number) {
        const current = await this.findOne(id);
        const supabase = this.supabaseService.getClient();

        // Desactivar actual
        await supabase.from("plantillas_documentos").update({ activa: false }).eq("id", id);

        // Crear nueva versión clonada
        const { data: newVersion, error } = await supabase
            .from("plantillas_documentos")
            .insert({
                nombre: current.nombre,
                tipo: current.tipo,
                contenido_html: current.contenido_html,
                variables_requeridas: current.variables_requeridas,
                creado_por: userId,
                version: (current.version || 1) + 1,
                activa: true
            })
            .select()
            .single();

        if (error) throw new BadRequestException("Error al crear versión");
        return newVersion;
    }

    async activarVersion(id: number) {
        const target = await this.findOne(id);
        const supabase = this.supabaseService.getClient();

        // Desactivar todas las del grupo (por nombre)
        await supabase
            .from("plantillas_documentos")
            .update({ activa: false })
            .eq("nombre", target.nombre);

        // Activar target
        const { data, error } = await supabase
            .from("plantillas_documentos")
            .update({ activa: true })
            .eq("id", id)
            .select()
            .single();

        if (error) throw new BadRequestException("Error al activar versión");
        return data;
    }
}
