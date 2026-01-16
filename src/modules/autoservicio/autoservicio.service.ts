import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PqrsfService } from '../pqrsf/pqrsf.service';
import { GeminiService } from '../ia/gemini.service';
import { calcularDistancia } from '../asistencias/utils/distancia.util';
import { analizarAsistenciaIA } from '../asistencias/utils/ia.util';
import { BotonPanicoService } from '../boton-panico/boton-panico.service';
import { UbicacionesService } from '../ubicaciones/ubicaciones.service';
import {
    ActivarMiPanicoDto,
    RegistrarMiUbicacionDto,
    RegistrarMiAsistenciaEntradaDto,
    RegistrarMiAsistenciaSalidaDto
} from './dto/autoservicio-empleado.dto';
import {
    IniciarSupervisionDto,
    RegistrarUbicacionDto as RegistrarUbicacionSupervisorDto,
    ValidarLlegadaPuestoDto,
    CrearMinutaRutaDto,
    FinalizarSupervisionDto,
    ConsultarHistorialDto,
    IniciarVisitaDto,
    FinalizarVisitaDto,
    RegistrarCheckeoDto,
    CargarEvidenciaDto,
    HeartbeatDto,
    SyncDataDto,
    PausarReanudarRutaDto,
    ReportarNovedadDto,
    ConfirmacionAckDto,
    DispositivoInfoDto,
    MisHorariosResponseDto,
    ResolverNovedadDto
} from './dto/autoservicio-supervisor.dto';

