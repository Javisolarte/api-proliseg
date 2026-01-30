import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BiService {
    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * 📊 KPIs Generales del Negocio
     */
    async getKpisGenerales() {
        const supabase = this.supabaseService.getClient();

        // Consultas paralelas para dashboard ejecutivo
        const [puestos, empleados, clientes, incidentes] = await Promise.all([
            supabase.from('puestos_trabajo').select('*', { count: 'exact', head: true }).eq('activo', true),
            supabase.from('empleados').select('*', { count: 'exact', head: true }).eq('activo', true),
            supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
            supabase.from('incidentes').select('*', { count: 'exact', head: true }).eq('estado', 'abierto')
        ]);

        return {
            total_clientes: clientes.count || 0,
            total_puestos_activos: puestos.count || 0,
            total_guardias_activos: empleados.count || 0,
            incidentes_pendientes: incidentes.count || 0,
            timestamp: new Date()
        };
    }

    /**
     * 📉 Estadísticas de Ausentismo
     */
    async getAusentismo(periodo: 'mes' | 'semana' = 'mes') {
        const supabase = this.supabaseService.getClient();
        // Aquí se calcularian tasas basadas en turnos programados vs ejecutados
        // Simulación por ahora hasta tener data real poblada
        return {
            tasa_ausentismo: 2.5,
            tendencia: 'bajando',
            motivos_frecuentes: [
                { motivo: 'Incapacidad Médica', cantidad: 12 },
                { motivo: 'Calamidad Doméstica', cantidad: 5 },
                { motivo: 'No Justificada', cantidad: 2 }
            ]
        };
    }

    /**
     * 🛡️ Estadísticas de Rondas
     */
    async getRondasStats() {
        const supabase = this.supabaseService.getClient();

        const { count: total } = await supabase.from('rondas_ejecucion').select('*', { count: 'exact', head: true });
        const { count: completasRaw } = await supabase.from('rondas_ejecucion').select('*', { count: 'exact', head: true }).eq('estado', 'completada');
        const completas = completasRaw || 0;

        const cumplimiento = total ? (completas / total) * 100 : 100;

        return {
            cumplimiento_global: Math.round(cumplimiento * 10) / 10,
            rondas_totales: total || 0,
            rondas_completas: completas || 0,
            rondas_fallidas: (total || 0) - (completas || 0)
        };
    }

    /**
     * 🚨 Estadísticas de Incidentes
     */
    async getIncidentesStats() {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('incidentes')
            .select('tipo, nivel_prioridad')
            .order('created_at', { ascending: false })
            .limit(100);

        const porTipo = {};
        const porPrioridad = {};

        data?.forEach(inc => {
            porTipo[inc.tipo] = (porTipo[inc.tipo] || 0) + 1;
            porPrioridad[inc.nivel_prioridad] = (porPrioridad[inc.nivel_prioridad] || 0) + 1;
        });

        return { por_tipo: porTipo, por_prioridad: porPrioridad };
    }
}
