import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PqrsfService } from '../pqrsf/pqrsf.service';

@Injectable()
export class AutoservicioService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly pqrsfService: PqrsfService
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
}
