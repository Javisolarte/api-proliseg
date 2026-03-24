import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

// ══════════════════════════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════════════════════════
interface HorasDesglose {
    diurnas: number;
    nocturnas: number;
    total: number;
}

interface ClasificacionHoras {
    ord_diurnas: number;
    ord_nocturnas: number;
    ord_dominical_diurnas: number;
    ord_dominical_nocturnas: number;
    ord_festiva_diurnas: number;
    ord_festiva_nocturnas: number;
    ext_diurnas: number;
    ext_nocturnas: number;
    ext_dominical_diurnas: number;
    ext_dominical_nocturnas: number;
    ext_festiva_diurnas: number;
    ext_festiva_nocturnas: number;
}

interface TurnoAnalizado {
    fecha: string;
    tipo: string;
    diurnas: number;
    nocturnas: number;
    total: number;
    esDomingo: boolean;
    esFestivo: boolean;
}

@Injectable()
export class NominaService {
    private readonly logger = new Logger(NominaService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly auditoriaService: AuditoriaService,
    ) { }

    // ══════════════════════════════════════════════════════════
    // HELPERS: Cálculo de Horas
    // ══════════════════════════════════════════════════════════

    /**
     * Convierte 'HH:MM:SS' o 'HH:MM' a minutos desde medianoche
     */
    private timeToMinutes(time: string): number {
        if (!time) return 0;
        const parts = time.split(':').map(Number);
        return parts[0] * 60 + (parts[1] || 0);
    }

    /**
     * Calcula horas diurnas y nocturnas de un turno
     * Diurna: 6:00 (360min) a 21:00 (1260min) - Art 160 CST
     * Nocturna: 21:00 (1260min) a 6:00 (360min)
     */
    private calcularHorasDiurnasNocturnas(horaInicio: string, horaFin: string): HorasDesglose {
        const DIURNA_START = 6 * 60;  // 360 min
        const DIURNA_END = 19 * 60;   // 1140 min (Ley 2101/2021: nocturno desde 19:00)

        const inicioMin = this.timeToMinutes(horaInicio);
        const finMin = this.timeToMinutes(horaFin);

        // Segmentos del turno (puede cruzar medianoche)
        const segments: [number, number][] = [];
        if (finMin <= inicioMin) {
            segments.push([inicioMin, 1440]);
            segments.push([0, finMin]);
        } else {
            segments.push([inicioMin, finMin]);
        }

        let diurnasMins = 0;
        let nocturnasMins = 0;

        for (const [start, end] of segments) {
            const diurnaOverlap = Math.max(0, Math.min(end, DIURNA_END) - Math.max(start, DIURNA_START));
            const segmentTotal = end - start;
            diurnasMins += diurnaOverlap;
            nocturnasMins += (segmentTotal - diurnaOverlap);
        }

        return {
            diurnas: Math.round((diurnasMins / 60) * 100) / 100,
            nocturnas: Math.round((nocturnasMins / 60) * 100) / 100,
            total: Math.round(((diurnasMins + nocturnasMins) / 60) * 100) / 100,
        };
    }

    /**
     * Determina si una fecha es domingo
     */
    private esDomingo(fechaStr: string): boolean {
        const d = new Date(fechaStr + 'T12:00:00');
        return d.getDay() === 0;
    }

    /**
     * Determina si una fecha está en la lista de festivos
     */
    private esFestivo(fechaStr: string, festivos: Set<string>): boolean {
        return festivos.has(fechaStr);
    }

    /**
     * Obtiene la semana ISO a la que pertenece una fecha (Lun-Dom)
     */
    private getWeekKey(fechaStr: string): string {
        const d = new Date(fechaStr + 'T12:00:00');
        d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
        const week1 = new Date(d.getFullYear(), 0, 4);
        const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
        return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
    }

    /**
     * Mapea tipo_turno a código normalizado
     */
    private normalizarTipoTurno(tipoTurno?: string): string {
        if (!tipoTurno) return '';
        const t = tipoTurno.toLowerCase().trim();
        if (t === 'd' || t === 'dia' || t === 'día' || t.includes('diurno')) return 'D';
        if (t === 'n' || t === 'noche' || t.includes('nocturno')) return 'N';
        if (t === 'z' || t === 'descanso' || t.includes('descanso')) return 'Z';
        if (t === 'pnr') return 'PNR';
        if (t === 'lic' || t.includes('licencia')) return 'LIC';
        if (t === 'v' || t === 'vac' || t.includes('vacacion')) return 'VAC';
        if (t === 'inc' || t.includes('incapacidad')) return 'INC';
        if (t === 'san' || t.includes('sancion') || t.includes('sanción')) return 'SAN';
        if (t === 't' || t.includes('tarde')) return 'D';
        return t.toUpperCase();
    }

