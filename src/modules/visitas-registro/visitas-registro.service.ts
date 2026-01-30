import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateVisitaRegistroDto, RegistrarSalidaDto } from "./dto/visita.dto";
import { ListasAccesoService } from "../listas-acceso/listas-acceso.service";
import { randomUUID } from 'crypto';

@Injectable()
export class VisitasRegistroService {
    private readonly logger = new Logger(VisitasRegistroService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly listasAccesoService: ListasAccesoService
    ) { }

    // 1️⃣ Crear una Invitación (Residente -> Visitante)
    async crearInvitacion(createDto: { puesto_id: number; residente_id: number; visitante_id?: number; nombre_visitante?: string; documento_visitante?: string; fecha_esperada: string; observacion?: string }) {
        try {
            const supabase = this.supabaseService.getClient();

            // Generar token único para QR (uuid simple o hash)
            const token = randomUUID();

            // Si no existe el visitante ID pero dan datos, se podría crear (opcional),
            // por ahora asumimos enlace a visitante_id o texto libre si es "invitado rápido".
            // Para consistencia v1, exigimos visitante_id o datos mínimos.

            const { data, error } = await supabase.from("visitas_registro").insert({
                puesto_id: createDto.puesto_id,
                residente_destino_id: createDto.residente_id,
                visitante_id: createDto.visitante_id || null, // Puede ser null si es "Invitado X"
                nombre_visitante_temporal: createDto.nombre_visitante, // Nuevo campo sugerido en BD para invitados casuales
                fecha_entrada: null,
                fecha_salida: null,
                estado: 'programada',
                token_qr: token,
                fecha_esperada: createDto.fecha_esperada,
                observaciones: createDto.observacion
            }).select().single();

            if (error) throw new BadRequestException("Error creando invitación");
            return { ...data, link_acceso: `https://tu-app.com/acceso/${token}` };
        } catch (e) { throw e; }
    }

    // 2️⃣ Validar Ingreso por Token (Vigilante escanea QR)
    async validarIngresoPorToken(token: string, guardiaId: number) {
        const supabase = this.supabaseService.getClient();

        const { data: visita } = await supabase.from("visitas_registro")
            .select("*")
            .eq("token_qr", token)
            .eq("estado", "programada")
            .single();

        if (!visita) throw new NotFoundException("Invitación no válida o ya utilizada");

        // Verificar vigencia (Ej: fecha_esperada es hoy)
        const hoy = new Date().toISOString().split('T')[0];
        if (visita.fecha_esperada && !visita.fecha_esperada.startsWith(hoy)) {
            // throw new BadRequestException("La invitación no es para hoy"); // Opcional
        }

        // Activar visita (Ingreso)
        const { data, error } = await supabase.from("visitas_registro")
            .update({
                estado: 'activo',
                fecha_entrada: new Date().toISOString(),
                guardia_entrada_id: guardiaId,
                token_qr: null // Quemar token para evitar reuso
            })
            .eq("id", visita.id)
            .select().single();

        if (error) throw new BadRequestException("Error procesando ingreso");
        return data;
    }

    async create(createDto: CreateVisitaRegistroDto, guardiaId: number) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Obtener documento del visitante (necesario para validaciones)
            const { data: visitante } = await supabase
                .from("visitantes")
                .select("documento")
                .eq("id", createDto.visitante_id)
                .single();

            if (!visitante) throw new BadRequestException("Visitante no encontrado");

            // 2. Validación Listas de Acceso (Negra/Blanca)
            const checkLista = await this.listasAccesoService.verificarDocumento(visitante.documento, createDto.puesto_id);

            if (checkLista.en_lista && checkLista.tipo_lista === 'negra') {
                throw new ForbiddenException(`⛔ BLOQUEADO: Visitante en LISTA NEGRA. Motivo: ${checkLista.motivo}`);
            }

