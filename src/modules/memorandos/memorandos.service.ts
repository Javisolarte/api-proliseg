import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import {
    CreateMemorandoDto,
    UpdateMemorandoDto,
    AssignMemorandoDto,
    SignMemorandoDto,
    CreateAttachmentDto,
    MemorandoEstado
} from "./dto/memorando.dto";

@Injectable()
export class MemorandosService {
    private readonly logger = new Logger(MemorandosService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    private async uploadFile(file: any, bucket: string, path: string): Promise<string> {
        const supabase = this.supabaseService.getSupabaseAdminClient();
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
            });

        if (error) {
            this.logger.error(`❌ Error subiendo archivo a ${bucket}: ${JSON.stringify(error)}`);
            throw error;
        }

        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
        return publicUrlData.publicUrl;
    }

    private async createHistory(memorandoId: number, accion: string, realizadoPor: number, observacion?: string) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase
            .from("memorandos_historial")
            .insert({
                memorando_id: memorandoId,
                accion,
                realizado_por: realizadoPor,
                observacion,
                created_at: new Date().toISOString()
            });

        if (error) {
            this.logger.error(`Error al crear historial para memorando ${memorandoId}: ${error.message}`);
        }
    }

    async findAll(filters: any) {
        this.logger.log("🔍 Consultando memorandos...");
        const supabase = this.supabaseService.getClient();
        let query = supabase
            .from("memorandos")
            .select(`
        *,
        creado_por_usuario:usuarios_externos!creado_por(nombre_completo, correo),
        empleados_asignados:memorandos_empleados(
          id,
          estado,
          empleado:empleados(nombre_completo)
        ),
        adjuntos:memorandos_adjuntos(url, tipo)
      `)
            .order("created_at", { ascending: false });

        if (filters.estado) query = query.eq("estado", filters.estado);
        if (filters.tipo) query = query.eq("tipo", filters.tipo);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        this.logger.log(`🔍 Consultando detalle de memorando ${id}`);
        const supabase = this.supabaseService.getClient();

        // 1. Obtener memorando base
        const { data: memorando, error: memoError } = await supabase
            .from("memorandos")
            .select(`
        *,
        creado_por_usuario:usuarios_externos!creado_por(nombre_completo, correo),
        adjuntos:memorandos_adjuntos(*),
        empleados_asignados:memorandos_empleados(
          *,
          empleado:empleados(*)
        )
      `)
            .eq("id", id)
            .single();

        if (memoError || !memorando) {
            throw new NotFoundException(`Memorando con ID ${id} no encontrado`);
        }

        // 2. Obtener historial
        const { data: historial } = await supabase
            .from("memorandos_historial")
            .select(`
        *,
        realizado_por_usuario:usuarios_externos(nombre_completo)
      `)
            .eq("memorando_id", id)
            .order("created_at", { ascending: false });

        return { ...memorando, historial };
    }

    async create(dto: CreateMemorandoDto, userId: number) {
        this.logger.log(`🆕 Creando memorando por usuario ${userId}`);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from("memorandos")
            .insert({
                ...dto,
                creado_por: userId,
                estado: MemorandoEstado.BORRADOR
            })
            .select()
            .single();

        if (error) throw error;

        await this.createHistory(data.id, "creado", userId, "Memorando creado en estado borrador");
        return data;
    }

    async update(id: number, dto: UpdateMemorandoDto, userId: number) {
        this.logger.log(`🛠️ Actualizando memorando ${id}`);
        const supabase = this.supabaseService.getClient();

        const { data: existing } = await supabase
            .from("memorandos")
            .select("estado")
            .eq("id", id)
            .single();

        if (existing?.estado !== MemorandoEstado.BORRADOR) {
            throw new BadRequestException("Solo se pueden editar memorandos en estado borrador");
        }

        const { data, error } = await supabase
            .from("memorandos")
            .update({ ...dto, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async assign(id: number, dto: AssignMemorandoDto, userId: number) {
        this.logger.log(`👥 Asignando empleados al memorando ${id}`);
        const supabase = this.supabaseService.getClient();

        const assignments = dto.empleados_ids.map(empId => ({
            memorando_id: id,
            empleado_id: empId,
            estado: "pendiente"
        }));

        const { error } = await supabase
            .from("memorandos_empleados")
            .upsert(assignments, { onConflict: 'memorando_id,empleado_id' });

        if (error) throw error;

        await this.createHistory(id, "enviado", userId, `Asignado a ${dto.empleados_ids.length} empleados`);
        return { message: "Empleados asignados exitosamente" };
    }

    async send(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();

        const { error } = await supabase
            .from("memorandos")
            .update({ estado: MemorandoEstado.ENVIADO, fecha_emision: new Date().toISOString() })
            .eq("id", id);

        if (error) throw error;

        await this.createHistory(id, "enviado", userId, "Memorando enviado a los empleados asignados");
        return { message: "Memorando enviado exitosamente" };
    }

    async markAsRead(memoEmpleadoId: number, userId: number) {
        const supabase = this.supabaseService.getClient();

        const { data: me, error: findError } = await supabase
            .from("memorandos_empleados")
            .select("memorando_id, estado")
            .eq("id", memoEmpleadoId)
            .single();

        if (findError || !me) throw new NotFoundException("Asignación no encontrada");

        if (me.estado === 'pendiente') {
            await supabase
                .from("memorandos_empleados")
                .update({ estado: "leido", fecha_leido: new Date().toISOString() })
                .eq("id", memoEmpleadoId);

            await this.createHistory(me.memorando_id, "leido", userId, "Empleado leyó el memorando");
        }

        return { message: "Marcado como leído" };
    }

    async sign(memoEmpleadoId: number, dto: SignMemorandoDto, ip: string) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener la relación memorando_empleado
        const { data: me, error: findError } = await supabase
            .from("memorandos_empleados")
            .select("*, memorando:memorandos(requiere_firma)")
            .eq("id", memoEmpleadoId)
            .single();

        if (findError || !me) throw new NotFoundException("Asignación no encontrada");

        // 2. Insertar firma
        const { error: firmaError } = await supabase
            .from("memorandos_firmas")
            .insert({
                memorando_empleado_id: memoEmpleadoId,
                metodo_firma: dto.metodo_firma || "digital",
                firma_base64: dto.firma_base64,
                dispositivo: dto.dispositivo,
                user_agent: dto.user_agent,
                ip_address: ip,
                fecha_firma: new Date().toISOString()
            });

        if (firmaError) throw firmaError;

        // 3. Actualizar estado de la asignación
        await supabase
            .from("memorandos_empleados")
            .update({
                estado: "firmado",
                fecha_firma: new Date().toISOString(),
                ip_firma: ip,
                observacion_empleado: dto.observacion_empleado
            })
            .eq("id", memoEmpleadoId);

        // 4. Crear historial
        await this.createHistory(me.memorando_id, "firmado", 0, "Empleado firmó el memorando digitalmente");

        return { message: "Memorando firmado exitosamente" };
    }

    async addAttachment(id: number, file: any, descripcion: string, userId: number) {
        this.logger.log(`📎 Subiendo adjunto para memorando ${id}`);
        const supabase = this.supabaseService.getClient();

        // 1. Obtener información del empleado asignado para el path
        const { data: asignacion, error: signError } = await supabase
            .from("memorandos_empleados")
            .select("empleado:empleados(cedula)")
            .eq("memorando_id", id)
            .limit(1)
            .single();

        if (signError || !asignacion) {
            this.logger.warn(`No se encontró empleado asignado para el memorando ${id}. Usando carpeta genérica.`);
        }

        const cedula = (asignacion?.empleado as any)?.cedula || "sin_asignar";
        const fileName = `${Date.now()}_${file.originalname}`;
        const path = `memorando_${cedula}/${fileName}`;

        // 2. Subir archivo
        const url = await this.uploadFile(file, "memorandos", path);

        // 3. Determinar tipo
        let tipo = "otro";
        if (file.mimetype.includes("image")) tipo = "imagen";
        else if (file.mimetype.includes("pdf")) tipo = "pdf";
        else if (file.mimetype.includes("audio")) tipo = "audio";
        else if (file.mimetype.includes("video")) tipo = "video";

        // 4. Guardar en BD
        const { data, error } = await supabase
            .from("memorandos_adjuntos")
            .insert({
                memorando_id: id,
                tipo,
                url,
                descripcion,
                creado_por: userId
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async close(id: number, userId: number) {
        this.logger.log(`🔒 Cerrando memorando ${id}`);
        const supabase = this.supabaseService.getClient();

        const { data: existing } = await supabase
            .from("memorandos")
            .select("estado")
            .eq("id", id)
            .single();

        if (!existing) throw new NotFoundException("Memorando no encontrado");

        if (existing.estado === MemorandoEstado.BORRADOR) {
            throw new BadRequestException("No se puede cerrar un memorando en borrador. Debe ser enviado primero.");
        }

        const { error } = await supabase
            .from("memorandos")
            .update({ estado: MemorandoEstado.CERRADO, updated_at: new Date().toISOString() })
            .eq("id", id);

        if (error) throw error;

        await this.createHistory(id, "cerrado", userId, "Memorando cerrado formalmente por administración");
        return { message: "Memorando cerrado exitosamente" };
    }

    async delete(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();

        // Solo permitir borrar si está en borrador
        const { data: existing } = await supabase
            .from("memorandos")
            .select("estado")
            .eq("id", id)
            .single();

        if (existing?.estado !== MemorandoEstado.BORRADOR) {
            await supabase.from("memorandos").update({ estado: MemorandoEstado.ANULADO }).eq("id", id);
            await this.createHistory(id, "anulado", userId, "Memorando anulado (no se puede eliminar por estar en curso)");
            return { message: "Memorando anulado" };
        }

        const { error } = await supabase.from("memorandos").delete().eq("id", id);
        if (error) throw error;
        return { message: "Memorando eliminado" };
    }
}