    /**
     * Clasifica las horas semanales en ordinarias y extras (>44h)
     */
    private clasificarHorasSemanales(
        turnosSemana: TurnoAnalizado[],
        jornadaMaxima: number
    ): ClasificacionHoras {
        turnosSemana.sort((a, b) => a.fecha.localeCompare(b.fecha));

        const result: ClasificacionHoras = {
            ord_diurnas: 0, ord_nocturnas: 0,
            ord_dominical_diurnas: 0, ord_dominical_nocturnas: 0,
            ord_festiva_diurnas: 0, ord_festiva_nocturnas: 0,
            ext_diurnas: 0, ext_nocturnas: 0,
            ext_dominical_diurnas: 0, ext_dominical_nocturnas: 0,
            ext_festiva_diurnas: 0, ext_festiva_nocturnas: 0,
        };

        let acumuladas = 0;

        for (const turno of turnosSemana) {
            const totalTurno = turno.total;
            if (totalTurno <= 0) continue;

            const esDomFest = turno.esDomingo || turno.esFestivo;
            const soloFestivo = turno.esFestivo && !turno.esDomingo;

            if (acumuladas >= jornadaMaxima) {
                // Todo es extra
                if (soloFestivo) {
                    result.ext_festiva_diurnas += turno.diurnas;
                    result.ext_festiva_nocturnas += turno.nocturnas;
                } else if (turno.esDomingo) {
                    result.ext_dominical_diurnas += turno.diurnas;
                    result.ext_dominical_nocturnas += turno.nocturnas;
                } else {
                    result.ext_diurnas += turno.diurnas;
                    result.ext_nocturnas += turno.nocturnas;
                }
            } else if (acumuladas + totalTurno > jornadaMaxima) {
                // Parte ordinaria, parte extra
                const horasOrd = jornadaMaxima - acumuladas;
                const horasExt = totalTurno - horasOrd;
                const propD = totalTurno > 0 ? turno.diurnas / totalTurno : 0;
                const propN = totalTurno > 0 ? turno.nocturnas / totalTurno : 0;

                if (soloFestivo) {
                    result.ord_festiva_diurnas += horasOrd * propD;
                    result.ord_festiva_nocturnas += horasOrd * propN;
                    result.ext_festiva_diurnas += horasExt * propD;
                    result.ext_festiva_nocturnas += horasExt * propN;
                } else if (turno.esDomingo) {
                    result.ord_dominical_diurnas += horasOrd * propD;
                    result.ord_dominical_nocturnas += horasOrd * propN;
                    result.ext_dominical_diurnas += horasExt * propD;
                    result.ext_dominical_nocturnas += horasExt * propN;
                } else {
                    result.ord_diurnas += horasOrd * propD;
                    result.ord_nocturnas += horasOrd * propN;
                    result.ext_diurnas += horasExt * propD;
                    result.ext_nocturnas += horasExt * propN;
                }
            } else {
                // Todo ordinario
                if (soloFestivo) {
                    result.ord_festiva_diurnas += turno.diurnas;
                    result.ord_festiva_nocturnas += turno.nocturnas;
                } else if (turno.esDomingo) {
                    result.ord_dominical_diurnas += turno.diurnas;
                    result.ord_dominical_nocturnas += turno.nocturnas;
                } else {
                    result.ord_diurnas += turno.diurnas;
                    result.ord_nocturnas += turno.nocturnas;
                }
            }
            acumuladas += totalTurno;
        }

        // Redondear todo a 2 decimales
        for (const key of Object.keys(result)) {
            result[key] = Math.round(result[key] * 100) / 100;
        }

        return result;
    }

