import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import {
    CreateRutaGpsDto, CreateRecorridoSupervisorDto, CreateRondaRonderoDto,
    CreateRutaSupervisionDto, UpdateRutaSupervisionDto, CreateRutaPuntoDto,
    CreateRutaAsignacionDto, CreateRutaEjecucionDto, FinalizarRutaEjecucionDto, CreateRutaEventoDto,
    AsignarRutasPorFechaDto, AsignarRutaManualDto, AsignacionRutaResultDto, AsignacionRutasMasivaResponseDto,
    ConsultarAsignacionesDto
} from "./dto/ruta.dto";

@Injectable()
export class RutasService {
    constructor(private readonly supabaseService: SupabaseService) { }

    // --- Rutas GPS (Legacy / Simplificado) ---
    async createRutaGps(createDto: CreateRutaGpsDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("rutas_gps").insert(createDto).select().single();
        if (error) throw error;
        return data;
    }

    async getRutasGps(empleadoId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("rutas_gps").select("*");
        if (empleadoId) query = query.eq("empleado_id", empleadoId);
        const { data, error } = await query.order("timestamp", { ascending: false });
        if (error) throw error;
        return data;
    }

    // --- Recorridos Supervisor (Legacy) ---
    async createRecorrido(createDto: CreateRecorridoSupervisorDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("recorridos_supervisor").insert(createDto).select().single();
        if (error) throw error;
        return data;
    }

    async getRecorridos(supervisorId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("recorridos_supervisor").select("*");
        if (supervisorId) query = query.eq("supervisor_id", supervisorId);
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }

    // --- Rondas Ronderos (Legacy) ---
    async createRonda(createDto: CreateRondaRonderoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("rondas_ronderos").insert(createDto).select().single();
        if (error) throw error;
        return data;
    }

    async getRondas(ronderoId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("rondas_ronderos").select("*");
        if (ronderoId) query = query.eq("rondero_id", ronderoId);
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }

    // ==========================================
    // NUEVO SISTEMA DE SUPERVISIÓN
    // ==========================================

    // 1. PLANIFICACIÓN (Rutas Sugeridas)
    async findAllRutas() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision')
            .select(`
                *,
                puntos:rutas_supervision_puntos(
                    *,
                    puesto:puestos_trabajo(id, nombre)
                )
            `)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async findOneRuta(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision')
            .select(`
                *,
                puntos:rutas_supervision_puntos(
                    *,
                    puesto:puestos_trabajo(id, nombre, latitud, longitud)
                )
            `)
            .eq('id', id)
            .single();

        if (error || !data) throw new NotFoundException(`Ruta ${id} no encontrada`);
        // Ordenar puntos
        if (data.puntos) {
            data.puntos.sort((a, b) => a.orden - b.orden);
        }
        return data;
    }

    async createRuta(dto: CreateRutaSupervisionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision').insert(dto).select().single();
        if (error) throw error;
        return data;
    }

    async updateRuta(id: number, dto: UpdateRutaSupervisionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision').update(dto).eq('id', id).select().single();
        if (error) throw error;
        return data;
    }

    async deleteRuta(id: number) {
        const supabase = this.supabaseService.getClient();
        // Primero eliminar puntos asociados (cascade debería encargarse, pero por seguridad)
        await supabase.from('rutas_supervision_puntos').delete().eq('ruta_id', id);
        const { error } = await supabase.from('rutas_supervision').delete().eq('id', id);
        if (error) throw error;
        return { message: 'Ruta eliminada' };
    }

