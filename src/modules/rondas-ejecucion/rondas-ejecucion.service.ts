import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { MinutasService } from "../minutas/minutas.service";
import type { IniciarRondaDto, RegistrarPuntoDto, FinalizarRondaDto } from "./dto/ejecucion.dto";

@Injectable()
export class RondasEjecucionService {
    private readonly logger = new Logger(RondasEjecucionService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly minutasService: MinutasService
    ) { }

    async iniciarRonda(dto: IniciarRondaDto, ronderoId: number) {
        // Validar que la ronda tenga puntos definidos ("Ronda válida")
        const supabase = this.supabaseService.getClient();
        const { count } = await supabase.from("rondas_puntos")
            .select("*", { count: "exact", head: true })
            .eq("ronda_definicion_id", dto.ronda_definicion_id);

        if (!count || count === 0) throw new BadRequestException("No se puede iniciar una ronda sin puntos definidos");

        const { data, error } = await supabase.from("rondas_ejecucion").insert({
            ronda_definicion_id: dto.ronda_definicion_id, rondero_id: ronderoId, fecha_inicio: new Date().toISOString()
        }).select().single();

        if (error) throw new BadRequestException("Error iniciar ronda");
        return data;
    }

    async registrarPunto(dto: RegistrarPuntoDto) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Obtener información del punto y su orden
            const { data: puntoActual } = await supabase
                .from("rondas_puntos")
                .select("orden, ronda_definicion_id")
                .eq("id", dto.punto_id)
                .single();

            if (!puntoActual) throw new BadRequestException("Punto no válido");

            // 2. Verificar que pertenece a la ronda en ejecución
            const { data: ejecucion } = await supabase
                .from("rondas_ejecucion")
                .select("ronda_definicion_id, estado")
                .eq("id", dto.ronda_ejecucion_id)
                .single();

            if (!ejecucion || ejecucion.ronda_definicion_id !== puntoActual.ronda_definicion_id) {
                throw new BadRequestException("El punto no pertenece a esta ronda");
            }
            if (ejecucion.estado !== 'en_proceso') throw new BadRequestException("La ronda no está en proceso");

            // 3. SECUENCIA OBLIGATORIA: Validar que el punto anterior (orden-1) esté completado
            if (puntoActual.orden > 1) {
                // Buscar el punto anterior
                const { data: prevPoint } = await supabase
                    .from("rondas_puntos")
                    .select("id")
                    .eq("ronda_definicion_id", puntoActual.ronda_definicion_id)
                    .eq("orden", puntoActual.orden - 1)
                    .single();

                if (prevPoint) {
                    // Verificar si ese punto ya fue registrado en esta ejecución
                    const { data: registroPrevio } = await supabase
                        .from("rondas_registros")
                        .select("id")
                        .eq("ronda_ejecucion_id", dto.ronda_ejecucion_id)
                        .eq("punto_id", prevPoint.id)
                        .single();

                    if (!registroPrevio) {
                        throw new BadRequestException(`🚫 SECUENCIA INCORRECTA: Debe completar el punto ${puntoActual.orden - 1} antes del ${puntoActual.orden}`);
                    }
                }
            }

            // 4. Registrar
            const { data, error } = await supabase
                .from("rondas_registros")
                .insert({
                    ...dto,
                    fecha_registro: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error registrar punto");
            return data;
        } catch (error) {
            this.logger.error("Error registrarPunto:", error);
            throw error;
        }
    }

    async finalizarRonda(id: number, dto: FinalizarRondaDto) {
        // Al finalizar, se podría validar si faltaron puntos ("incompleta")
        const supabase = this.supabaseService.getClient();

        // Contar puntos totales vs registrados
        // ... logic simplified

        const { data, error } = await supabase
            .from("rondas_ejecucion")
            .update({ fecha_fin: new Date().toISOString(), estado: dto.estado || 'completada', observaciones: dto.observaciones })
            .eq("id", id)
            .select(`*, ronda_definicion:ronda_definicion_id ( nombre, puesto_id )`)
            .single();

        // 📝 REGISTRAR EN MINUTA
        try {
            if (data?.ronda_definicion?.puesto_id) {
                await this.minutasService.create({
                    puesto_id: data.ronda_definicion.puesto_id,
                    contenido: `Ronda finalizada: ${data.ronda_definicion.nombre}. Estado: ${dto.estado || 'completada'}. Observaciones: ${dto.observaciones || 'Sin observaciones'}`,
                    tipo: 'ronda',
                    titulo: `Cierre de Ronda - ${data.ronda_definicion.nombre}`,
                    fecha: new Date().toISOString().split('T')[0],
                    hora: new Date().toISOString().split('T')[1].split('.')[0],
                    visible_para_cliente: true
                }, data.rondero_id); // Asumiendo rondero_id es usuario compatible o mapear
            }
        } catch (e) {
            this.logger.error("Error creando minuta automática de ronda", e);
            // No fallar la ronda si falla la minuta
        }

        return data;
    }

    // Methods getProgreso, findAll ...
    async getProgreso(id: number) {
        const supabase = this.supabaseService.getClient();
        const { count: total } = await supabase.from("rondas_puntos").select("*", { count: 'exact', head: true }).eq("ronda_definicion_id", id); // Deberia ser ejecución->definicion->puntos, simplificado aqui
        // TODO: Corregir lógica de total puntos: obtener de definición asociada a ejecución
        const { count: registrados } = await supabase.from("rondas_registros").select("*", { count: 'exact', head: true }).eq("ronda_ejecucion_id", id);
        return { total, registrados, porcentaje: total ? ((registrados || 0) / total) * 100 : 0 };
    }

    async findAll(filters?: any) {
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase.from("rondas_ejecucion").select("*").order('created_at', { ascending: false });
        return data || [];
    }

    async getIncumplidas() {
        const supabase = this.supabaseService.getClient();
        // Buscar rondas marcadas como incompletas o fallidas
        const { data } = await supabase
            .from("rondas_ejecucion")
            .select("*, ronda_definicion:ronda_definicion_id(nombre)")
            .neq("estado", "completada")
            .neq("estado", "en_proceso") // Excluir las que están ocurriendo
            .order("created_at", { ascending: false });

        return data || [];
    }

    async getReportes(filtros?: any) {
        const supabase = this.supabaseService.getClient();
        // Estadísticas agregadas
        const { count: total } = await supabase.from("rondas_ejecucion").select("*", { count: "exact", head: true });
        const { count: ok } = await supabase.from("rondas_ejecucion").select("*", { count: "exact", head: true }).eq("estado", "completada");
        const { count: fail } = await supabase.from("rondas_ejecucion").select("*", { count: "exact", head: true }).neq("estado", "completada").neq("estado", "en_proceso");

        return {
            total_rondas: total || 0,
            completadas: ok || 0,
            fallidas: fail || 0,
            tasa_cumplimiento: total ? ((ok || 0) / total) * 100 : 0
        };
    }
}