    private calcularLiquidacionEmpleado(
        turnos: any[],
        salarioBase: number,
        parametros: any[],
        festivos: Set<string>,
        novedades: any[],
        salarioFijo: number = 0,
    ) {
        const getParam = (tipo: string): number => {
            const p = parametros.find(p => p.tipo === tipo);
            return p ? Number(p.multiplicador) : 0;
        };

        const jornadaMaxima = getParam('jornada_maxima_semanal') || 44;
        const smlmv = getParam('salario_minimo') || 1750905;
        const auxTransporteBase = getParam('auxilio_transporte') || 249095;
        const topeAuxSmlmv = getParam('tope_auxilio_transporte_smlmv') || 2;

        // Recargos
        const factorRN = getParam('recargo_nocturno') || 0.35;
        const factorDomFest = getParam('recargo_dominical_festivo') || 0.80;
        const factorNocDomFest = getParam('recargo_nocturno_dominical') || 1.15;

        // Extras
        const factorHED = getParam('hora_extra_diurna') || 1.25;
        const factorHEN = getParam('hora_extra_nocturna') || 1.80;
        const factorHEDD = getParam('hora_extra_dominical_diurna') || 2.05;
        const factorHEDN = getParam('hora_extra_dominical_nocturna') || 2.55;

        const valorHora = salarioBase / 240;

        // Conteo de turnos por tipo
        let turnosDiurnos = 0, turnosNocturnos = 0, turnosDescanso = 0;
        let turnosPNR = 0, turnosLIC = 0, turnosVAC = 0, turnosINC = 0, turnosSAN = 0;

        // Analizar turnos
        const turnosAnalizados: TurnoAnalizado[] = [];
        const turnosPorSemana: Record<string, TurnoAnalizado[]> = {};

        for (const turno of turnos) {
            const tipo = this.normalizarTipoTurno(turno.tipo_turno);
            const fechaStr = typeof turno.fecha === 'string' ? turno.fecha.substring(0, 10) : turno.fecha;

            switch (tipo) {
                case 'PNR': turnosPNR++; continue;
                case 'SAN': turnosSAN++; continue;
                case 'Z': turnosDescanso++; continue;
                case 'LIC': turnosLIC++; continue;
                case 'VAC': turnosVAC++; continue;
                case 'INC': turnosINC++; continue;
            }

            // Solo D y N se calculan como horas trabajadas
            if (tipo !== 'D' && tipo !== 'N') continue;

            if (tipo === 'D') turnosDiurnos++;
            if (tipo === 'N') turnosNocturnos++;

            // Calcular horas reales del turno
            let horas: HorasDesglose;
            if (turno.hora_inicio && turno.hora_fin) {
                horas = this.calcularHorasDiurnasNocturnas(turno.hora_inicio, turno.hora_fin);
            } else {
                // Fallback si no hay hora_inicio/hora_fin
                horas = tipo === 'N'
                    ? { diurnas: 3, nocturnas: 9, total: 12 }
                    : { diurnas: 12, nocturnas: 0, total: 12 };
            }

            const esDomingo = this.esDomingo(fechaStr);
            const esFestivo = this.esFestivo(fechaStr, festivos);

            const turnoAnalizado: TurnoAnalizado = {
                fecha: fechaStr,
                tipo,
                diurnas: horas.diurnas,
                nocturnas: horas.nocturnas,
                total: horas.total,
                esDomingo,
                esFestivo,
            };
            turnosAnalizados.push(turnoAnalizado);

            const weekKey = this.getWeekKey(fechaStr);
            if (!turnosPorSemana[weekKey]) turnosPorSemana[weekKey] = [];
            turnosPorSemana[weekKey].push(turnoAnalizado);
        }

        // Clasificar horas por semana
        const totalClasificacion: ClasificacionHoras = {
            ord_diurnas: 0, ord_nocturnas: 0,
            ord_dominical_diurnas: 0, ord_dominical_nocturnas: 0,
            ord_festiva_diurnas: 0, ord_festiva_nocturnas: 0,
            ext_diurnas: 0, ext_nocturnas: 0,
            ext_dominical_diurnas: 0, ext_dominical_nocturnas: 0,
            ext_festiva_diurnas: 0, ext_festiva_nocturnas: 0,
        };

        for (const weekTurnos of Object.values(turnosPorSemana)) {
            const semana = this.clasificarHorasSemanales(weekTurnos, jornadaMaxima);
            for (const key of Object.keys(totalClasificacion)) {
                totalClasificacion[key] += semana[key];
            }
        }

        // Redondear
        for (const key of Object.keys(totalClasificacion)) {
            totalClasificacion[key] = Math.round(totalClasificacion[key] * 100) / 100;
        }

        const c = totalClasificacion;

        // ═══ CALCULAR VALORES ═══

        // Recargos (sobre horas ordinarias - solo el % adicional)
        let recargoNocturno = c.ord_nocturnas * valorHora * factorRN;
        const recargoDominicalDiurno = c.ord_dominical_diurnas * valorHora * factorDomFest;
        const recargoDominicalNocturno = c.ord_dominical_nocturnas * valorHora * factorNocDomFest;
        const recargoFestivoDiurno = c.ord_festiva_diurnas * valorHora * factorDomFest;
        const recargoFestivoNocturno = c.ord_festiva_nocturnas * valorHora * factorNocDomFest;

        let totalRecargos = recargoNocturno + recargoDominicalDiurno + recargoDominicalNocturno
            + recargoFestivoDiurno + recargoFestivoNocturno;

        // Extras (valor completo de la hora extra)
        let valorHED = c.ext_diurnas * valorHora * factorHED;
        const valorHEN = c.ext_nocturnas * valorHora * factorHEN;
        const valorHEDD = c.ext_dominical_diurnas * valorHora * factorHEDD;
        const valorHEDN = c.ext_dominical_nocturnas * valorHora * factorHEDN;
        const valorHEFD = c.ext_festiva_diurnas * valorHora * factorHEDD;
        const valorHEFN = c.ext_festiva_nocturnas * valorHora * factorHEDN;

        let totalExtras = valorHED + valorHEN + valorHEDD + valorHEDN + valorHEFD + valorHEFN;

        // Descuentos por PNR y SAN (días no pagados)
        const valorDia = salarioBase / 30;
        const descuentoPNR = turnosPNR * valorDia;
        const descuentoSAN = turnosSAN * valorDia;

        // LIC: se paga el día ordinario sin auxilio de transporte
        const valorLicencia = turnosLIC * valorDia;

        // VAC: días netos pagados
        const valorVacaciones = turnosVAC * valorDia;

        // INC: primeros 2 días 100% empleador, desde día 3 EPS 66.67%
        let valorIncapacidad = 0;
        if (turnosINC > 0) {
            const diasEmpleador = Math.min(turnosINC, 2);
            const diasEPS = Math.max(turnosINC - 2, 0);
            valorIncapacidad = (diasEmpleador * valorDia) + (diasEPS * valorDia * 0.6667);
        }

        // Salario devengado base (descontando PNR y SAN)
        const salarioDevengado = salarioBase - descuentoPNR - descuentoSAN;

        // Auxilio de transporte (proporcional, solo si ≤ 2 SMLMV)
        // Se paga por 30 días menos los días que no dan derecho (PNR, SAN, VAC, INC, LIC)
        const diasNoAuxilio = turnosPNR + turnosSAN + turnosVAC + turnosINC + turnosLIC;
        const diasAuxilio = Math.max(0, 30 - diasNoAuxilio);
        
        let auxTransporte = 0;
        if (salarioBase <= smlmv * topeAuxSmlmv) {
            auxTransporte = Math.round((diasAuxilio / 30) * auxTransporteBase);
        }

        // Total devengado antes del ajuste de salario fijo
        let totalDevengado = salarioDevengado + totalRecargos + totalExtras
            + auxTransporte + valorLicencia + valorVacaciones + valorIncapacidad;

        // ═══ AJUSTE SALARIO FIJO (Si aplica) ═══
        let ajusteSalarial = 0;
        if (salarioFijo > 0) {
            // El objetivo es que el Total Devengado (o base + transport + extras) llegue al SalarioFijo
            // Se descuente proporcionalmente por días no pagados (PNR, Sanciones)
            const diasPagados = 30 - turnosPNR - turnosSAN;
            const targetNetoAjustado = Math.round((salarioFijo / 30) * diasPagados);
            
            // Queremos que Neto = 0.92 * (IBC) + AuxTransporte = targetNetoAjustado
            // Donde IBC = DevengadoTotal - AuxTransporte
            // Neto = 0.92 * (DevengadoTotal - AuxTransporte) + AuxTransporte = targetNetoAjustado
            // DevengadoTotal = (targetNetoAjustado - AuxTransporte) / 0.92 + AuxTransporte
            const devengadoRequerido = Math.round((targetNetoAjustado - auxTransporte) / 0.92 + auxTransporte);
            
            if (devengadoRequerido > totalDevengado) {
                ajusteSalarial = devengadoRequerido - totalDevengado;
                
                // Distribución sugerida por el usuario en Extras/Recargos
                const parteExtras = Math.round(ajusteSalarial * 0.7);
                const parteRecargos = ajusteSalarial - parteExtras;
                
                valorHED += parteExtras;
                recargoNocturno += parteRecargos;
                
                // Actualizar totales de salida
                totalExtras += parteExtras;
                totalRecargos += parteRecargos;
                totalDevengado = devengadoRequerido;
            }
        }

        // IBC (Ingreso Base Cotización = devengado - auxilio transporte)
        const ibc = totalDevengado - auxTransporte;

        // Deducciones legales empleado
        const saludEmpleado = getParam('salud_empleado') || 4;
        const pensionEmpleado = getParam('pension_empleado') || 4;
        const deduccionSalud = Math.round(ibc * (saludEmpleado / 100));
        const deduccionPension = Math.round(ibc * (pensionEmpleado / 100));
        const totalDeducciones = deduccionSalud + deduccionPension;

        const netoPagar = Math.round(totalDevengado - totalDeducciones);

        // ════ APROVISIONAMIENTO (COSTO EMPRESA) ════
        // Base Prestacional: todo el devengado, INCLUYENDO auxilio de transporte
        const basePrestacional = totalDevengado;
        
        // Base Vacaciones: devengado EXCLUYENDO auxilio de transporte + recargos y extras nocturnos/dominicales habituales
        // Por ley, las vacaciones se liquidan sobre el salario base + recargos fijos (se excluye el auxilio de transporte)
        const baseVacaciones = totalDevengado - auxTransporte;

        const pPrima = getParam('prima_servicios') || 8.33;
        const pCesantias = getParam('cesantias') || 8.33;
        const pIntCesantias = getParam('intereses_cesantias') || 12; // 1% mensual = 12% anual
        const pVacaciones = getParam('vacaciones') || 4.17;
        const pPensionEmpleador = getParam('pension_empleador') || 12;

        const provisionPrima = Math.round(basePrestacional * (pPrima / 100));
        const provisionCesantias = Math.round(basePrestacional * (pCesantias / 100));
        // Intereses de cesantías es el 12% DE la provisión de cesantías
        const provisionIntereses = Math.round(provisionCesantias * (pIntCesantias / 100));
        const provisionVacaciones = Math.round(baseVacaciones * (pVacaciones / 100));
        
        // Aportes empleador (Pensión 12% sobre el IBC)
        const provisionPensionEmp = Math.round(ibc * (pPensionEmpleador / 100));

        // Costo Total para la empresa = Devengado + Provisiones + Seguridad Social Empleador
        const costoTotalEmpresa = Math.round(totalDevengado + provisionPrima + provisionCesantias + provisionIntereses + provisionVacaciones + provisionPensionEmp);

        return {
            // Conteo turnos
            turnos_diurnos: turnosDiurnos,
            turnos_nocturnos: turnosNocturnos,
            turnos_descanso: turnosDescanso,
            turnos_pnr: turnosPNR,
            turnos_licencia: turnosLIC,
            turnos_vacaciones: turnosVAC,
            turnos_incapacidad: turnosINC,
            turnos_sancion: turnosSAN,
            // Horas clasificadas
            horas_ordinarias_diurnas: c.ord_diurnas,
            horas_ordinarias_nocturnas: c.ord_nocturnas,
            horas_dominical_diurnas: c.ord_dominical_diurnas,
            horas_dominical_nocturnas: c.ord_dominical_nocturnas,
            horas_festiva_diurnas: c.ord_festiva_diurnas,
            horas_festiva_nocturnas: c.ord_festiva_nocturnas,
            horas_extra_diurnas: c.ext_diurnas,
            horas_extra_nocturnas: c.ext_nocturnas,
            horas_extra_dominical_diurnas: c.ext_dominical_diurnas,
            horas_extra_dominical_nocturnas: c.ext_dominical_nocturnas,
            horas_extra_festiva_diurnas: c.ext_festiva_diurnas,
            horas_extra_festiva_nocturnas: c.ext_festiva_nocturnas,
            // Valores
            valor_hora: Math.round(valorHora),
            salario_base_valor: salarioBase,
            salario_devengado: salarioDevengado,
            descuento_pnr: Math.round(descuentoPNR),
            descuento_sancion: Math.round(descuentoSAN),
            valor_licencia: Math.round(valorLicencia),
            valor_vacaciones: Math.round(valorVacaciones),
            valor_incapacidad: Math.round(valorIncapacidad),
            // Recargos
            recargo_nocturno_valor: Math.round(recargoNocturno),
            recargo_dominical_valor: Math.round(recargoDominicalDiurno + recargoFestivoDiurno),
            recargo_festivo_valor: Math.round(recargoFestivoDiurno),
            recargo_nocturno_dominical_valor: Math.round(recargoDominicalNocturno),
            recargo_nocturno_festivo_valor: Math.round(recargoFestivoNocturno),
            // Extras
            valor_he_diurna: Math.round(valorHED),
            valor_he_nocturna: Math.round(valorHEN),
            valor_he_dominical_diurna: Math.round(valorHEDD),
            valor_he_dominical_nocturna: Math.round(valorHEDN),
            valor_he_festiva_diurna: Math.round(valorHEFD),
            valor_he_festiva_nocturna: Math.round(valorHEFN),
            // Auxilio
            auxilio_transporte_valor: auxTransporte,
            // Totales
            total_recargos: Math.round(totalRecargos),
            total_horas_extra: Math.round(totalExtras),
            total_devengado: Math.round(totalDevengado),
            ajuste_salarial: Math.round(ajusteSalarial),
            ibc: Math.round(ibc),
            deduccion_salud: deduccionSalud,
            deduccion_pension: deduccionPension,
            deducciones_otras: 0,
            total_deducciones: totalDeducciones,
            total_pagar: netoPagar,
            // Aprovisionamiento
            provision_prima: provisionPrima,
            provision_cesantias: provisionCesantias,
            provision_intereses_cesantias: provisionIntereses,
            provision_vacaciones: provisionVacaciones,
            provision_pension_empleador: provisionPensionEmp,
            costo_total_empresa: costoTotalEmpresa,
            generado: true,
        };
    }

