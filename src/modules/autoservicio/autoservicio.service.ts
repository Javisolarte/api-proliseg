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
    async getMiPerfil(userId: number) {
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
}
