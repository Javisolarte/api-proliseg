import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../modules/supabase/supabase.service';

interface Grupo {
    letra: string;
    empleados: any[];
    ordenInicial: number;
}

interface ValidationResult {
    valido: boolean;
    empleadosNecesarios: number;
    empleadosAsignados: number;
    faltantes: number;
    mensaje: string;
}

@Injectable()
export class TurnosHelperService {
    private readonly logger = new Logger(TurnosHelperService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * 🔢 Calcula cuántos empleados se necesitan para cubrir un subpuesto
     * Fórmula: Empleados Necesarios = Guardas Activos × Estados del Ciclo
     */
    async calcularEmpleadosNecesarios(
        guardasActivos: number,
        configuracionId: number,
    ): Promise<number> {
        const estadosCiclo = await this.calcularEstadosCiclo(configuracionId);
        const empleadosNecesarios = guardasActivos * estadosCiclo;

        this.logger.log(
            `📊 Cálculo: ${guardasActivos} guardas × ${estadosCiclo} estados = ${empleadosNecesarios} empleados necesarios`,
        );

        return empleadosNecesarios;
    }

    /**
     * 📈 Calcula cuántos estados únicos tiene una configuración
     * Para 2D-2N-2Z: 3 estados (DIA, NOCHE, DESCANSO)
     */
    async calcularEstadosCiclo(configuracionId: number): Promise<number> {
        const supabase = this.supabaseService.getClient();

        const { data: detalles, error } = await supabase
            .from('turnos_detalle_configuracion')
            .select('tipo')
            .eq('configuracion_id', configuracionId);

        if (error || !detalles || detalles.length === 0) {
            this.logger.warn(
                `⚠️ No se encontraron detalles para configuración ${configuracionId}, usando valor por defecto 3`,
            );
            return 3; // Valor por defecto para 2D-2N-2Z
        }

        // Contar estados únicos
        const estadosUnicos = new Set(detalles.map((d) => d.tipo));
        const count = estadosUnicos.size;

        this.logger.log(
            `📋 Configuración ${configuracionId} tiene ${count} estados: ${Array.from(estadosUnicos).join(', ')}`,
        );

        return count;
    }

    /**
     * ✅ Valida si un subpuesto tiene todos los empleados necesarios asignados
     */
    async validarAsignacionCompleta(
        subpuestoId: number,
        guardasActivos: number,
        configuracionId: number,
    ): Promise<ValidationResult> {
        const supabase = this.supabaseService.getClient();

        // Calcular empleados necesarios
        const empleadosNecesarios = await this.calcularEmpleadosNecesarios(
            guardasActivos,
            configuracionId,
        );

        // Contar empleados asignados activos
        const { count: empleadosAsignados, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select('*', { count: 'exact', head: true })
            .eq('subpuesto_id', subpuestoId)
            .eq('activo', true);

        if (error) {
            this.logger.error(`❌ Error contando asignaciones: ${error.message}`);
        }

        const asignados = empleadosAsignados || 0;
        const faltantes = Math.max(0, empleadosNecesarios - asignados);
        const valido = asignados === empleadosNecesarios;

        let mensaje: string;
        if (valido) {
            mensaje = `✅ Asignación completa: ${asignados}/${empleadosNecesarios} empleados`;
        } else if (asignados < empleadosNecesarios) {
            mensaje = `⚠️ Faltan ${faltantes} empleados para completar el ciclo (${asignados}/${empleadosNecesarios})`;
        } else {
            mensaje = `⚠️ Hay ${asignados - empleadosNecesarios} empleados de más (${asignados}/${empleadosNecesarios})`;
        }

        this.logger.log(mensaje);

        return {
            valido,
            empleadosNecesarios,
            empleadosAsignados: asignados,
            faltantes,
            mensaje,
        };
    }

    /**
     * 👥 Crea grupos de rotación a partir de los empleados asignados
     * Para 2D-2N-2Z con 2 guardas activos: 3 grupos de 2 empleados cada uno
     */
    async crearGruposRotacion(
        subpuestoId: number,
        guardasActivos: number,
        configuracionId: number,
    ): Promise<Grupo[]> {
        const supabase = this.supabaseService.getClient();

        // Obtener empleados asignados ordenados por fecha de asignación
        const { data: asignaciones, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select(
                `
        id,
        empleado_id,
        fecha_asignacion,
        empleado:empleado_id (
          id,
          nombre_completo,
          cedula
        )
      `,
            )
            .eq('subpuesto_id', subpuestoId)
            .eq('activo', true)
            .order('fecha_asignacion', { ascending: true });

        if (error || !asignaciones) {
            throw new Error(`Error obteniendo empleados: ${error?.message}`);
        }

        const empleados = asignaciones.map((a) => ({
            id: a.empleado_id,
            ...(Array.isArray(a.empleado) ? a.empleado[0] : a.empleado),
        }));

        // Calcular número de grupos (estados del ciclo)
        const estadosCiclo = await this.calcularEstadosCiclo(configuracionId);
        const grupos: Grupo[] = [];

        // Dividir empleados en grupos equitativos
        for (let i = 0; i < estadosCiclo; i++) {
            const grupo: Grupo = {
                letra: String.fromCharCode(65 + i), // A, B, C, ...
                empleados: empleados.slice(
                    i * guardasActivos,
                    (i + 1) * guardasActivos,
                ),
                ordenInicial: i, // 0=DÍA, 1=NOCHE, 2=DESCANSO
            };
            grupos.push(grupo);
        }

        this.logger.log(
            `👥 Creados ${grupos.length} grupos con ${guardasActivos} empleados cada uno`,
        );

        return grupos;
    }

    /**
     * 📅 Calcula en qué día del ciclo estamos
     * Para 2D-2N-2Z: retorna 0-5 (ciclo de 6 días)
     */
    calcularDiaEnCiclo(fecha: Date, diasCiclo: number): number {
        // Usar fecha de referencia fija (2025-01-01)
        const fechaReferencia = new Date('2025-01-01');
        const diffTime = fecha.getTime() - fechaReferencia.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        const diaEnCiclo = diffDays % diasCiclo;

        this.logger.debug(
            `📅 Fecha ${fecha.toISOString().split('T')[0]} → Día ${diaEnCiclo} del ciclo (${diasCiclo} días)`,
        );

        return diaEnCiclo;
    }

    /**
     * 🔄 Calcula qué estado (DÍA/NOCHE/DESCANSO) le corresponde a un grupo en un día específico
     * Para 2D-2N-2Z: cada estado dura 2 días, luego rota
     */
    calcularEstadoGrupo(
        ordenInicial: number,
        diaEnCiclo: number,
        diasCiclo: number,
        estadosCiclo: number,
    ): string {
        // Para 2D-2N-2Z:
        // - Cada estado dura 2 días (diasCiclo / estadosCiclo = 6 / 3 = 2)
        // - Total 6 días en el ciclo

        const diasPorEstado = diasCiclo / estadosCiclo;

        // Calcular en qué "bloque" del ciclo estamos (0, 1, o 2)
        const bloqueActual = Math.floor(diaEnCiclo / diasPorEstado);

        // Rotar el estado según el orden inicial del grupo
        const estadoIndex = (ordenInicial + bloqueActual) % estadosCiclo;

        const estados = ['DIA', 'NOCHE', 'DESCANSO'];
        const estado = estados[estadoIndex];

        this.logger.debug(
            `🔄 Grupo orden ${ordenInicial}, día ${diaEnCiclo} → bloque ${bloqueActual} → estado ${estado}`,
        );

        return estado;
    }

    /**
     * 🔍 Obtiene los detalles de un tipo de turno desde la configuración
     */
    async obtenerDetalleTurno(
        tipoTurno: string,
        configuracionId: number,
    ): Promise<any> {
        const supabase = this.supabaseService.getClient();

        const { data: detalle, error } = await supabase
            .from('turnos_detalle_configuracion')
            .select('*')
            .eq('configuracion_id', configuracionId)
            .eq('tipo', tipoTurno)
            .single();

        if (error || !detalle) {
            this.logger.warn(
                `⚠️ No se encontró detalle para turno ${tipoTurno}, usando valores por defecto`,
            );
            // Valores por defecto según el tipo
            const defaults: Record<string, any> = {
                DIA: { hora_inicio: '08:00:00', hora_fin: '20:00:00' },
                NOCHE: { hora_inicio: '20:00:00', hora_fin: '08:00:00' },
                DESCANSO: { hora_inicio: '00:00:00', hora_fin: '00:00:00' },
            };
            return defaults[tipoTurno] || defaults.DIA;
        }

        return detalle;
    }
}
