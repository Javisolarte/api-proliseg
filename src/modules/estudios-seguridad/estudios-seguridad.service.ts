import { Injectable, NotFoundException, Logger, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateEstudioSeguridadDto, UpdateEstudioSeguridadDto, EstadoEstudio } from "./dto/estudios-seguridad.dto";

@Injectable()
export class EstudiosSeguridadService {
    private readonly logger = new Logger(EstudiosSeguridadService.name);
    private readonly BUCKET = "estudios-seguridad";

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * 🔹 Subir archivo a Supabase Storage
     */
    private async uploadFile(file: any, puestoId: number): Promise<string> {
        const supabase = this.supabaseService.getSupabaseAdminClient();
        const timestamp = new Date().getTime();
        const fileName = `estudio_${timestamp}.pdf`;
        const path = `puesto_${puestoId}/${fileName}`;

        this.logger.debug(`📤 Subiendo archivo a: ${this.BUCKET}/${path}`);

        const { data, error } = await supabase.storage
            .from(this.BUCKET)
            .upload(path, file.buffer, {
                contentType: "application/pdf",
                upsert: true,
            });

        if (error) {
            this.logger.error(`❌ Error subiendo estudio: ${error.message}`);
            throw error;
        }

        return path; // Retornar el path exacto usado para la subida
    }

    /**
     * 🔹 Obtener URL firmada
     */
    async getSignedUrl(path: string): Promise<string> {
        this.logger.debug(`🔑 Generando URL firmada para path: ${path} en bucket: ${this.BUCKET}`);
        const supabase = this.supabaseService.getSupabaseAdminClient();

        // Limpiar path de posibles slashes iniciales
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;

        const { data, error } = await supabase.storage
            .from(this.BUCKET)
            .createSignedUrl(cleanPath, 3600); // 1 hora de validez

        if (error) {
            this.logger.error(`❌ Error generando URL firmada para ${cleanPath}: ${error.message}`);
            // Retornar null o lanzar error según prefieras, aquí lanzamos para depurar
            throw error;
        }

        this.logger.debug(`✅ URL firmada generada exitosamente`);
        return data.signedUrl;
    }

    /**
     * 🔹 Crear nuevo estudio (con subida de PDF)
     */
    async create(dto: CreateEstudioSeguridadDto, file: any, userId: number) {
        if (!file) throw new BadRequestException("El archivo PDF es requerido");

        const supabase = this.supabaseService.getClient();

        // 1. Si el nuevo estudio es 'vigente', marcar los anteriores como 'vencido'
        if (dto.estado === EstadoEstudio.VIGENTE || !dto.estado) {
            this.logger.debug(`🔄 Marcando estudios anteriores como vencidos para puesto ${dto.puesto_id}`);
            await supabase
                .from("puestos_estudios_seguridad")
                .update({ estado: EstadoEstudio.VENCIDO })
                .eq("puesto_id", dto.puesto_id)
                .eq("estado", EstadoEstudio.VIGENTE);
        }

        // 2. Subir archivo
        const filePath = await this.uploadFile(file, dto.puesto_id);

        // 3. Guardar en base de datos
        const { data, error } = await supabase
            .from("puestos_estudios_seguridad")
            .insert({
                ...dto,
                url_documento: filePath,
                estado: dto.estado || EstadoEstudio.VIGENTE,
                creado_por: userId,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`❌ Error al crear registro en BD: ${error.message}`);
            throw error;
        }

        return data;
    }

    /**
     * 🔹 Listar estudios por puesto
     */
    async findAllByPuesto(puestoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("puestos_estudios_seguridad")
            .select("*")
            .eq("puesto_id", puestoId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Generar URLs firmadas para cada uno (opcional, o se puede hacer bajo demanda)
        const results = await Promise.all((data || []).map(async (estudio) => ({
            ...estudio,
            signed_url: await this.getSignedUrl(estudio.url_documento)
        })));

        return results;
    }

    /**
     * 🔹 Obtener un estudio por ID
     */
    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("puestos_estudios_seguridad")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) throw new NotFoundException(`Estudio ID ${id} no encontrado`);

        const signedUrl = await this.getSignedUrl(data.url_documento);

        return {
            ...data,
            signed_url: signedUrl
        };
    }

    /**
     * 🔹 Eliminar estudio (marcar como anulado)
     */
    async remove(id: number, soft: boolean = true) {
        const supabase = this.supabaseService.getClient();

        if (soft) {
            const { data, error } = await supabase
                .from("puestos_estudios_seguridad")
                .update({ estado: EstadoEstudio.ANULADO })
                .eq("id", id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            // Opcional: Eliminar archivo del bucket? 
            // El requerimiento dice: "Opcional: marcar como anulado"
            const { error } = await supabase
                .from("puestos_estudios_seguridad")
                .delete()
                .eq("id", id);
            if (error) throw error;
            return { message: "Estudio eliminado físicamente" };
        }
    }
}