            // 3. Validación: Una visita activa
            // No permitir nueva entrada si ya tiene una activa en este puesto (o global, depende regla)
            const { data: visitaActiva } = await supabase
                .from("visitas_registro")
                .select("id")
                .eq("visitante_id", createDto.visitante_id)
                .eq("estado", "activo")
                .single();

            // Permitir reingreso si es el mismo día y salió? No, si estado es activo no ha salido.
            if (visitaActiva) {
                throw new BadRequestException("⚠️ El visitante ya tiene una entrada ACTIVA sin salida registrada.");
            }

            // 4. Registrar Entrada
            const { data, error } = await supabase
                .from("visitas_registro")
                .insert({
                    ...createDto,
                    guardia_entrada_id: guardiaId,
                    fecha_entrada: new Date().toISOString(),
                    estado: 'activo'
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error al registrar entrada");
            return data;
        } catch (error) {
            this.logger.error("Error create visita:", error);
            throw error;
        }
    }

    async registrarSalida(id: number, guardiaId: number, dto?: RegistrarSalidaDto) {
        try {
            const supabase = this.supabaseService.getClient();

            // Validar que exista y sea activa
            const { data: visita } = await supabase.from("visitas_registro").select("estado").eq("id", id).single();

            if (!visita || visita.estado !== 'activo') {
                throw new BadRequestException("La visita no existe o ya fue finalizada");
            }

            const { data, error } = await supabase
                .from("visitas_registro")
                .update({
                    fecha_salida: new Date().toISOString(),
                    guardia_salida_id: guardiaId,
                    estado: 'finalizado',
                    observaciones: dto?.observaciones // Append observacion if logic required, or overwrite
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error registrargo salida");
            return data;
        } catch (error) { throw error; }
    }

    // ... métodos de consulta findAll, getVisitasActivas sin cambias mayores
    async findAll(filters: any) {
        const supabase = this.supabaseService.getClient();
        let query = `
        SELECT vr.*, v.nombre_completo as visitante_nombre, v.documento as visitante_documento,
               r.nombre_completo as residente_nombre
        FROM visitas_registro vr
        LEFT JOIN visitantes v ON vr.visitante_id = v.id
        LEFT JOIN residentes r ON vr.residente_destino_id = r.id
        WHERE 1=1
      `;
        // Filters implementation
        if (filters?.puesto_id) query += ` AND vr.puesto_id = ${filters.puesto_id}`;
        if (filters?.estado) query += ` AND vr.estado = '${filters.estado}'`;
        if (filters?.residente_id) query += ` AND vr.residente_destino_id = ${filters.residente_id}`; // Historial residente
        if (filters?.visitante_id) query += ` AND vr.visitante_id = ${filters.visitante_id}`; // Historial visitante

        query += ` ORDER BY vr.created_at DESC LIMIT 100`;

        const { data } = await supabase.rpc("exec_sql", { query });
        return data || [];
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const query = `
        SELECT vr.*, v.nombre_completo, v.documento, v.foto_url
        FROM visitas_registro vr
        LEFT JOIN visitantes v ON vr.visitante_id = v.id
        WHERE vr.id = ${id}
     `;
        const { data } = await supabase.rpc("exec_sql", { query });
        return data?.[0];
    }

    async getVisitasActivas(puestoId: number) {
        return this.findAll({ puesto_id: puestoId, estado: 'activo' });
    }

    async getReportesVisitas(filtros: any) {
        const supabase = this.supabaseService.getClient();
        // Estadísticas básicas
        const { count: total } = await supabase.from("visitas_registro").select("*", { count: "exact", head: true });
        const { count: activas } = await supabase.from("visitas_registro").select("*", { count: "exact", head: true }).eq("estado", "activo");

        // Más lógica de reportes podría ir aquí (por día, por puesto)
        return {
            total_historico: total || 0,
            activas_actualmente: activas || 0,
            filtros_aplicados: filtros
        };
    }
}
