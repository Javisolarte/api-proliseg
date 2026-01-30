import { Injectable, NotFoundException, Logger, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateVisitanteDto, UpdateVisitanteDto } from "./dto/visitante.dto";

@Injectable()
export class VisitantesService {
    private readonly logger = new Logger(VisitantesService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async createOrUpdate(createDto: CreateVisitanteDto) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Identidad Única Global: Verificar por documento
            const { data: existing } = await supabase
                .from("visitantes")
                .select("*")
                .eq("documento", createDto.documento)
                .single();

            if (existing) {
                // 2. Actualización Automática (Historial/Reingreso)
                // Si ya existe, actualizamos sus datos (ej: foto nueva, empresa nueva)
                // y devolvemos el ID existente.
                const { data: updated, error } = await supabase
                    .from("visitantes")
                    .update({
                        nombre_completo: createDto.nombre_completo,
                        empresa_arl: createDto.empresa_arl || existing.empresa_arl,
                        foto_url: createDto.foto_url || existing.foto_url, // Si traen nueva foto, actualiza
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", existing.id)
                    .select()
                    .single();

                this.logger.log(`🔄 Visitante existente ${existing.documento} actualizado automáticamente.`);
                return updated;
            }

            // Si no existe, crear nuevo
            const { data, error } = await supabase
                .from("visitantes")
                .insert({
                    documento: createDto.documento,
                    nombre_completo: createDto.nombre_completo,
                    empresa_arl: createDto.empresa_arl,
                    foto_url: createDto.foto_url
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error crear visitante");

            this.logger.log(`✅ Nuevo visitante creado: ${data.id}`);
            return data;

        } catch (error) {
            this.logger.error("Error createOrUpdate:", error);
            throw error;
        }
    }

    // Se mantiene findByDocumento y update manual para backoffice
    async findByDocumento(doc: string) {
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase.from("visitantes").select("*").eq("documento", doc).single();
        if (!data) throw new NotFoundException("Visitante no encontrado");
        return data;
    }

    async findAll(search?: string) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("visitantes").select("*").order("updated_at", { ascending: false }).limit(50);

        if (search) {
            query = query.ilike('nombre_completo', `%${search}%`);
        }
        const { data, error } = await query;
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("visitantes").select("*").eq("id", id).single();
        if (!data) throw new NotFoundException();
        return data;
    }

    async update(id: number, dto: UpdateVisitanteDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("visitantes").update(dto).eq("id", id).select().single();
        if (error) throw new BadRequestException();
        return data;
    }
}
