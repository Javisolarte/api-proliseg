import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AutoservicioService {
    constructor(private readonly supabaseService: SupabaseService) { }

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
                puestos_trabajo(nombre),
                subpuestos_trabajo(nombre)
            `)
            .eq('empleado_id', empleado.id)
            .order('fecha', { ascending: false })
            .limit(50); // Limit to recent

        if (error) throw error;
        return data;
    }

    async getMisMinutas(userId: number) {
        const empleado = await this.getEmpleadoByUserId(userId);
        // Security: verify assignment?
        // Query minutas where employee is creator? Or by assigned post?
        // Usually creator or 'creada_por'
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('minutas')
            .select('*')
            .eq('creada_por', userId) // userId matches session
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // ------------------------------------------------------------------
    // CLIENTE
    // ------------------------------------------------------------------
    async getMiContratoCliente(userId: number) {
        const cliente = await this.getClienteByUserId(userId);
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('contratos')
            .select(`
                *,
                tipo_servicio(nombre),
                puestos_trabajo(nombre, direccion, ciudad)
            `)
            .eq('cliente_id', cliente.id)
            .eq('estado', true);

        if (error) throw error;
        return data;
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
}