@Injectable()
export class AutoservicioService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly pqrsfService: PqrsfService,
        private readonly gemini: GeminiService,
        private readonly panicoService: BotonPanicoService,
        private readonly ubicacionesService: UbicacionesService
    ) { }

    // ------------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------------
    async getEmpleadoByUserId(userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: empleado } = await supabase.from('empleados').select('*').eq('usuario_id', userId).single();
        if (!empleado) throw new NotFoundException('No se encontró registro de empleado asociado a este usuario');
        return empleado;
    }

    async getClienteByUserId(userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: cliente } = await supabase.from('clientes').select('*').eq('usuario_id', userId).single();
        if (!cliente) throw new NotFoundException('No se encontró registro de cliente asociado a este usuario');
        return cliente;
    }

    // ------------------------------------------------------------------
    // EMPLEADO
    // ------------------------------------------------------------------
    async getPerfilEmpleado(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        // Retornar objeto limpio sin métricas sensibles
        const {
            nivel_confianza,
            riesgo_ausencia,
            rendimiento_promedio,
            ultima_evaluacion,
            ...perfilSeguro
        } = empleado;
        return perfilSeguro;
    }

    async getMiInformacionCompleta(userId: number) {
        const supabase = this.supabaseService.getClient();

        // Primero buscamos el ID del empleado asociado al usuario_id
        const { data: empBasic, error: errorBasic } = await supabase
            .from('empleados')
            .select('id')
            .eq('usuario_id', userId)
            .single();

        if (errorBasic || !empBasic) {
            throw new NotFoundException('No se encontró registro de empleado asociado a este usuario');
        }

        const sql = `
          SELECT e.*,
                 eps.nombre AS eps_nombre,
                 arl.nombre AS arl_nombre,
                 fp.nombre AS fondo_pension_nombre,
                 cp.tipo_contrato AS contrato_personal_nombre,
                 u.nombre_completo AS creado_por_nombre,
                 uv.nombre_completo AS actualizado_por_nombre,
                 tcv.nombre AS tipo_curso_vigilancia_nombre
          FROM empleados e
          LEFT JOIN eps ON e.eps_id = eps.id
          LEFT JOIN arl ON e.arl_id = arl.id
          LEFT JOIN fondos_pension fp ON e.fondo_pension_id = fp.id
          LEFT JOIN contratos_personal cp ON e.contrato_personal_id = cp.id
          LEFT JOIN usuarios_externos u ON e.creado_por = u.id
          LEFT JOIN usuarios_externos uv ON e.actualizado_por = uv.id
          LEFT JOIN tipos_curso_vigilancia tcv ON e.tipo_curso_vigilancia_id = tcv.id
          WHERE e.id = ${empBasic.id}
          LIMIT 1
        `;

        const { data, error } = await supabase.rpc("exec_sql", { query: sql });

        if (error) {
            throw error;
        }

        const empleados = Array.isArray(data) ? data : [];
        if (!empleados.length) {
            throw new NotFoundException(`Empleado no encontrado`);
        }

        // Retornar información sin métricas sensibles (similar a getMiPerfil)
        const {
            nivel_confianza,
            riesgo_ausencia,
            rendimiento_promedio,
            ultima_evaluacion,
            ...perfilCompleto
        } = empleados[0];

        return perfilCompleto;
    }

    async getMiNomina(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('nomina_empleado')
            .select(`
                *,
                nomina_periodos(anio, mes, fecha_inicio, fecha_fin)
            `)
            .eq('empleado_id', empleado.id)
            .eq('generado', true)
            .order('periodo_id', { ascending: false });

        if (error) throw error;
        return data;
    }

    async getMiNominaHistorial(userId: number) {
        // Alias for getMiNomina basically, or could be paginated
        return this.getMiNomina(userId);
    }

    async getMiDesprendible(periodoId: number, userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // Check if nomina exists for this employee and period
        const { data: nomina } = await supabase
            .from('nomina_empleado')
            .select('*, nomina_periodos(*)')
            .eq('periodo_id', periodoId)
            .eq('empleado_id', empleado.id)
            .single();

        if (!nomina) throw new NotFoundException('No se encontró nomina para este periodo');

        // TODO: Generate PDF
        // Mocking return
        return {
            url: `https://api.proliseg.com/downloads/nomina/${empleado.id}/${periodoId}/desprendible.pdf`, // Mock
            mensaje: "La generación de PDF real requiere integración con librería PDF"
        };
    }

    async getMiContrato(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('contratos_personal')
            .select('*, salarios(nombre_salario, valor)')
            .eq('empleado_id', empleado.id)
            .eq('estado', 'activo')
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Allow null if no active contract
        return data || { message: 'No tiene contrato activo' };
    }

    async getMiContratoHistorial(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('contratos_personal')
            .select('*')
            .eq('empleado_id', empleado.id)
            .order('fecha_inicio', { ascending: false });

        if (error) throw error;
        return data;
    }

    async getMiPuesto(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select(`
                *,
                puestos_trabajo(nombre, direccion, ciudad, contratos(id, cliente_id)),
                subpuestos_trabajo(nombre)
            `)
            .eq('empleado_id', empleado.id)
            .eq('activo', true)
            .single(); // Assuming single assignment at a time

        if (error && error.code !== 'PGRST116') throw error;
        return data || { message: 'No tiene puesto asignado actualmente' };
    }

    async getMisTurnos(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('turnos')
            .select(`
                *,
                puestos_trabajo(nombre, latitud, longitud, direccion),
                subpuestos_trabajo(nombre)
            `)
            .eq('empleado_id', empleado.id)
            // Mostrar futuros y recientes (ej: ultimos 7 dias + futuros)
            .or(`fecha.gte.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`)
            .order('fecha', { ascending: true });

        if (error) throw error;
        return data;
    }

    async getMisMinutas(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('minutas')
            .select('*')
            .eq('creada_por', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async getMinutasPuesto(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // 1. Obtener puesto asignado actual
        const { data: asignacion } = await supabase
            .from('asignacion_guardas_puesto')
            .select('puesto_id')
            .eq('empleado_id', empleado.id)
            .eq('activo', true)
            .single();

        if (!asignacion) return []; // No asignado, no ve nada

        // 2. Ver historial completo del puesto
        const { data, error } = await supabase
            .from('minutas')
            .select(`
                *,
                creador:creada_por(nombre_completo) 
            `)
            .eq('puesto_id', asignacion.puesto_id)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        return data;
    }

    async createMinuta(userId: number, minutaDto: any) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // VALIDACIÓN: Solo puede crear si tiene turno ACTIVO ('parcial' es el estado "En Curso" según DB)
        const { data: turnoActivo } = await supabase
            .from('turnos')
            .select('id, puesto_id')
            .eq('empleado_id', empleado.id)
            .eq('estado_turno', 'parcial') // Changed from 'en_curso'
            .single();

        if (!turnoActivo) {
            throw new ForbiddenException('Solo puedes crear minutas cuando tienes un turno activo (en curso/parcial).');
        }

        // Crear minuta vinculada al turno y puesto
        const { data, error } = await supabase
            .from('minutas')
            .insert({
                ...minutaDto,
                creada_por: userId,
                turno_id: turnoActivo.id,
                puesto_id: turnoActivo.puesto_id,
                fecha: new Date().toISOString().split('T')[0], // Fecha actual
                hora: new Date().toLocaleTimeString('en-US', { hour12: false }) // Hora actual
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ------------------------------------------------------------------
    // CLIENTE
    // ------------------------------------------------------------------
    async getMiContratoCliente(userId: number) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // Obtener historial completo de contratos (activos e inactivos)
        const { data, error } = await supabase
            .from('contratos')
            .select(`
                *,
                tipo_servicio(nombre),
                puestos_trabajo(nombre, direccion, ciudad)
            `)
            .eq('cliente_id', cliente.id)
            .order('fecha_inicio', { ascending: false });

        if (error) throw error;
        return data;
    }

    async getDetalleContratoCliente(userId: number, contratoId: number) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // 1. Verificar que el contrato pertenezca al cliente
        const { data: contrato, error: contratoError } = await supabase
            .from('contratos')
            .select(`
                *,
                tipo_servicio(nombre)
            `)
            .eq('id', contratoId)
            .eq('cliente_id', cliente.id)
            .single();

        if (contratoError || !contrato) {
            throw new ForbiddenException('Contrato no encontrado o no autorizado');
        }

        // 2. Obtener puestos asociados al contrato
        const { data: puestos, error: puestosError } = await supabase
            .from('puestos_trabajo')
            .select('*')
            .eq('contrato_id', contrato.id);

        if (puestosError) throw puestosError;

        // 3. Para cada puesto, obtener los vigilantes asignados ACTIVOS
        const puestosConVigilantes = await Promise.all(puestos.map(async (puesto) => {
            const { data: asignaciones } = await supabase
                .from('asignacion_guardas_puesto')
                .select(`
                    id,
                    empleado:empleado_id(
                        id,
                        nombre_completo,
                        documento
                    ),
                    cargo
                `)
                .eq('puesto_id', puesto.id)
                .eq('activo', true);

            return {
                ...puesto,
                vigilantes_asignados: asignaciones ? asignaciones.map(a => ({
                    empleado: a.empleado,
                    cargo: a.cargo
                })) : []
            };
        }));

        return {
            contrato,
            puestos: puestosConVigilantes
        };
    }

    async getHorariosContratoCliente(userId: number, contratoId: number, fechaInicio?: string, fechaFin?: string) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // 1. Verificar contrato
        const { data: contrato } = await supabase
            .from('contratos')
            .select('id')
            .eq('id', contratoId)
            .eq('cliente_id', cliente.id)
            .single();

        if (!contrato) throw new ForbiddenException('Contrato no encontrado o no autorizado');

        // 2. Obtener IDs de puestos
        const { data: puestos } = await supabase
            .from('puestos_trabajo')
            .select('id, nombre')
            .eq('contrato_id', contratoId);

        if (!puestos || puestos.length === 0) return [];

        const puestoIds = puestos.map(p => p.id);
        const puestosMap = puestos.reduce((acc, p) => ({ ...acc, [p.id]: p.nombre }), {});

        // 3. Consultar turnos
        let query = supabase
            .from('turnos')
            .select(`
                id,
                fecha,
                hora_inicio,
                hora_fin,
                puesto_id,
                subpuestos_trabajo(nombre),
                empleado:empleado_id(nombre_completo)
            `)
            .in('puesto_id', puestoIds)
            .order('fecha', { ascending: true });

        if (fechaInicio) {
            query = query.gte('fecha', fechaInicio);
        } else {
            // Default: desde inicio de mes actual
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            query = query.gte('fecha', startOfMonth.toISOString().split('T')[0]);
        }

        if (fechaFin) {
            query = query.lte('fecha', fechaFin);
        }

        const { data: turnos, error } = await query;

        if (error) throw error;

        // Formatear respuesta para que sea amigable
        return turnos.map(t => ({
            ...t,
            puesto_nombre: puestosMap[t.puesto_id]
        }));
    }

    async getMinutasCliente(userId: number) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // Logic: Contracts -> Puestos -> Minutas
        const { data: contratos } = await supabase.from('contratos').select('id').eq('cliente_id', cliente.id);
        if (!contratos || contratos.length === 0) return [];
        const contratoIds = contratos.map(c => c.id);

        const { data: puestos } = await supabase.from('puestos_trabajo').select('id').in('contrato_id', contratoIds);
        if (!puestos || puestos.length === 0) return [];
        const puestoIds = puestos.map(p => p.id);

        if (puestoIds.length === 0) return [];

        const { data, error } = await supabase
            .from('minutas')
            .select(`
                *,
                puestos_trabajo(nombre)
            `)
            .in('puesto_id', puestoIds)
            .eq('visible_para_cliente', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async getNovedadesCliente(userId: number) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // Logic: Contracts -> Typo -> Turnos -> Novedades? Or linked via Puesto?
        // Schema check: 'novedades' has 'turno_id'. Turno has 'puesto_id'.

        const { data: contratos } = await supabase.from('contratos').select('id').eq('cliente_id', cliente.id);
        if (!contratos || contratos.length === 0) return [];
        const contratoIds = contratos.map(c => c.id);

        const { data: puestos } = await supabase.from('puestos_trabajo').select('id').in('contrato_id', contratoIds);
        if (!puestos || puestos.length === 0) return [];
        const puestoIds = puestos.map(p => p.id);

        if (puestoIds.length === 0) return [];

        // Find turnos in these puestos
        // Be careful with large datasets. Maybe limit date?
        // A better schema would link Novedad directly to Puesto or have materialized view.
        // For now: JOIN query

        const { data, error } = await supabase
            .from('novedades')
            .select(`
                *,
                turnos!inner(puesto_id)
            `)
            .in('turnos.puesto_id', puestoIds) // Filter by related
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async getEmpleadosAsignadosCliente(userId: number) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // 1. Obtener todos los contratos del cliente
        const { data: contratos } = await supabase
            .from('contratos')
            .select('id')
            .eq('cliente_id', cliente.id);

        if (!contratos || contratos.length === 0) return [];
        const contratoIds = contratos.map(c => c.id);

        // 2. Obtener puestos de esos contratos
        const { data: puestos } = await supabase
            .from('puestos_trabajo')
            .select('id, nombre')
            .in('contrato_id', contratoIds)
            .eq('activo', true);

        if (!puestos || puestos.length === 0) return [];
        const puestoIds = puestos.map(p => p.id);

        // 3. Obtener asignaciones activas
        const { data: asignaciones, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select(`
                puesto_id,
                empleado:empleado_id(
                    id,
                    nombre_completo,
                    cedula,
                    telefono,
                    experiencia,
                    foto_perfil_url
                )
            `)
            .in('puesto_id', puestoIds)
            .eq('activo', true);

        if (error) throw error;

        // 4. Mapear con información del puesto
        const puestosMap = puestos.reduce((acc, p) => ({ ...acc, [p.id]: p.nombre }), {});

        return asignaciones.map(a => ({
            puesto_nombre: puestosMap[a.puesto_id],
            empleado: a.empleado
        }));
    }

    // ------------------------------------------------------------------
    // PQRSF (CLIENTE)
    // ------------------------------------------------------------------
    async getPqrsCliente(userId: number, filters?: { estado?: string; fechaInicio?: string; fechaFin?: string }) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        let query = supabase
            .from('pqrsf')
            .select(`
                *,
                contrato:contrato_id(id),
                puesto:puesto_id(nombre)
            `)
            .eq('cliente_id', cliente.id)
            .neq('estado', 'cancelado') // Excluir soft-deleted por defecto
            .order('created_at', { ascending: false });

        if (filters?.estado) query = query.eq('estado', filters.estado);
        if (filters?.fechaInicio) query = query.gte('created_at', filters.fechaInicio);
        if (filters?.fechaFin) query = query.lte('created_at', filters.fechaFin);

        const { data, error } = await query;

        if (error) throw error;
        return data;
    }

    async getPqrsDetalleCliente(userId: number, pqrsfId: number) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('pqrsf')
            .select(`
                *,
                contrato:contrato_id(id),
                puesto:puesto_id(nombre),
                respuestas:pqrsf_respuestas(
                    id, mensaje, created_at, visible_para_cliente,
                    respondido_por:respondido_por(nombre_completo, rol)
                ),
                adjuntos:pqrsf_adjuntos(*)
            `)
            .eq('id', pqrsfId)
            // Ensure client owns this PQRS
            .eq('cliente_id', cliente.id)
            .single();

        if (error) throw error;
        if (!data) throw new NotFoundException('PQRSF no encontrado o no autorizado');

        // Filtrar respuestas visibles para cliente
        data.respuestas = data.respuestas.filter(r => r.visible_para_cliente);

        return data;
    }

    async createPqrsCliente(userId: number, dto: any) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // Validar si contrato/puesto pertenecen al cliente si se envían
        if (dto.contrato_id) {
            const { data: contrato } = await supabase
                .from('contratos')
                .select('id')
                .eq('id', dto.contrato_id)
                .eq('cliente_id', cliente.id)
                .single();
            if (!contrato) throw new ForbiddenException('El contrato especificado no pertenece a su cuenta');
        }

        // TODO: Validar puesto si se envía (aunque puesto depende de contrato, doble check es bueno)

        const { data, error } = await supabase
            .from('pqrsf')
            .insert({
                ...dto,
                cliente_id: cliente.id,
                usuario_cliente_id: userId,
                fecha_creacion: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async addAdjuntoCliente(userId: number, pqrsId: number, file: any) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // 1. Verificar que PQRS pertenezca al cliente
        const { data: pqrs, error } = await supabase
            .from('pqrsf')
            .select('id')
            .eq('id', pqrsId)
            .eq('cliente_id', cliente.id)
            .single();

        if (error || !pqrs) {
            throw new NotFoundException('PQRSF no encontrado o no autorizado');
        }

        // 2. Usar servicio de PQRSF para subir archivo
        // Determinar tipo básico
        let tipo = 'otro';
        if (file.mimetype.startsWith('image/')) tipo = 'imagen';
        else if (file.mimetype === 'application/pdf') tipo = 'pdf';

        return this.pqrsfService.addAdjunto(pqrsId, userId, file, tipo);
    }

    // ------------------------------------------------------------------
    // AUTO-ASISTENCIA (SELF-SERVICE CLOCK-IN/OUT)
    // ------------------------------------------------------------------

    async getMiAsistenciaActiva(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('turnos_asistencia')
            .select(`
                *,
                turno:turno_id (
                    id,
                    fecha,
                    hora_inicio,
                    hora_fin,
                    subpuesto:subpuesto_id (
                        id,
                        nombre,
                        puesto:puesto_id (
                            id,
                            nombre
                        )
                    )
                )
            `)
            .eq('empleado_id', empleado.id)
            .is('hora_salida', null)
            .order('hora_entrada', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async getMiHistorialAsistencia(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('turnos_asistencia')
            .select(`
                *,
                turno:turno_id (
                    id,
                    fecha,
                    hora_inicio,
                    hora_fin,
                    subpuesto:subpuesto_id (
                        id,
                        nombre,
                        puesto:puesto_id (
                            id,
                            nombre
                        )
                    )
                )
            `)
            .eq('empleado_id', empleado.id)
            .order('hora_entrada', { ascending: false })
            .limit(20);

        if (error) throw error;
        return data;
    }

    async marcarAsistenciaEntrada(userId: number, dto: RegistrarMiAsistenciaEntradaDto) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener datos del empleado y verificar permiso
        const { data: empBasic } = await supabase.from('empleados').select('id, nombre_completo').eq('usuario_id', userId).single();
        if (!empBasic) throw new NotFoundException('Empleado no encontrado');

        // 2. Verificar turno y subpuesto
        const { data: turno, error: turnoError } = await supabase
            .from('turnos')
            .select(`
                id, subpuesto_id, empleado_id, fecha, hora_inicio, hora_fin, tipo_turno
            `)
            .eq('id', dto.turno_id)
            .single();

        if (turnoError || !turno) throw new NotFoundException('Turno no encontrado');
        if (turno.empleado_id !== empBasic.id) throw new ForbiddenException('Este turno no te pertenece');

        // 3. Verificar ventana de tiempo (20 minutos antes)
        const now = new Date();
        const [h, m, s] = (turno.hora_inicio || '00:00:00').split(':');
        const turnoFechaInicio = new Date(turno.fecha);
        turnoFechaInicio.setHours(parseInt(h), parseInt(m), parseInt(s || '0'));

        const diffMinutos = (turnoFechaInicio.getTime() - now.getTime()) / (1000 * 60);
        if (diffMinutos > 20) {
            throw new ForbiddenException('Aún no puedes marcar entrada. Se habilita 20 minutos antes del inicio.');
        }

        // 4. Validar distancia (1000m)
        const { data: subpuesto } = await supabase.from('subpuestos_trabajo').select('*, puesto:puesto_id(*)').eq('id', turno.subpuesto_id).single();
        if (!subpuesto) throw new NotFoundException('Subpuesto no encontrado');

        const puesto = Array.isArray(subpuesto.puesto) ? subpuesto.puesto[0] : subpuesto.puesto;
        let distancia = 0;
        if (puesto?.latitud && puesto?.longitud && dto.latitud && dto.longitud) {
            distancia = calcularDistancia(parseFloat(dto.latitud), parseFloat(dto.longitud), parseFloat(puesto.latitud), parseFloat(puesto.longitud));
        }

        if (distancia > 1000) {
            throw new ForbiddenException(`Estás fuera del rango permitido (${Math.round(distancia)}m). Máximo 1000m.`);
        }

        // 5. Preparar observaciones e IA
        let observaciones_calculadas = '';
        const minutosTarde = Math.floor((now.getTime() - turnoFechaInicio.getTime()) / (1000 * 60));
        if (minutosTarde > 0) {
            observaciones_calculadas = `Llegada tarde: ${minutosTarde} min.`;
        } else {
            observaciones_calculadas = 'Entrada Normal.';
        }
        if (dto.observaciones) observaciones_calculadas += ` Nota: ${dto.observaciones}`;

        try {
            const empleadoIA = { nombre: empBasic.nombre_completo };
            const iaRes = await analizarAsistenciaIA(this.gemini, empleadoIA, puesto, distancia, 'entrada');
            observaciones_calculadas += ` | IA: ${iaRes}`;
        } catch (e) {
            console.warn(`IA Analysis failed: ${e.message}`);
        }

        // 6. Registrar en turnos_asistencia
        const { data: newAsis, error: errAsis } = await supabase.from('turnos_asistencia').insert({
            turno_id: dto.turno_id,
            empleado_id: empBasic.id,
            hora_entrada: now.toISOString(),
            observaciones: observaciones_calculadas,
            registrado_por: userId,
            metodo_registro: 'app',
            estado_asistencia: 'pendiente'
        }).select().single();

        if (errAsis) throw errAsis;

        // 7. Insertar en log legacy 'asistencias'
        await supabase.from('asistencias').insert({
            empleado_id: empBasic.id,
            turno_id: dto.turno_id,
            tipo_marca: 'entrada',
            timestamp: now.toISOString(),
            latitud_entrada: dto.latitud,
            longitud_entrada: dto.longitud,
            registrada_por: userId
        });

        // 8. Actualizar Turno
        await supabase.from('turnos').update({ estado_turno: 'parcial' }).eq('id', dto.turno_id);

        return {
            message: '✅ Entrada registrada con éxito',
            distancia_metros: distancia,
            asistencia_id: newAsis.id
        };
    }

    async marcarAsistenciaSalida(userId: number, dto: RegistrarMiAsistenciaSalidaDto) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener datos del empleado
        const { data: empBasic } = await supabase.from('empleados').select('id, nombre_completo').eq('usuario_id', userId).single();
        if (!empBasic) throw new NotFoundException('Empleado no encontrado');

        // 2. Buscar registro de entrada previo
        const asisId = dto.asistencia_id || dto.id;
        if (!asisId) throw new BadRequestException('Debe proporcionar el ID de asistencia (asistencia_id o id)');

        const { data: asistencia, error: asisError } = await supabase
            .from('turnos_asistencia')
            .select('*')
            .eq('id', asisId)
            .eq('empleado_id', empBasic.id)
            .single();

        if (asisError || !asistencia) throw new NotFoundException('No se encontró registro de entrada para esta salida');
        if (asistencia.hora_salida) throw new ForbiddenException('La salida ya fue registrada');

        // 3. Verificar turno
        const { data: turno } = await supabase.from('turnos').select('*').eq('id', dto.turno_id).single();
        if (!turno) throw new NotFoundException('Turno no encontrado');

        // 4. Validar ventana de salida (10 min antes del fin)
        const now = new Date();
        const [hFin, mFin, sFin] = (turno.hora_fin || '23:59:59').split(':');
        const turnoFechaFin = new Date(turno.fecha);
        turnoFechaFin.setHours(parseInt(hFin), parseInt(mFin), parseInt(sFin || '0'));
        if (turno.hora_inicio && turno.hora_fin && turno.hora_fin < turno.hora_inicio) {
            turnoFechaFin.setDate(turnoFechaFin.getDate() + 1);
        }

        const minutosParaFin = (turnoFechaFin.getTime() - now.getTime()) / (1000 * 60);
        if (minutosParaFin > 10) {
            throw new ForbiddenException('Aún es muy temprano para registrar la salida.');
        }

        // 5. Validar distancia
        const { data: subpuesto } = await supabase.from('subpuestos_trabajo').select('*, puesto:puesto_id(*)').eq('id', turno.subpuesto_id).single();
        const puesto = Array.isArray(subpuesto?.puesto) ? subpuesto.puesto[0] : subpuesto?.puesto;

        let distancia = 0;
        if (puesto?.latitud && puesto?.longitud && dto.latitud && dto.longitud) {
            distancia = calcularDistancia(parseFloat(dto.latitud), parseFloat(dto.longitud), parseFloat(puesto.latitud), parseFloat(puesto.longitud));
        }
        if (distancia > 1000) throw new ForbiddenException(`Estás demasiado lejos (${Math.round(distancia)}m). Máximo 1000m.`);

        // 6. Observaciones e IA
        let obsSalida = (now.getTime() - turnoFechaFin.getTime()) / (1000 * 60) >= 5 ? 'Salida Tarde.' : 'Salida Normal.';
        let nuevasObservaciones = (asistencia.observaciones || '') + ' | Salida: ' + obsSalida;
        if (dto.observaciones) nuevasObservaciones += ` Nota: ${dto.observaciones}`;

        try {
            const empleadoIA = { nombre: empBasic.nombre_completo };
            const iaRes = await analizarAsistenciaIA(this.gemini, empleadoIA, puesto, distancia, 'salida');
            nuevasObservaciones += ` | IA: ${iaRes}`;
        } catch (e) {
            console.warn(`IA Analysis failed: ${e.message}`);
        }

        // 7. Actualizar turnos_asistencia
        await supabase.from('turnos_asistencia').update({
            hora_salida: now.toISOString(),
            observaciones: nuevasObservaciones,
            estado_asistencia: 'cumplido'
        }).eq('id', asisId);

        // 8. Log legacy
        await supabase.from('asistencias').insert({
            empleado_id: empBasic.id,
            turno_id: dto.turno_id,
            tipo_marca: 'salida',
            timestamp: now.toISOString(),
            latitud_salida: dto.latitud,
            longitud_salida: dto.longitud,
            registrada_por: userId
        });

        // 9. Actualizar Turno
        await supabase.from('turnos').update({ estado_turno: 'cumplido' }).eq('id', dto.turno_id);

        return { message: '✅ Salida registrada con éxito. Turno finalizado.' };
    }

    // ------------------------------------------------------------------
    // BOTÓN DE PÁNICO & UBICACIÓN (AUTOSERVICIO)
    // ------------------------------------------------------------------

    async activarMiPanico(userId: number, dto: ActivarMiPanicoDto, ipAddress: string) {
        const empleado = await this.getEmpleadoByUserId(userId);

        return this.panicoService.activar({
            ...dto,
            origen: 'empleado',
            empleado_id: empleado.id,
            usuario_id: userId
        }, ipAddress);
    }

    async registrarMiUbicacion(userId: number, dto: RegistrarMiUbicacionDto) {
        const empleado = await this.getEmpleadoByUserId(userId);

        return this.ubicacionesService.registrar({
            ...dto,
            empleado_id: empleado.id,
            usuario_id: userId,
            evento: 'tracking'
        });
    }

    // ------------------------------------------------------------------
    // AUTOSERVICIO SUPERVISOR - RUTAS DE SUPERVISIÓN
    // ------------------------------------------------------------------

    /**
     * Obtiene la ruta asignada al supervisor para hoy
     */
    async obtenerRutaAsignadaHoy(supervisorId: number) {
        const hoy = new Date().toISOString().split('T')[0];
        return this.obtenerRutaAsignadaFecha(supervisorId, hoy);
    }

    /**
     * Obtiene la ruta asignada al supervisor para una fecha específica
     */
    async obtenerRutaAsignadaFecha(supervisorId: number, fecha: string) {
        const supabase = this.supabaseService.getClient();

        // 1. Buscar asignación activa para la fecha
        const { data: asignacion, error: asigError } = await supabase
            .from('rutas_supervision_asignacion')
            .select(`
                id,
                ruta_id,
                vehiculo_id,
                rutas_supervision (
                    id,
                    nombre,
                    descripcion,
                    tipo_turno
                ),
                turnos (
                    id,
                    fecha,
                    hora_inicio,
                    hora_fin,
                    tipo_turno
                ),
                vehiculos (
                    id,
                    placa,
                    tipo,
                    marca
                )
            `)
            .eq('supervisor_id', supervisorId)
            .eq('activo', true)
            .single();

        if (asigError || !asignacion) {
            throw new NotFoundException(`No tienes ruta asignada para el ${fecha}`);
        }

        const ruta = Array.isArray(asignacion.rutas_supervision) ? asignacion.rutas_supervision[0] : asignacion.rutas_supervision;
        const turno = Array.isArray(asignacion.turnos) ? asignacion.turnos[0] : asignacion.turnos;
        const vehiculo = Array.isArray(asignacion.vehiculos) ? asignacion.vehiculos[0] : asignacion.vehiculos;

        // 2. Obtener puntos de la ruta
        const { data: puntos } = await supabase
            .from('rutas_supervision_puntos')
            .select(`
                id,
                puesto_id,
                orden,
                radio_metros,
                puestos_trabajo (
                    id,
                    nombre,
                    latitud,
                    longitud
                )
            `)
            .eq('ruta_id', asignacion.ruta_id)
            .order('orden', { ascending: true });

        // 3. Verificar si ya tiene ejecución activa
        const { data: ejecucion } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('id, estado, fecha_inicio')
            .eq('ruta_asignacion_id', asignacion.id)
            .in('estado', ['iniciada', 'en_progreso'])
            .maybeSingle();

        //4. Mapear puntos
        const puntosFormateados = (puntos || []).map(p => {
            const puesto = Array.isArray(p.puestos_trabajo) ? p.puestos_trabajo[0] : p.puestos_trabajo;
            return {
                punto_id: p.id,
                puesto_id: p.puesto_id,
                puesto_nombre: puesto?.nombre,
                orden: p.orden,
                radio_metros: p.radio_metros,
                latitud: puesto?.latitud,
                longitud: puesto?.longitud,
                visitado: false // TODO: verificar con minutas
            };
        });

        return {
            asignacion_id: asignacion.id,
            ruta_id: ruta.id,
            ruta_nombre: ruta.nombre,
            ruta_descripcion: ruta.descripcion,
            fecha: turno.fecha,
            hora_inicio: turno.hora_inicio,
            hora_fin: turno.hora_fin,
            tipo_turno: turno.tipo_turno,
            vehiculo_id: vehiculo?.id,
            vehiculo_placa: vehiculo?.placa,
            vehiculo_tipo: vehiculo?.tipo,
            puntos: puntosFormateados,
            ejecucion_id: ejecucion?.id,
            estado_ejecucion: ejecucion?.estado,
            fecha_inicio_ejecucion: ejecucion?.fecha_inicio
        };
    }

    /**
     * Inicia la supervisión de ruta
     */
    async iniciarSupervision(dto: IniciarSupervisionDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Verificar que no tenga supervisión activa
        const { data: activa } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('id')
            .eq('supervisor_id', supervisorId)
            .in('estado', ['iniciada', 'en_progreso'])
            .maybeSingle();

        if (activa) {
            throw new BadRequestException('Ya tienes una supervisión en progreso. Finalízala antes de iniciar otra.');
        }

        // 2. Verificar asignación
        const { data: asignacion } = await supabase
            .from('rutas_supervision_asignacion')
            .select('*, vehiculos(id)')
            .eq('id', dto.asignacion_id)
            .eq('supervisor_id', supervisorId)
            .eq('activo', true)
            .single();

        if (!asignacion) {
            throw new NotFoundException('Asignación de ruta no encontrada o no autorizada');
        }

        const vehiculo = Array.isArray(asignacion.vehiculos) ? asignacion.vehiculos[0] : asignacion.vehiculos;
        const vehiculoId = dto.vehiculo_id || asignacion.vehiculo_id || vehiculo?.id;

        // 3. Crear ejecución
        const { data: ejecucion, error } = await supabase
            .from('rutas_supervision_ejecucion')
            .insert({
                ruta_asignacion_id: dto.asignacion_id,
                supervisor_id: supervisorId,
                vehiculo_id: vehiculoId,
                fecha_inicio: new Date().toISOString(),
                estado: 'en_progreso'
            })
            .select()
            .single();

        if (error) throw error;

        // 4. Registrar evento de inicio
        await supabase.from('rutas_supervision_eventos').insert({
            ejecucion_id: ejecucion.id,
            tipo_evento: 'gps',
            lat: dto.latitud_inicio,
            lng: dto.longitud_inicio,
            observacion: 'Supervisión iniciada'
        });

        return {
            ejecucion_id: ejecucion.id,
            estado: ejecucion.estado,
            fecha_inicio: ejecucion.fecha_inicio,
            mensaje: 'Supervisión iniciada correctamente. Buen recorrido!'
        };
    }

    /**
     * Registra ubicación GPS del supervisor
     */
    async registrarUbicacion(dto: RegistrarUbicacionSupervisorDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();

        // Verificar que la ejecución pertenezca al supervisor
        const { data: ejecucion } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('id')
            .eq('id', dto.ejecucion_id)
            .eq('supervisor_id', supervisorId)
            .single();

        if (!ejecucion) {
            throw new NotFoundException('Ejecución no encontrada');
        }

        // Registrar evento GPS
        const { data, error } = await supabase
            .from('rutas_supervision_eventos')
            .insert({
                ejecucion_id: dto.ejecucion_id,
                tipo_evento: dto.tipo_evento || 'gps',
                lat: dto.latitud,
                lng: dto.longitud,
                observacion: dto.observacion
            })
            .select()
            .single();

        if (error) throw error;

        return {
            mensaje: 'Ubicación registrada',
            evento_id: data.id
        };
    }

    /**
     * Valida si el supervisor está dentro del radio del puesto (Haversine)
     */
    async validarLlegadaPuesto(dto: ValidarLlegadaPuestoDto) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener datos del puesto
        const { data: puesto } = await supabase
            .from('puestos_trabajo')
            .select('id, nombre, latitud, longitud')
            .eq('id', dto.puesto_id)
            .single();

        if (!puesto) {
            throw new NotFoundException('Puesto no encontrado');
        }

        // 2. Obtener radio permitido (desde ruta_puntos)
        const { data: punto } = await supabase
            .from('rutas_supervision_puntos')
            .select('radio_metros')
            .eq('puesto_id', dto.puesto_id)
            .maybeSingle();

        const radioPermitido = punto?.radio_metros || 100; // Default 100m

        // 3. Calcular distancia con Haversine
        const distancia = calcularDistancia(
            dto.latitud,
            dto.longitud,
            parseFloat(puesto.latitud),
            parseFloat(puesto.longitud)
        );

        const dentroRadio = distancia <= radioPermitido;

        return {
            dentro_radio: dentroRadio,
            distancia_metros: Math.round(distancia),
            radio_permitido: radioPermitido,
            puesto_id: puesto.id,
            puesto_nombre: puesto.nombre,
            puede_crear_minuta: dentroRadio,
            mensaje: dentroRadio
                ? `Dentro del radio permitido. Puedes crear minuta.`
                : `Estás a ${Math.round(distancia)}m del puesto. Debes acercarte a menos de ${radioPermitido}m.`
        };
    }

    /**
     * Crea minuta de ruta (supervisor en puesto)
     */
    async crearMinutaRuta(dto: CrearMinutaRutaDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Verificar ejecución
        const { data: ejecucion } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('id')
            .eq('id', dto.ejecucion_id)
            .eq('supervisor_id', supervisorId)
            .eq('estado', 'en_progreso')
            .single();

        if (!ejecucion) {
            throw new NotFoundException('Supervisión activa no encontrada');
        }

        // 2. Crear minuta en minutas_rutas
        const { data: minuta, error } = await supabase
            .from('minutas_rutas')
            .insert({
                ejecucion_id: dto.ejecucion_id,
                supervisor_id: supervisorId,
                puesto_id: dto.puesto_id,
                tipo_chequeo_id: dto.tipo_chequeo_id,
                detalle_operativo: dto.detalle_operativo,
                novedades: dto.novedades,
                mejoras_sugeridas: dto.mejoras_sugeridas
            })
            .select()
            .single();

        if (error) throw error;

        // 3. Guardar evidencias (fotos, audios)
        if (dto.fotos && dto.fotos.length > 0) {
            const evidenciasFotos = dto.fotos.map(url => ({
                minuta_id: minuta.id,
                tipo: 'foto',
                url
            }));
            await supabase.from('minutas_rutas_evidencias').insert(evidenciasFotos);
        }

        if (dto.audios && dto.audios.length > 0) {
            const evidenciasAudios = dto.audios.map(url => ({
                minuta_id: minuta.id,
                tipo: 'audio',
                url
            }));
            await supabase.from('minutas_rutas_evidencias').insert(evidenciasAudios);
        }

        // 4. Registrar evento de llegada
        await supabase.from('rutas_supervision_eventos').insert({
            ejecucion_id: dto.ejecucion_id,
            tipo_evento: 'llegada',
            lat: dto.latitud,
            lng: dto.longitud,
            observacion: `Llegada a puesto ${dto.puesto_id}. Minuta creada.`
        });

        // 5. [NUEVO] Guardar resultados del Checklist Granular
        if (dto.check_items && dto.check_items.length > 0) {
            const resultados = dto.check_items.map(res => ({
                minuta_id: minuta.id,
                item_id: res.item_id,
                resultado: res.resultado,
                observacion: res.observacion
            }));
            await supabase.from('minutas_rutas_check_resultados').insert(resultados);
        }

        // 6. [NUEVO] Crear entrada en "Minuta de Minutas" (tabla general)
        try {
            const { data: ejecucion } = await supabase
                .from('rutas_supervision_ejecucion')
                .select('supervisor_id, ruta_asignacion_id')
                .eq('id', dto.ejecucion_id)
                .single();

            const { data: asignacion } = await supabase
                .from('rutas_supervision_asignacion')
                .select('turno_id')
                .eq('id', ejecucion?.ruta_asignacion_id)
                .single();

            const { data: usuario } = await supabase
                .from('usuarios_externos')
                .select('id')
                .eq('empleado_id', supervisorId)
                .single();

            // Crear resumen de checklist para la minuta general
            let resumenCheck = '';
            if (dto.check_items && dto.check_items.length > 0) {
                const cumplidos = dto.check_items.filter(i => i.resultado === 'cumple').length;
                const noCumplidos = dto.check_items.filter(i => i.resultado === 'no_cumple').length;
                resumenCheck = ` [Checklist: ${cumplidos} OK, ${noCumplidos} Fallos]`;
            }

            await supabase.from('minutas').insert({
                creada_por: usuario?.id,
                turno_id: asignacion?.turno_id,
                puesto_id: dto.puesto_id,
                fecha: new Date().toISOString().split('T')[0],
                hora: new Date().toLocaleTimeString('en-US', { hour12: false }),
                novedades: `[SUPERVISOR] ${dto.detalle_operativo}. ${dto.novedades || ''}${resumenCheck}`,
                fotos: dto.fotos || [],
                videos: [],
                adjuntos: dto.audios || []
            });
        } catch (e) {
            console.error('Error creando minuta de minutas:', e);
            // No bloqueamos el proceso principal
        }

        return {
            minuta_id: minuta.id,
            mensaje: 'Minuta creada correctamente',
            fecha_creacion: minuta.created_at
        };
    }

    /**
     * Finaliza la supervisión
     */
    async finalizarSupervision(dto: FinalizarSupervisionDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener ejecución
        const { data: ejecucion } = await supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                *,
                rutas_supervision_asignacion (
                    ruta_id,
                    rutas_supervision (
                        nombre
                    )
                )
            `)
            .eq('id', dto.ejecucion_id)
            .eq('supervisor_id', supervisorId)
            .single();

        if (!ejecucion) {
            throw new NotFoundException('No tienes supervisión activa');
        }

        // 2. Actualizar estado
        const fechaFin = new Date();
        const { error } = await supabase
            .from('rutas_supervision_ejecucion')
            .update({
                fecha_fin: fechaFin.toISOString(),
                estado: 'finalizada'
            })
            .eq('id', dto.ejecucion_id);

        if (error) throw error;

        // 3. Calcular duración
        const fechaInicio = new Date(ejecucion.fecha_inicio);
        const duracionMs = fechaFin.getTime() - fechaInicio.getTime();
        const duracionMinutos = Math.floor(duracionMs / 60000);
        const horas = Math.floor(duracionMinutos / 60);
        const minutos = duracionMinutos % 60;

        // 4. Contar puntos y minutas
        const asignacion: any = Array.isArray(ejecucion.rutas_supervision_asignacion)
            ? ejecucion.rutas_supervision_asignacion[0]
            : ejecucion.rutas_supervision_asignacion;

        const { count: totalPuntos } = await supabase
            .from('rutas_supervision_puntos')
            .select('*', { count: 'exact', head: true })
            .eq('ruta_id', asignacion.ruta_id);

        const { count: minutasCreadas } = await supabase
            .from('minutas_rutas')
            .select('*', { count: 'exact', head: true })
            .eq('ejecucion_id', dto.ejecucion_id);

        // 5. Registrar evento de finalización
        await supabase.from('rutas_supervision_eventos').insert({
            ejecucion_id: dto.ejecucion_id,
            tipo_evento: 'gps',
            lat: dto.latitud_fin,
            lng: dto.longitud_fin,
            observacion: 'Supervisión finalizada'
        });

        const ruta: any = Array.isArray(asignacion.rutas_supervision)
            ? asignacion.rutas_supervision[0]
            : asignacion.rutas_supervision;

        return {
            ejecucion_id: ejecucion.id,
            estado: 'finalizada',
            fecha_inicio: ejecucion.fecha_inicio,
            fecha_fin: fechaFin.toISOString(),
            duracion_minutos: duracionMinutos,
            duracion_formateada: `${horas}h ${minutos}m`,
            total_puntos: totalPuntos || 0,
            puntos_visitados: minutasCreadas || 0,
            minutas_creadas: minutasCreadas || 0,
            mensaje: '✅ Supervisión finalizada correctamente. ¡Buen trabajo!'
        };
    }

    /**
     * Consulta historial de supervisiones del supervisor
     */
    async consultarHistorialSupervisor(supervisorId: number, dto: ConsultarHistorialDto) {
        const supabase = this.supabaseService.getClient();

        let query = supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                id,
                fecha_inicio,
                fecha_fin,
                estado,
                rutas_supervision_asignacion (
                    rutas_supervision (
                        nombre
                    )
                )
            `)
            .eq('supervisor_id', supervisorId)
            .order('fecha_inicio', { ascending: false });

        if (dto.fecha_desde) {
            query = query.gte('fecha_inicio', dto.fecha_desde);
        }
        if (dto.fecha_hasta) {
            query = query.lte('fecha_inicio', dto.fecha_hasta);
        }
        if (dto.estado) {
            query = query.eq('estado', dto.estado);
        }

        const limit = dto.limit || 20;
        query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;

        // Formatear respuesta
        return Promise.all(data.map(async (ej) => {
            const asignacion: any = Array.isArray(ej.rutas_supervision_asignacion)
                ? ej.rutas_supervision_asignacion[0]
                : ej.rutas_supervision_asignacion;
            const ruta: any = Array.isArray(asignacion?.rutas_supervision)
                ? asignacion.rutas_supervision[0]
                : asignacion?.rutas_supervision;

            // Contar minutas
            const { count: minutas } = await supabase
                .from('minutas_rutas')
                .select('*', { count: 'exact', head: true })
                .eq('ejecucion_id', ej.id);

            const duracion = ej.fecha_fin
                ? this.calcularDuracion(ej.fecha_inicio, ej.fecha_fin)
                : 'En progreso';

            return {
                ejecucion_id: ej.id,
                ruta_nombre: ruta?.nombre || 'N/A',
                fecha: new Date(ej.fecha_inicio).toISOString().split('T')[0],
                hora_inicio: new Date(ej.fecha_inicio).toLocaleTimeString(),
                hora_fin: ej.fecha_fin ? new Date(ej.fecha_fin).toLocaleTimeString() : null,
                estado: ej.estado,
                duracion,
                puntos_visitados: minutas || 0,
                minutas_creadas: minutas || 0
            };
        }));
    }

    /**
     * Generar reporte detallado de una supervisión
     */
    async generarReporteRuta(ejecucionId: number, supervisorId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener ejecución
        const { data: ejecucion } = await supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                *,
                rutas_supervision_asignacion (
                    rutas_supervision (nombre),
                    vehiculos (placa)
                ),
                empleados (nombre_completo)
            `)
            .eq('id', ejecucionId)
            .eq('supervisor_id', supervisorId)
            .single();

        if (!ejecucion) {
            throw new NotFoundException('Ejecución no encontrada');
        }

        const asignacion: any = Array.isArray(ejecucion.rutas_supervision_asignacion)
            ? ejecucion.rutas_supervision_asignacion[0]
            : ejecucion.rutas_supervision_asignacion;
        const ruta: any = Array.isArray(asignacion.rutas_supervision)
            ? asignacion.rutas_supervision[0]
            : asignacion.rutas_supervision;
        const vehiculo: any = Array.isArray(asignacion.vehiculos)
            ? asignacion.vehiculos[0]
            : asignacion.vehiculos;
        const supervisor: any = Array.isArray(ejecucion.empleados)
            ? ejecucion.empleados[0]
            : ejecucion.empleados;

        // 2. Obtener eventos GPS para mapa
        const { data: eventos } = await supabase
            .from('rutas_supervision_eventos')
            .select('lat, lng, fecha, tipo_evento')
            .eq('ejecucion_id', ejecucionId)
            .order('fecha', { ascending: true });

        // 3. Obtener minutas
        const { data: minutas } = await supabase
            .from('minutas_rutas')
            .select(`
                *,
                puestos_trabajo (nombre)
            `)
            .eq('ejecucion_id', ejecucionId);

        // 4. Mapear puntos visitados
        const puntosVisitados = (minutas || []).map(m => {
            const puesto: any = Array.isArray(m.puestos_trabajo)
                ? m.puestos_trabajo[0]
                : m.puestos_trabajo;
            return {
                puesto_nombre: puesto?.nombre,
                hora_llegada: new Date(m.created_at).toLocaleTimeString(),
                hora_salida: null, // TODO: calcular con eventos
                minuta_creada: true,
                novedades: m.novedades || 'Sin novedades'
            };
        });

        // 5. Mapa de recorrido
        const mapaRecorrido = (eventos || []).map(e => ({
            lat: parseFloat(e.lat),
            lng: parseFloat(e.lng),
            timestamp: e.fecha
        }));

        return {
            ejecucion_id: ejecucion.id,
            ruta_nombre: ruta.nombre,
            supervisor_nombre: supervisor.nombre_completo,
            vehiculo_placa: vehiculo?.placa,
            fecha: new Date(ejecucion.fecha_inicio).toISOString().split('T')[0],
            hora_inicio: new Date(ejecucion.fecha_inicio).toLocaleTimeString(),
            hora_fin: ejecucion.fecha_fin ? new Date(ejecucion.fecha_fin).toLocaleTimeString() : null,
            duracion_total: ejecucion.fecha_fin
                ? this.calcularDuracion(ejecucion.fecha_inicio, ejecucion.fecha_fin)
                : 'En progreso',
            puntos: puntosVisitados,
            mapa_recorrido: mapaRecorrido,
            distancia_total_km: 0, // TODO: calcular con GPS
            estado: ejecucion.estado
        };
    }

    /**
     * Obtiene tipos de chequeo disponibles
     */
    async obtenerTiposChequeo() {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('tipos_chequeo')
            .select('*')
            .eq('activo', true)
            .order('nombre');

        if (error) throw error;
        return data;
    }

    /**
     * Obtiene los ítems (preguntas) de un checklist granular
     */
    async getChecklistItems(tipoChequeoId: number) {
        const supabase = this.supabaseService.getClient();

        const { data: categoria } = await supabase
            .from('tipos_chequeo')
            .select('nombre')
            .eq('id', tipoChequeoId)
            .single();

        const { data: items, error } = await supabase
            .from('tipos_chequeo_items')
            .select('*')
            .eq('tipo_chequeo_id', tipoChequeoId)
            .eq('activo', true)
            .order('orden');

        if (error) throw error;

        return {
            tipo_chequeo_id: tipoChequeoId,
            nombre: categoria?.nombre || 'Categoría no encontrada',
            items: items || []
        };
    }

    /**
     * Obtiene supervisión activa del supervisor
     */
    async obtenerSupervisionActiva(supervisorId: number) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                *,
                rutas_supervision_asignacion (
                    rutas_supervision (nombre)
                )
            `)
            .eq('supervisor_id', supervisorId)
            .eq('estado', 'en_progreso')
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            throw new NotFoundException('No tienes supervisión activa');
        }

        return data;
    }

    /**
     * Obtiene estadísticas del supervisor
     */
    async obtenerEstadisticasSupervisor(supervisorId: number, mes?: number, anio?: number) {
        const supabase = this.supabaseService.getClient();
        const fecha = new Date();
        const mesActual = mes || (fecha.getMonth() + 1);
        const anioActual = anio || fecha.getFullYear();
        const fechaInicio = `${anioActual}-${String(mesActual).padStart(2, '0')}-01`;
        const ultimoDia = new Date(anioActual, mesActual, 0).getDate();
        const fechaFin = `${anioActual}-${String(mesActual).padStart(2, '0')}-${ultimoDia}`;

        const { data: ejecuciones } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('*')
            .eq('supervisor_id', supervisorId)
            .gte('fecha_inicio', fechaInicio)
            .lte('fecha_inicio', fechaFin);

        const totalSupervisions = ejecuciones?.length || 0;
        let totalMinutas = 0;
        let totalHoras = 0;

        for (const ej of ejecuciones || []) {
            const { count } = await supabase
                .from('minutas_rutas')
                .select('*', { count: 'exact', head: true })
                .eq('ejecucion_id', ej.id);

            totalMinutas += count || 0;
            if (ej.fecha_fin) {
                const duracionMs = new Date(ej.fecha_fin).getTime() - new Date(ej.fecha_inicio).getTime();
                totalHoras += duracionMs / (1000 * 60 * 60);
            }
        }

        return {
            mes: mesActual,
            anio: anioActual,
            total_supervisiones: totalSupervisions,
            promedio_minutas_por_supervision: totalSupervisions > 0
                ? Math.round(totalMinutas / totalSupervisions)
                : 0,
            total_horas_supervision: Math.round(totalHoras),
            total_minutas_creadas: totalMinutas
        };
    }

    /**
     * Obtiene el perfil operativo completo del supervisor
     */
    async getPerfilSupervisor(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        const supabase = this.supabaseService.getClient();

        // Obtener información del usuario para incluir correo y rol
        const { data: usuario, error: userError } = await supabase
            .from('usuarios_externos')
            .select('id, correo, rol')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        // Retornar perfil completo sin métricas sensibles
        const {
            nivel_confianza,
            riesgo_ausencia,
            rendimiento_promedio,
            ultima_evaluacion,
            ...perfilSeguro
        } = empleado;

        return {
            ...usuario,
            empleado: perfilSeguro
        };
    }

    /**
     * Obtiene la última ubicación registrada del supervisor
     */
    async getUltimaUbicacion(supervisorId: number) {
        const supabase = this.supabaseService.getClient();

        // Primero obtener la ejecución activa del supervisor
        const { data: ejecucion } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('id')
            .eq('supervisor_id', supervisorId)
            .eq('estado', 'en_progreso')
            .maybeSingle();

        if (!ejecucion) {
            throw new NotFoundException('No tienes supervisión activa');
        }

        // Ahora buscar el último evento de esa ejecución
        const { data, error } = await supabase
            .from('rutas_supervision_eventos')
            .select('*')
            .eq('ejecucion_id', ejecucion.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new NotFoundException('No se han registrado ubicaciones');

        return {
            latitud: parseFloat(data.lat),
            longitud: parseFloat(data.lng),
            fecha: data.created_at,
            tipo_evento: data.tipo_evento
        };
    }

    /**
     * Obtiene ubicaciones de todos los supervisores activos (Central)
     */
    async getUbicacionesActivasSupervisores() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                id, supervisor_id,
                empleados (nombre_completo),
                rutas_supervision_eventos (
                    lat, lng, fecha, tipo_evento
                )
            `)
            .eq('estado', 'en_progreso');

        if (error) throw error;

        return (data || []).map(ej => {
            const ultimaUbicacion = Array.isArray(ej.rutas_supervision_eventos) && ej.rutas_supervision_eventos.length > 0
                ? ej.rutas_supervision_eventos[0]
                : null;
            return {
                supervisor_id: ej.supervisor_id,
                nombre: (ej.empleados as any)?.nombre_completo,
                latitud: ultimaUbicacion ? parseFloat(ultimaUbicacion.lat) : null,
                longitud: ultimaUbicacion ? parseFloat(ultimaUbicacion.lng) : null,
                fecha: ultimaUbicacion?.fecha
            };
        });
    }

    /**
     * Inicia una visita a un puesto (Marca llegada)
     */
    async iniciarVisitaPuesto(dto: IniciarVisitaDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase
            .from('rutas_supervision_eventos')
            .insert({
                ejecucion_id: dto.ejecucion_id,
                empleado_id: supervisorId,
                lat: dto.latitud,
                lng: dto.longitud,
                tipo_evento: 'llegada',
                observacion: `Llegada a puesto ID ${dto.puesto_id}`
            });
        if (error) throw error;
        return { mensaje: 'Llegada registrada' };
    }

    /**
     * Finaliza una visita a un puesto (Marca salida)
     */
    async finalizarVisitaPuesto(dto: FinalizarVisitaDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase
            .from('rutas_supervision_eventos')
            .insert({
                ejecucion_id: dto.ejecucion_id,
                empleado_id: supervisorId,
                lat: dto.latitud || 0,
                lng: dto.longitud || 0,
                tipo_evento: 'salida',
                observacion: `Salida de puesto ID ${dto.puesto_id}`
            });
        if (error) throw error;
        return { mensaje: 'Salida registrada' };
    }

    /**
     * Obtiene puntos de la ruta que no han sido visitados
     */
    async getPuntosPendientes(ejecucionId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: ejecucion } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('asignacion_id')
            .eq('id', ejecucionId)
            .single();

        const { data: asignacion } = await supabase
            .from('rutas_supervision_asignacion')
            .select('ruta_id')
            .eq('id', ejecucion?.asignacion_id)
            .single();

        const { data: todosPuntos } = await supabase
            .from('rutas_supervision_puntos')
            .select('*, puestos_trabajo (id, nombre)')
            .eq('ruta_id', asignacion?.ruta_id)
            .order('orden');

        const { data: minutas } = await supabase
            .from('minutas_rutas')
            .select('puesto_id')
            .eq('ejecucion_id', ejecucionId);

        const visitadosIds = (minutas || []).map(m => m.puesto_id);
        return (todosPuntos || []).filter(p => !visitadosIds.includes(p.puesto_id));
    }

    /**
     * Registra un checkeo operativo
     */
    async registrarCheckeo(dto: RegistrarCheckeoDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('minutas_rutas')
            .insert({
                ejecucion_id: dto.ejecucion_id,
                puesto_id: dto.puesto_id,
                tipo_chequeo_id: dto.tipo_chequeo_id,
                detalle_operativo: dto.resultado,
                novedades: dto.observaciones,
                created_at: new Date()
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    /**
     * Obtiene minutas pendientes
     */
    async getMinutasPendientes(ejecucionId: number) {
        return this.getPuntosPendientes(ejecucionId);
    }

    /**
     * Carga evidencia multimedia
     */
    async cargarEvidencia(dto: CargarEvidenciaDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('minutas_rutas_evidencias')
            .insert({
                minuta_id: dto.tipo_referencia === 'minuta' ? dto.referencia_id : null,
                url: dto.url,
                tipo: dto.tipo_archivo
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    /**
     * Obtiene datos del vehículo asignado hoy
     */
    async getVehiculoAsignadoHoy(supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const hoy = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('rutas_supervision_asignacion')
            .select(`
                vehiculo_id,
                vehiculos (id, placa, tipo, marca, modelo)
            `)
            .eq('supervisor_id', supervisorId)
            .eq('activo', true)
            .gte('created_at', hoy)
            .maybeSingle();

        if (error) throw error;
        if (!data || !data.vehiculos) throw new NotFoundException('No tienes vehículo asignado para hoy');
        return Array.isArray(data.vehiculos) ? data.vehiculos[0] : data.vehiculos;
    }

    // Helper: calcular duración
    private calcularDuracion(inicio: string, fin: string): string {
        const duracionMs = new Date(fin).getTime() - new Date(inicio).getTime();
        const minutos = Math.floor(duracionMs / 60000);
        const horas = Math.floor(minutos / 60);
        const mins = minutos % 60;
        return `${horas}h ${mins}m`;
    }

    /**
     * Registra Heartbeat del supervisor (Estado del dispositivo)
     */
    async registrarHeartbeat(dto: HeartbeatDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase
            .from('rutas_supervision_eventos')
            .insert({
                empleado_id: supervisorId,
                tipo_evento: 'gps',
                lat: dto.latitud,
                lng: dto.longitud,
                observacion: `Heartbeat [Bat: ${dto.bateria}%, Red: ${dto.red}]`
            });

        if (error) throw error;
        return { status: 'ok', timestamp: new Date() };
    }

    /**
     * Sincroniza datos offline en batch
     */
    async sincronizarOffline(dto: SyncDataDto, supervisorId: number) {
        const resultadosTotal = {
            gps: 0,
            visitas: 0,
            minutas: 0,
            evidencias: 0,
            errores: [] as string[]
        };

        for (const g of dto.gps || []) {
            try { await this.registrarUbicacion(g, supervisorId); resultadosTotal.gps++; } catch (e) { resultadosTotal.errores.push(`GPS: ${e.message}`); }
        }
        for (const v of dto.visitas || []) {
            try { await this.iniciarVisitaPuesto(v, supervisorId); resultadosTotal.visitas++; } catch (e) { resultadosTotal.errores.push(`Visita: ${e.message}`); }
        }
        for (const m of dto.minutas || []) {
            try { await this.crearMinutaRuta(m, supervisorId); resultadosTotal.minutas++; } catch (e) { resultadosTotal.errores.push(`Minuta: ${e.message}`); }
        }
        for (const ev of dto.evidencias || []) {
            try { await this.cargarEvidencia(ev); resultadosTotal.evidencias++; } catch (e) { resultadosTotal.errores.push(`Evidencia: ${e.message}`); }
        }

        return resultadosTotal;
    }

    /**
     * Pausa una ruta en ejecución
     */
    async pausarRuta(dto: PausarReanudarRutaDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase
            .from('rutas_supervision_ejecucion')
            .update({ estado: 'pausada' })
            .eq('id', dto.ejecucion_id)
            .eq('supervisor_id', supervisorId);

        if (error) throw error;

        await supabase.from('rutas_supervision_eventos').insert({
            ejecucion_id: dto.ejecucion_id,
            tipo_evento: 'gps',
            lat: dto.latitud,
            lng: dto.longitud,
            observacion: `Ruta PAUSADA: ${dto.motivo || 'Sin motivo'}`
        });

        return { mensaje: 'Ruta pausada' };
    }

    /**
     * Reanuda una ruta pausada
     */
    async reanudarRuta(dto: PausarReanudarRutaDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase
            .from('rutas_supervision_ejecucion')
            .update({ estado: 'en_progreso' })
            .eq('id', dto.ejecucion_id)
            .eq('supervisor_id', supervisorId);

        if (error) throw error;

        await supabase.from('rutas_supervision_eventos').insert({
            ejecucion_id: dto.ejecucion_id,
            tipo_evento: 'gps',
            lat: dto.latitud,
            lng: dto.longitud,
            observacion: 'Ruta REANUDADA'
        });

        return { mensaje: 'Ruta reanudada' };
    }

    /**
     * Reporta novedad crítica inmediata
     */
    async reportarNovedadInmediata(dto: ReportarNovedadDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_eventos')
            .insert({
                ejecucion_id: dto.ejecucion_id,
                empleado_id: supervisorId,
                tipo_evento: 'gps',
                lat: dto.latitud,
                lng: dto.longitud,
                observacion: `🚨 NOVEDAD CRÍTICA: [${dto.tipo_novedad}] ${dto.descripcion}`,
            })
            .select()
            .single();

        if (error) throw error;

        if (dto.fotos && dto.fotos.length > 0) {
            const evs = dto.fotos.map(url => ({
                minuta_id: null,
                url,
                tipo: 'foto'
            }));
            await supabase.from('minutas_rutas_evidencias').insert(evs);
        }

        return data;
    }

    /**
     * Valida geocerca antes de iniciar visita
     */
    async validarGeocercaPreVisita(puestoId: number, lat: number, lng: number) {
        return this.validarLlegadaPuesto({
            ejecucion_id: 0,
            puesto_id: puestoId,
            latitud: lat,
            longitud: lng
        });
    }

    /**
     * Obtiene detalle completo para mapa
     */
    async getDetalleRutaMapa(ejecucionId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: ejecucion } = await supabase
            .from('rutas_supervision_ejecucion')
            .select(`
                *,
                asignacion:ruta_asignacion_id (
                    ruta_id,
                    rutas_supervision (
                        nombre,
                        puntos:rutas_supervision_puntos (
                            *,
                            puesto:puesto_id (*)
                        )
                    )
                ),
                eventos:rutas_supervision_eventos (*)
            `)
            .eq('id', ejecucionId)
            .single();

        return ejecucion;
    }

    /**
     * Obtiene horarios y rutas asignadas
     */
    async getMisHorariosYRutas(supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_asignacion')
            .select(`
                id,
                created_at,
                activo,
                ruta:ruta_id (nombre),
                turno:turno_id (
                    fecha,
                    hora_inicio,
                    hora_fin,
                    tipo_turno
                )
            `)
            .eq('supervisor_id', supervisorId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(a => {
            const turno: any = a.turno;
            const ruta: any = a.ruta;
            return {
                fecha: turno?.fecha,
                hora_inicio: turno?.hora_inicio,
                hora_fin: turno?.hora_fin,
                tipo_turno: turno?.tipo_turno,
                ruta_nombre: ruta?.nombre,
                estado: a.activo ? 'ACTIVA' : 'INACTIVA'
            };
        });
    }

    /**
     * Obtiene todas las minutas de los puestos de una ruta
     */
    async getMinutasRutaAsignada(ejecucionId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: ejecucion } = await supabase
            .from('rutas_supervision_ejecucion')
            .select('ruta_asignacion_id')
            .eq('id', ejecucionId)
            .single();

        const { data: asignacion } = await supabase
            .from('rutas_supervision_asignacion')
            .select('ruta_id')
            .eq('id', ejecucion?.ruta_asignacion_id)
            .single();

        const { data: puntos } = await supabase
            .from('rutas_supervision_puntos')
            .select('puesto_id')
            .eq('ruta_id', asignacion?.ruta_id);

        const puestoIds = (puntos || []).map(p => p.puesto_id);

        const { data: minutas } = await supabase
            .from('minutas')
            .select(`
                *,
                puesto:puesto_id (nombre)
            `)
            .in('puesto_id', puestoIds)
            .order('created_at', { ascending: false })
            .limit(50);

        return minutas;
    }

    /**
     * Registra información del dispositivo
     */
    async registrarDispositivo(dto: DispositivoInfoDto, supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        await supabase.from('rutas_supervision_eventos').insert({
            empleado_id: supervisorId,
            tipo_evento: 'gps',
            lat: 0, lng: 0,
            observacion: `DISPOSITIVO: ${dto.marca} ${dto.modelo} [${dto.sistema_operativo}] App v${dto.version_app}`
        });

        return { registrado: true, mensaje: 'Dispositivo verificado' };
    }

    /**
     * Obtiene información del dispositivo logueado
     */
    async getDispositivoInfo(supervisorId: number) {
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase
            .from('rutas_supervision_eventos')
            .select('*')
            .eq('empleado_id', supervisorId)
            .ilike('observacion', '%DISPOSITIVO:%')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        return { registrado: !!data, detalle: data?.observacion || 'No registrado' };
    }

    /**
     * Resuelve una novedad crítica desde Central
     */
    async resolverNovedad(dto: ResolverNovedadDto, adminId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('rutas_supervision_eventos')
            .update({
                observacion: `✅ RESUELTO: ${dto.resolucion} (por admin ID ${adminId})`,
                fecha: new Date()
            })
            .eq('id', dto.evento_id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}