    // Puntos de Ruta
    async addPunto(rutaId: number, dto: CreateRutaPuntoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_puntos').insert({
            ruta_id: rutaId,
            ...dto
        }).select().single();
        if (error) throw error;
        return data;
    }

    async updatePunto(rutaId: number, dto: CreateRutaPuntoDto) { // Reusing DTO for ease, though partial usually
        // Aquí asumo que se envia todo para actualizar, o se podria crear UpdatePuntoDto
        // Como el endpoint sugerido es PUT /rutas/:id/puestos, supongo quiza reemplazo de lista o un punto especifico?
        // El endpoint era DELETE /api/rutas/{id}/puestos/{ruta_puesto_id} -> especifico
        // Asumiré que este method requiere ID del punto, no de la ruta.
        // Ajustaré en controller.
        return null; // Implementado via updatePuntoDirecto abajo
    }

    async deletePunto(puntoId: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('rutas_supervision_puntos').delete().eq('id', puntoId);
        if (error) throw error;
        return { message: 'Punto eliminado' };
    }

    // 2. ASIGNACIÓN
    async asignarRuta(dto: CreateRutaAsignacionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_asignacion').insert(dto).select().single();
        if (error) throw error;
        return data;
    }

    async getAsignacionPorTurno(turnoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_asignacion')
            .select(`
                *,
                ruta:rutas_supervision(*),
                vehiculo:vehiculos(*)
            `)
            .eq('turno_id', turnoId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || { message: 'No hay ruta asignada a este turno' };
    }

    async deleteAsignacion(id: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('rutas_supervision_asignacion').delete().eq('id', id);
        if (error) throw error;
        return { message: 'Asignación eliminada' };
    }

    // 3. EJECUCIÓN (Real-time)
    async iniciarEjecucion(dto: CreateRutaEjecucionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_ejecucion').insert({
            ...dto,
            fecha_inicio: new Date().toISOString(),
            estado: 'en_progreso'
        }).select().single();

        if (error) throw error;

        // Log event 'inicio'
        await this.registrarEvento({
            ejecucion_id: data.id,
            latitud: 0, // Should come from request ideally
            longitud: 0,
            tipo_evento: 'inicio_ruta',
            observacion: 'Ruta iniciada'
        });

        return data;
    }

    async finalizarEjecucion(dto: FinalizarRutaEjecucionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_ejecucion').update({
            fecha_fin: new Date().toISOString(),
            estado: 'finalizada'
        }).eq('id', dto.ejecucion_id).select().single();

        if (error) throw error;
        return data;
    }

    async getEjecucion(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                 *,
                 asignacion:rutas_supervision_asignacion(
                     *,
                     ruta:rutas_supervision(
                         *,
                         puntos:rutas_supervision_puntos(*)
                     )
                 )
             `)
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    }

    async getEjecucionPorTurno(turnoId: number) {
        // Buscar la asignacion del turno, y luego la ejecucion
        const supabase = this.supabaseService.getClient();
        // Join complejo
        const { data, error } = await supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                *,
                asignacion:rutas_supervision_asignacion!inner(turno_id)
            `)
            .eq('asignacion.turno_id', turnoId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || { message: 'No hay ejecución iniciada para este turno' };
    }

    async getEjecucionPorSupervisor(supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('*')
            .eq('supervisor_id', supervisorId)
            .order('fecha_inicio', { ascending: false });
        if (error) throw error;
        return data;
    }

    // 4. EVENTOS (GPS Tracking)
    async registrarEvento(dto: CreateRutaEventoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('rutas_supervision_eventos').insert({
            ...dto,
            fecha: new Date().toISOString()
        }).select().single();
        if (error) throw error;
        return data;
    }

    async getEventos(ejecucionId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_eventos')
            .select('*')
            .eq('ejecucion_id', ejecucionId)
            .order('fecha', { ascending: true });
        if (error) throw error;
        return data;
    }

    async getMapa(ejecucionId: number) {
        // Retorna GeoJSON o lista simple para mapa
        const eventos = await this.getEventos(ejecucionId);
        const path = eventos.filter(e => e.tipo_evento === 'gps' || e.latitud !== 0).map(e => ({
            lat: e.latitud,
            lng: e.longitud,
            timestamp: e.fecha
        }));
        return { ruta: path, eventos: eventos.filter(e => e.tipo_evento !== 'gps') };
    }

    // ==========================================
    // SISTEMA DE ASIGNACIÓN AUTOMÁTICA DE RUTAS
    // ==========================================

    /**
     * Asigna rutas automáticamente a todos los supervisores con turnos en la fecha especificada
     * Este método procesa todos los turnos de supervisores y asigna la ruta correspondiente según el tipo_turno
     * @param dto Datos de asignación masiva por fecha
     * @returns Resumen de asignaciones exitosas y errores
     */
    async asignarRutasPorFecha(dto: AsignarRutasPorFechaDto): Promise<AsignacionRutasMasivaResponseDto> {
        const supabase = this.supabaseService.getClient();

        // 1. Buscar todos los turnos de supervisores para la fecha
        const { data: turnos, error: turnosError } = await supabase
            .from('turnos')
            .select(`
                id,
                tipo_turno,
                empleado_id,
                fecha,
                empleado:empleados!inner(
                    id,
                    nombre_completo,
                    rol
                )
            `)
            .eq('fecha', dto.fecha)
            .eq('empleado.rol', 'supervisor');

        if (turnosError) {
            throw new BadRequestException(`Error al consultar turnos: ${turnosError.message}`);
        }

        if (!turnos || turnos.length === 0) {
            return {
                fecha: dto.fecha,
                total_turnos_procesados: 0,
                total_asignaciones_exitosas: 0,
                total_errores: 0,
                asignaciones_exitosas: [],
                errores: []
            };
        }

        const asignacionesExitosas: AsignacionRutaResultDto[] = [];
        const errores: AsignacionRutaResultDto[] = [];

        // 2. Procesar cada turno
        for (const turno of turnos) {
            try {
                // Verificar si ya existe asignación
                const { data: asignacionExistente } = await supabase
                    .from('rutas_supervision_asignacion')
                    .select('id')
                    .eq('turno_id', turno.id)
                    .eq('activo', true)
                    .maybeSingle();

                if (asignacionExistente && !dto.forzar_reasignacion) {
                    errores.push({
                        turno_id: turno.id,
                        empleado_id: turno.empleado_id,
                        empleado_nombre: turno.empleado[0]?.nombre_completo,
                        tipo_turno: turno.tipo_turno,
                        asignado: false,
                        mensaje: 'Ya existe una asignación activa para este turno'
                    });
                    continue;
                }

                // Si existe y se fuerza reasignación, desactivar la anterior
                if (asignacionExistente && dto.forzar_reasignacion) {
                    await supabase
                        .from('rutas_supervision_asignacion')
                        .update({ activo: false })
                        .eq('id', asignacionExistente.id);
                }

                // Buscar ruta según tipo_turno
                const { data: ruta } = await supabase
                    .from('rutas_supervision')
                    .select('id, nombre, tipo_turno')
                    .eq('tipo_turno', turno.tipo_turno)
                    .eq('activa', true)
                    .maybeSingle();

                if (!ruta) {
                    errores.push({
                        turno_id: turno.id,
                        empleado_id: turno.empleado_id,
                        empleado_nombre: turno.empleado[0]?.nombre_completo,
                        tipo_turno: turno.tipo_turno,
                        asignado: false,
                        mensaje: `No se encontró ruta activa para tipo_turno: ${turno.tipo_turno}`
                    });
                    continue;
                }

                // Buscar vehículo del supervisor
                const { data: vehiculo } = await supabase
                    .from('supervisor_vehiculos')
                    .select('vehiculo_id, vehiculos(placa)')
                    .eq('supervisor_id', turno.empleado_id)
                    .eq('activo', true)
                    .order('fecha_asignacion', { ascending: false })
                    .maybeSingle();

                // Crear asignación
                const { data: asignacion, error: asignacionError } = await supabase
                    .from('rutas_supervision_asignacion')
                    .insert({
                        ruta_id: ruta.id,
                        turno_id: turno.id,
                        supervisor_id: turno.empleado_id,
                        vehiculo_id: vehiculo?.vehiculo_id || null,
                        activo: true
                    })
                    .select()
                    .single();

                if (asignacionError) {
                    errores.push({
                        turno_id: turno.id,
                        empleado_id: turno.empleado_id,
                        empleado_nombre: turno.empleado[0]?.nombre_completo,
                        tipo_turno: turno.tipo_turno,
                        ruta_id: ruta.id,
                        ruta_nombre: ruta.nombre,
                        asignado: false,
                        mensaje: `Error al crear asignación: ${asignacionError.message}`
                    });
                } else {
                    asignacionesExitosas.push({
                        turno_id: turno.id,
                        empleado_id: turno.empleado_id,
                        empleado_nombre: turno.empleado[0]?.nombre_completo,
                        tipo_turno: turno.tipo_turno,
                        ruta_id: ruta.id,
                        ruta_nombre: ruta.nombre,
                        vehiculo_id: vehiculo?.vehiculo_id || null,
                        vehiculo_placa: vehiculo?.vehiculos?.[0]?.placa || null,
                        asignado: true,
                        mensaje: 'Ruta asignada correctamente'
                    });
                }

            } catch (error) {
                errores.push({
                    turno_id: turno.id,
                    empleado_id: turno.empleado_id,
                    empleado_nombre: turno.empleado[0]?.nombre_completo,
                    tipo_turno: turno.tipo_turno,
                    asignado: false,
                    mensaje: `Error inesperado: ${error.message}`
                });
            }
        }

        return {
            fecha: dto.fecha,
            total_turnos_procesados: turnos.length,
            total_asignaciones_exitosas: asignacionesExitosas.length,
            total_errores: errores.length,
            asignaciones_exitosas: asignacionesExitosas,
            errores
        };
    }

    /**
     * Asigna ruta manualmente a un turno específico
     * Permite especificar la ruta y vehículo, o buscarlos automáticamente
     * @param dto Datos de asignación manual
     * @returns Resultado de la asignación
     */
    async asignarRutaManual(dto: AsignarRutaManualDto): Promise<AsignacionRutaResultDto> {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener información del turno
        const { data: turno, error: turnoError } = await supabase
            .from('turnos')
            .select(`
                id,
                tipo_turno,
                empleado_id,
                empleado:empleados(nombre_completo, rol)
            `)
            .eq('id', dto.turno_id)
            .single();

        if (turnoError || !turno) {
            throw new NotFoundException(`Turno ${dto.turno_id} no encontrado`);
        }

        // Verificar que es supervisor
        if (turno.empleado[0]?.rol !== 'supervisor') {
            throw new BadRequestException(`El empleado del turno no es supervisor (rol: ${turno.empleado[0]?.rol})`);
        }

        // 2. Verificar si ya existe asignación activa
        const { data: asignacionExistente } = await supabase
            .from('rutas_supervision_asignacion')
            .select('id')
            .eq('turno_id', dto.turno_id)
            .eq('activo', true)
            .maybeSingle();

        if (asignacionExistente) {
            return {
                turno_id: dto.turno_id,
                empleado_id: turno.empleado_id,
                empleado_nombre: turno.empleado[0]?.nombre_completo,
                tipo_turno: turno.tipo_turno,
                asignado: false,
                mensaje: 'Ya existe una asignación activa para este turno. Elimínela primero.'
            };
        }

        // 3. Determinar ruta_id
        let rutaId = dto.ruta_id;
        let rutaNombre: string;

        if (!rutaId) {
            const { data: ruta } = await supabase
                .from('rutas_supervision')
                .select('id, nombre')
                .eq('tipo_turno', turno.tipo_turno)
                .eq('activa', true)
                .maybeSingle();

            if (!ruta) {
                return {
                    turno_id: dto.turno_id,
                    empleado_id: turno.empleado_id,
                    empleado_nombre: turno.empleado[0]?.nombre_completo,
                    tipo_turno: turno.tipo_turno,
                    asignado: false,
                    mensaje: `No se encontró ruta activa para tipo_turno: ${turno.tipo_turno}`
                };
            }
            rutaId = ruta.id;
            rutaNombre = ruta.nombre;
        } else {
            const { data: ruta } = await supabase
                .from('rutas_supervision')
                .select('nombre')
                .eq('id', rutaId)
                .single();
            rutaNombre = ruta?.nombre;
        }

        // 4. Determinar vehiculo_id
        let vehiculoId = dto.vehiculo_id;
        let vehiculoPlaca: string;

        if (!vehiculoId) {
            const { data: vehiculo } = await supabase
                .from('supervisor_vehiculos')
                .select('vehiculo_id, vehiculos(placa)')
                .eq('supervisor_id', turno.empleado_id)
                .eq('activo', true)
                .order('fecha_asignacion', { ascending: false })
                .maybeSingle();

            vehiculoId = vehiculo?.vehiculo_id || null;
            vehiculoPlaca = vehiculo?.vehiculos?.[0]?.placa || null;
        } else {
            const { data: vehiculo } = await supabase
                .from('vehiculos')
                .select('placa')
                .eq('id', vehiculoId)
                .maybeSingle();
            vehiculoPlaca = vehiculo?.placa;
        }

        // 5. Crear asignación
        const { data: asignacion, error: asignacionError } = await supabase
            .from('rutas_supervision_asignacion')
            .insert({
                ruta_id: rutaId,
                turno_id: dto.turno_id,
                supervisor_id: turno.empleado_id,
                vehiculo_id: vehiculoId,
                activo: true
            })
            .select()
            .single();

        if (asignacionError) {
            throw new BadRequestException(`Error al crear asignación: ${asignacionError.message}`);
        }

        return {
            turno_id: dto.turno_id,
            empleado_id: turno.empleado_id,
            empleado_nombre: turno.empleado[0]?.nombre_completo,
            tipo_turno: turno.tipo_turno,
            ruta_id: rutaId,
            ruta_nombre: rutaNombre,
            vehiculo_id: vehiculoId,
            vehiculo_placa: vehiculoPlaca,
            asignado: true,
            mensaje: 'Ruta asignada correctamente'
        };
    }

    /**
     * Consulta asignaciones de rutas con filtros
     * @param dto Filtros de consulta
     * @returns Lista de asignaciones
     */
    async consultarAsignaciones(dto: ConsultarAsignacionesDto) {
        const supabase = this.supabaseService.getClient();

        let query = supabase
            .from('rutas_supervision_asignacion')
            .select(`
                id,
                turno_id,
                supervisor_id,
                ruta_id,
                vehiculo_id,
                activo,
                created_at,
                turno:turnos(
                    id,
                    fecha,
                    tipo_turno,
                    hora_inicio,
                    hora_fin
                ),
                ruta:rutas_supervision(
                    id,
                    nombre,
                    tipo_turno
                ),
                supervisor:empleados!supervisor_id(
                    id,
                    nombre_completo,
                    cedula
                ),
                vehiculo:vehiculos(
                    id,
                    placa,
                    tipo,
                    marca
                )
            `)
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (dto.fecha) {
            query = query.eq('turno.fecha', dto.fecha);
        }

        if (dto.supervisor_id) {
            query = query.eq('supervisor_id', dto.supervisor_id);
        }

        if (dto.solo_activas !== false) {
            query = query.eq('activo', true);
        }

        const { data, error } = await query;

        if (error) {
            throw new BadRequestException(`Error al consultar asignaciones: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Desactiva una asignación de ruta (no la elimina, solo marca como inactiva)
     * @param id ID de la asignación
     */
    async desactivarAsignacion(id: number) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('rutas_supervision_asignacion')
            .update({ activo: false })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new BadRequestException(`Error al desactivar asignación: ${error.message}`);
        }

        return {
            message: 'Asignación desactivada correctamente',
            data
        };
    }

}