    // ══════════════════════════════════════════════════════════
    // PERIODOS
    // ══════════════════════════════════════════════════════════

    async createPeriod(dto: any, userId: number) {
        const supabase = this.supabaseService.getClient();

        const { data: existing } = await supabase
            .from('nomina_periodos')
            .select('id')
            .eq('anio', dto.anio)
            .eq('mes', dto.mes)
            .single();

        if (existing) throw new BadRequestException(`El periodo ${dto.anio}-${dto.mes} ya existe.`);

        const { data, error } = await supabase
            .from('nomina_periodos')
            .insert({
                anio: dto.anio,
                mes: dto.mes,
                fecha_inicio: dto.fecha_inicio,
                fecha_fin: dto.fecha_fin,
                cerrado: dto.cerrado || false
            })
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_periodos',
            registro_id: data.id,
            accion: 'INSERT',
            datos_nuevos: data,
            usuario_id: userId
        });

        return data;
    }

    async getAllPeriodos() {
        const supabase = this.supabaseService.getClient();
        
        // Obtenemos los periodos
        const { data: periodos, error: pError } = await supabase
            .from('nomina_periodos')
            .select('*')
            .order('anio', { ascending: false })
            .order('mes', { ascending: false });
            
        if (pError) throw pError;
        
        // Para cada periodo, obtenemos el conteo y la suma de neto
        const enrichedPeriodos = await Promise.all(periodos.map(async (p) => {
            const { data: stats, error: sError } = await supabase
                .from('nomina_empleado')
                .select('total_neto')
                .eq('periodo_id', p.id);
                
            if (sError) return { ...p, empleados_count: 0, total_neto: 0 };
            
            return {
                ...p,
                empleados_count: stats.length,
                total_neto: stats.reduce((sum, item) => sum + (item.total_neto || 0), 0)
            };
        }));
        
        return enrichedPeriodos;
    }

    async closePeriod(periodoId: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: periodo } = await supabase.from('nomina_periodos').select('*').eq('id', periodoId).single();
        if (!periodo) throw new NotFoundException('Periodo no encontrado');
        if (periodo.cerrado) throw new BadRequestException('El periodo ya está cerrado');

        const { error } = await supabase
            .from('nomina_periodos')
            .update({ cerrado: true })
            .eq('id', periodoId);

        if (error) throw new InternalServerErrorException('Error al cerrar el periodo');

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_periodos',
            registro_id: periodoId,
            accion: 'UPDATE',
            datos_anteriores: { cerrado: false },
            datos_nuevos: { cerrado: true },
            usuario_id: userId
        });

        return { message: 'Periodo cerrado exitosamente' };
    }

    async recalculatePeriod(periodoId: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: periodo } = await supabase.from('nomina_periodos').select('*').eq('id', periodoId).single();
        if (!periodo) throw new NotFoundException('Periodo no encontrado');
        if (periodo.cerrado) throw new BadRequestException('No se puede recalcular un periodo cerrado');
        return this.generarNomina(periodo.anio, periodo.mes, userId);
    }

    // ══════════════════════════════════════════════════════════
    // GENERAR NÓMINA (Motor Principal)
    // ══════════════════════════════════════════════════════════

    async generarNomina(anio: number, mes: number, userId: number) {
        const supabase = this.supabaseService.getSupabaseAdminClient();

        // 1. Periodo
        const { data: periodo } = await supabase
            .from('nomina_periodos')
            .select('*')
            .eq('anio', anio)
            .eq('mes', mes)
            .single();

        if (!periodo) throw new NotFoundException('Periodo de nómina no encontrado. Debe crearlo primero.');
        if (periodo.cerrado) throw new BadRequestException('El periodo de nómina ya está cerrado.');

        this.logger.log(`>> Generando Nómina: ${anio}-${mes} | Periodo: ${periodo.fecha_inicio} al ${periodo.fecha_fin}`);

        // ════ LIMPIEZA PREVIA (Sincronización) ════
        // Borramos registros previos de este periodo para que si un empleado fue quitado de los turnos,
        // ya no aparezca en la nómina al regenerar.
        const { data: nominasPrevias } = await supabase
            .from('nomina_empleado')
            .select('id')
            .eq('periodo_id', periodo.id);

        if (nominasPrevias && nominasPrevias.length > 0) {
            const idsPrevios = nominasPrevias.map(n => n.id);
            await supabase.from('nomina_empleado_deducciones').delete().in('nomina_empleado_id', idsPrevios);
            await supabase.from('nomina_empleado').delete().eq('periodo_id', periodo.id);
        }

        // 2. Parámetros
        const { data: parametros } = await supabase
            .from('nomina_valores_hora')
            .select('*')
            .eq('anio', anio)
            .eq('activo', true);

        if (!parametros || parametros.length === 0) {
            throw new BadRequestException(`No hay parámetros de nómina configurados para el año ${anio}. Ejecuta la migración SQL.`);
        }

        const smlmv = Number(parametros.find(p => p.tipo === 'salario_minimo')?.multiplicador || 1750905);

        // 3. Festivos
        const { data: festivosData } = await supabase
            .from('nomina_festivos_colombia')
            .select('fecha')
            .eq('anio', anio);

        const festivos = new Set<string>((festivosData || []).map(f => f.fecha));

        // 4. Deducciones activas
        const { data: deducciones } = await supabase
            .from('nomina_deducciones')
            .select('*')
            .eq('activo', true);

        // 5. Contratos activos
        const { data: contratosRaw, error: errContratos } = await supabase
            .from('contratos_personal')
            .select(`
                *,
                empleados!fk_contrato_empleado!inner (
                    id,
                    nombre_completo,
                    cedula
                ),
                salarios (
                    valor
                )
            `)
            .lte('fecha_inicio', periodo.fecha_fin);

        if (errContratos) throw new InternalServerErrorException(errContratos.message);

        const periodStart = new Date(periodo.fecha_inicio);
        const contratos = contratosRaw?.filter(c => !c.fecha_fin || new Date(c.fecha_fin) >= periodStart) || [];

        if (contratos.length === 0) {
            throw new BadRequestException('No hay contratos activos para generar nómina.');
        }

        // 6. Todos los turnos del periodo
        const { data: turnosRaw, error: errTurnos } = await supabase
            .from('turnos')
            .select('*')
            .gte('fecha', periodo.fecha_inicio)
            .lte('fecha', periodo.fecha_fin);

        if (errTurnos) throw new InternalServerErrorException(errTurnos.message);

        // 7. Novedades del periodo
        const { data: novedadesRaw } = await supabase
            .from('nomina_novedades')
            .select('*')
            .eq('periodo_id', periodo.id);

        // 7.5. Puestos y Salarios Fijos (Asignaciones activas)
        const { data: asignacionesRaw } = await supabase
            .from('asignacion_guardas_puesto')
            .select('empleado_id, puesto_id, puestos_trabajo(salario_fijo)')
            .eq('activo', true);

        const resultados: any[] = [];

        // 8. Calcular por Empleado
        // Usamos un Map para evitar duplicados si un empleado tiene contrato y turnos
        const empleadosAProcesar = new Map<number, any>();
        
        // Agregar los que tienen contrato
        for (const contrato of contratos) {
            const emp = contrato.empleados;
            if (emp) {
                const salarioData: any = contrato.salarios;
                const salarioBase = Array.isArray(salarioData) ? (salarioData[0]?.valor || 0) : (salarioData?.valor || 0);
                
                empleadosAProcesar.set(emp.id, {
                    id: emp.id,
                    nombre_completo: emp.nombre_completo,
                    cedula: emp.cedula,
                    contrato_id: contrato.id,
                    salario_id: contrato.salario_id,
                    salario_base: salarioBase
                });
            }
        }

        // Agregar los que tienen turnos pero NO tienen contrato activo (si los hay)
        // Esto previene que "desaparezcan" si el contrato terminó pero trabajaron algunos días
        const idsConTurnos = [...new Set(turnosRaw?.map(t => t.empleado_id) || [])];
        for (const idEmp of idsConTurnos) {
            if (!empleadosAProcesar.has(idEmp)) {
                // Buscar info mínima del empleado
                const { data: empData } = await supabase.from('empleados').select('id, nombre_completo, cedula').eq('id', idEmp).single();
                if (empData) {
                    empleadosAProcesar.set(idEmp, {
                        id: empData.id,
                        nombre_completo: empData.nombre_completo,
                        cedula: empData.cedula,
                        contrato_id: null,
                        salario_id: null,
                        salario_base: smlmv // Usamos el mínimo por defecto si no hay contrato
                    });
                }
            }
        }

        for (const empInfo of empleadosAProcesar.values()) {
            const empId = empInfo.id;
            const salarioBase = empInfo.salario_base;

            if (salarioBase <= 0) {
                this.logger.warn(`Empleado ${empId} sin salario configurado, saltando.`);
                continue;
            }

            // Turnos del empleado
            const turnosEmpleado = turnosRaw?.filter(t => t.empleado_id === empId) || [];

            // Novedades del empleado
            const novedadesEmpleado = novedadesRaw?.filter(n => n.empleado_id === empId) || [];

            // Buscar si tiene un salario fijo asignado por el puesto
            const asignacion = asignacionesRaw?.find(a => a.empleado_id === empId);
            const salarioFijoPuesto = Number(asignacion?.puestos_trabajo?.['salario_fijo'] || 0);

            // Calcular liquidación
            const liquidacion = this.calcularLiquidacionEmpleado(
                turnosEmpleado,
                salarioBase,
                parametros,
                festivos,
                novedadesEmpleado,
                salarioFijoPuesto,
            );

            // Aplicar deducciones adicionales (no obligatorias)
            let deduccionesOtras = 0;
            const deduccionesCalculadas: { deduccion_id: number; valor_calculado: number }[] = [];

            for (const ded of deducciones || []) {
                if (ded.es_obligatoria) {
                    // Las obligatorias (salud, pensión) ya se calcularon arriba
                    deduccionesCalculadas.push({
                        deduccion_id: ded.id,
                        valor_calculado: ded.nombre.toLowerCase().includes('salud')
                            ? liquidacion.deduccion_salud
                            : liquidacion.deduccion_pension,
                    });
                } else {
                    let valor = 0;
                    if (ded.tipo === 'porcentaje') {
                        const base = ded.aplica_a === 'salario' ? salarioBase : liquidacion.ibc;
                        valor = Math.round(base * (Number(ded.porcentaje_empleado || ded.valor) / 100));
                    } else {
                        valor = Number(ded.valor);
                    }
                    deduccionesOtras += valor;
                    deduccionesCalculadas.push({ deduccion_id: ded.id, valor_calculado: valor });
                }
            }

            // Actualizar totales con deducciones adicionales
            liquidacion.deducciones_otras = deduccionesOtras;
            liquidacion.total_deducciones += deduccionesOtras;
            liquidacion.total_pagar = Math.round(liquidacion.total_devengado - liquidacion.total_deducciones);

            // Upsert nómina empleado
            const { data: existingNomina } = await supabase
                .from('nomina_empleado')
                .select('id')
                .eq('empleado_id', empId)
                .eq('periodo_id', periodo.id)
                .single();

            let nominaId: number;
            const nominaData = {
                empleado_id: empId,
                periodo_id: periodo.id,
                contrato_id: empInfo.contrato_id,
                salario_id: empInfo.salario_id,
                ...liquidacion,
            };

            if (existingNomina) {
                const { data: updated, error: updateError } = await supabase
                    .from('nomina_empleado')
                    .update(nominaData)
                    .eq('id', existingNomina.id)
                    .select('id')
                    .single();

                if (updateError) {
                    this.logger.error(`Error actualizando nómina empleado ${empId}: ${updateError.message}`);
                    continue;
                }
                nominaId = updated.id;
            } else {
                const { data: newNomina, error: insertError } = await supabase
                    .from('nomina_empleado')
                    .insert(nominaData)
                    .select('id')
                    .single();

                if (insertError) {
                    this.logger.error(`Error insertando nómina empleado ${empId}: ${insertError.message}`);
                    continue;
                }
                nominaId = newNomina.id;
            }

            // Guardar detalle deducciones
            await supabase.from('nomina_empleado_deducciones').delete().eq('nomina_empleado_id', nominaId);
            for (const dedCalc of deduccionesCalculadas) {
                await supabase.from('nomina_empleado_deducciones').insert({
                    nomina_empleado_id: nominaId,
                    deduccion_id: dedCalc.deduccion_id,
                    valor_calculado: dedCalc.valor_calculado,
                });
            }

            resultados.push({ id: nominaId, nombre: empInfo.nombre_completo });
        }

        // Actualizar totales del periodo
        const { data: resumen } = await supabase
            .from('nomina_empleado')
            .select('total_pagar, total_devengado, total_deducciones')
            .eq('periodo_id', periodo.id);

        const sumPagar = resumen?.reduce((acc, r) => acc + Number(r.total_pagar), 0) || 0;
        const sumDevengado = resumen?.reduce((acc, r) => acc + Number(r.total_devengado), 0) || 0;
        const sumDeducido = resumen?.reduce((acc, r) => acc + Number(r.total_deducciones), 0) || 0;

        await supabase.from('nomina_periodos').update({
            total_pagar: sumPagar,
            total_devengado: sumDevengado,
            total_deducciones: sumDeducido,
        }).eq('id', periodo.id);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_periodos',
            registro_id: periodo.id,
            accion: 'UPDATE',
            datos_nuevos: { generated_count: resultados.length, total_pagar: sumPagar },
            usuario_id: userId,
        });

        return {
            message: 'Nómina generada exitosamente',
            total_procesados: resultados.length,
            total_pagar: sumPagar,
            total_devengado: sumDevengado,
            total_deducciones: sumDeducido,
        };
    }

    // ══════════════════════════════════════════════════════════
    // CONSULTAS
    // ══════════════════════════════════════════════════════════

    async getNominaByPeriodo(periodoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('nomina_empleado')
            .select(`*, empleados(nombre_completo, cedula), salarios(valor)`)
            .eq('periodo_id', periodoId);
        if (error) throw error;
        return data;
    }

    async getPeriodoDetalle(periodoId: number) {
        const supabase = this.supabaseService.getClient();

        const { data: periodo } = await supabase.from('nomina_periodos').select('*').eq('id', periodoId).single();
        if (!periodo) throw new NotFoundException('Periodo no encontrado');

        const { data: empleados, error } = await supabase
            .from('nomina_empleado')
            .select(`
                *,
                empleados(nombre_completo, cedula),
                contratos_personal(tipo_contrato)
            `)
            .eq('periodo_id', periodoId);

        if (error) throw error;
        return empleados;
    }

    async calcularNominaEmpleado(empleadoId: number, anio: number, mes: number) {
        const supabase = this.supabaseService.getClient();

        const { data: emp, error: errEmp } = await supabase
            .from('empleados')
            .select(`id, nombre_completo, cedula, salario_id, contrato_personal_id, salarios!fk_salario_empleado(valor)`)
            .eq('id', empleadoId)
            .single();

        if (errEmp || !emp) throw new NotFoundException('Empleado no encontrado.');

        const { data: periodo } = await supabase
            .from('nomina_periodos')
            .select('*')
            .eq('anio', anio)
            .eq('mes', mes)
            .single();

        if (!periodo) throw new BadRequestException(`No se encontró periodo para ${anio}-${mes}`);

        const { data: turnosRaw } = await supabase
            .from('turnos')
            .select('*')
            .eq('empleado_id', empleadoId)
            .gte('fecha', periodo.fecha_inicio)
            .lte('fecha', periodo.fecha_fin);

        const { data: parametros } = await supabase
            .from('nomina_valores_hora')
            .select('*')
            .eq('anio', anio)
            .eq('activo', true);

        if (!parametros || parametros.length === 0) throw new BadRequestException(`Sin parámetros para ${anio}`);

        const { data: festivosData } = await supabase
            .from('nomina_festivos_colombia')
            .select('fecha')
            .eq('anio', anio);

        const festivos = new Set<string>((festivosData || []).map(f => f.fecha));

        const salarioData: any = emp.salarios;
        const salarioBase = Array.isArray(salarioData) ? (salarioData[0]?.valor || 0) : (salarioData?.valor || 0);

        const liquidacion = this.calcularLiquidacionEmpleado(
            turnosRaw || [],
            salarioBase,
            parametros,
            festivos,
            [],
        );

        return {
            empleado: { id: emp.id, nombre: emp.nombre_completo, cedula: emp.cedula },
            periodo: { anio, mes },
            ...liquidacion,
        };
    }

    async getEmployeeHistory(empleadoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('nomina_empleado')
            .select(`*, nomina_periodos(anio, mes, fecha_inicio, fecha_fin)`)
            .eq('empleado_id', empleadoId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async getSummary(anio: number, mes: number) {
        const supabase = this.supabaseService.getClient();
        const { data: periodo } = await supabase
            .from('nomina_periodos')
            .select('id, cerrado')
            .eq('anio', anio)
            .eq('mes', mes)
            .single();

        if (!periodo) throw new NotFoundException('Periodo no encontrado');

        const { data: registros } = await supabase
            .from('nomina_empleado')
            .select('total_pagar, total_devengado, total_deducciones')
            .eq('periodo_id', periodo.id);

        return {
            periodo,
            estadisticas: {
                total_empleados: registros?.length || 0,
                total_pagar: registros?.reduce((s, r) => s + Number(r.total_pagar), 0) || 0,
                total_devengado: registros?.reduce((s, r) => s + Number(r.total_devengado), 0) || 0,
                total_deducciones: registros?.reduce((s, r) => s + Number(r.total_deducciones), 0) || 0,
            }
        };
    }

    async getAdminDesprendible(empleadoId: number, periodoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: nomina } = await supabase
            .from('nomina_empleado')
            .select(`
                *,
                empleados (nombre_completo, cedula),
                nomina_empleado_deducciones (
                    valor_calculado,
                    nomina_deducciones (nombre, tipo, valor)
                )
            `)
            .eq('periodo_id', periodoId)
            .eq('empleado_id', empleadoId)
            .single();

        if (!nomina) throw new NotFoundException('Nómina no encontrada para este empleado y periodo');
        return nomina;
    }

    // ══════════════════════════════════════════════════════════
    // PARÁMETROS CRUD
    // ══════════════════════════════════════════════════════════

    async listarParametros(anio?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from('nomina_valores_hora').select('*').order('tipo');
        if (anio) query = query.eq('anio', anio);
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async crearParametro(dto: any) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_valores_hora').insert(dto).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async actualizarParametro(id: number, dto: any) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_valores_hora').update(dto).eq('id', id).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async eliminarParametro(id: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('nomina_valores_hora').delete().eq('id', id);
        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Parámetro eliminado' };
    }

    async clonarParametros(anioOrigen: number) {
        const supabase = this.supabaseService.getClient();
        const { data: originales } = await supabase
            .from('nomina_valores_hora')
            .select('*')
            .eq('anio', anioOrigen);

        if (!originales || originales.length === 0) throw new BadRequestException('No hay parámetros para clonar');

        const nuevoAnio = anioOrigen + 1;
        const nuevos = originales.map(p => ({
            anio: nuevoAnio,
            tipo: p.tipo,
            multiplicador: p.multiplicador,
            descripcion: p.descripcion,
            activo: p.activo,
        }));

        const { error } = await supabase.from('nomina_valores_hora').insert(nuevos);
        if (error) throw new InternalServerErrorException(error.message);
        return { message: `Parámetros clonados de ${anioOrigen} a ${nuevoAnio}` };
    }

    // ══════════════════════════════════════════════════════════
    // DEDUCCIONES CRUD
    // ══════════════════════════════════════════════════════════

    async listarDeducciones() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_deducciones').select('*').order('nombre');
        if (error) throw error;
        return data;
    }

    async listarDeduccionesActivas() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_deducciones').select('*').eq('activo', true);
        if (error) throw error;
        return data;
    }

    async crearDeduccion(dto: any) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_deducciones').insert(dto).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async actualizarDeduccion(id: number, dto: any) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_deducciones').update(dto).eq('id', id).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async eliminarDeduccion(id: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('nomina_deducciones').delete().eq('id', id);
        
        if (error) {
            // Error 23503 in PostgreSQL is a Foreign Key Violation
            if (error.code === '23503' || error.message.includes('foreign key')) {
                throw new InternalServerErrorException('No se puede eliminar porque ya ha sido usada en nóminas pasadas. Por favor, desactívela editándola en lugar de eliminarla.');
            }
            throw new InternalServerErrorException('No se pudo desactivar la deducción: ' + error.message);
        }
        
        return { message: 'Deducción eliminada por completo' };
    }

    // ══════════════════════════════════════════════════════════
    // NOVEDADES CRUD
    // ══════════════════════════════════════════════════════════

    async listarNovedades(periodoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('nomina_novedades')
            .select(`*, empleados(nombre_completo, cedula)`)
            .eq('periodo_id', periodoId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async registrarNovedad(dto: any) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_novedades').insert(dto).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async eliminarNovedad(id: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('nomina_novedades').delete().eq('id', id);
        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Novedad eliminada' };
    }

    async getPeriodoById(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('nomina_periodos')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data) throw new NotFoundException('Periodo no encontrado');
        return data;
    }

}
