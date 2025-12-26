import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class NominaService {
    private readonly logger = new Logger(NominaService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly auditoriaService: AuditoriaService,
    ) { }

    // 🔹 Crear Periodo
    async createPeriod(dto: any, userId: number) {
        const supabase = this.supabaseService.getClient();

        // Validar duplicado
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

    // 🔹 Generar Nómina
    // 🔹 Generar Nómina
    async generarNomina(anio: number, mes: number, userId: number) {
        // Usar Admin Client para evitar restricciones RLS (ver todos los contratos)
        const supabase = this.supabaseService.getSupabaseAdminClient();

        // 1. Verificar periodo nomina
        const { data: periodo } = await supabase
            .from('nomina_periodos')
            .select('*')
            .eq('anio', anio)
            .eq('mes', mes)
            .single();

        if (!periodo) throw new NotFoundException('Periodo de nómina no encontrado. Debe crearlo primero.');
        if (periodo.cerrado) throw new BadRequestException('El periodo de nómina ya está cerrado.');

        this.logger.log(`>> Generando Nómina: ${anio}-${mes} | Periodo: ${periodo.fecha_inicio} al ${periodo.fecha_fin} | Usuario: ${userId}`);

        // 2. Obtener Parámetros Anuales
        const { data: parametros } = await supabase
            .from('nomina_valores_hora')
            .select('*')
            .eq('anio', anio)
            .eq('activo', true);

        if (!parametros || parametros.length === 0) throw new BadRequestException(`No hay parámetros de nómina configurados para el año ${anio}`);

        // Helper para buscar valor hora
        const getMultiplicador = (tipo: string) => {
            const p = parametros.find((p) => p.tipo === tipo);
            return p ? Number(p.multiplicador) : 0;
        };

        // 3. Obtener Deducciones Activas
        const { data: deducciones } = await supabase
            .from('nomina_deducciones')
            .select('*')
            .eq('activo', true);

        // 4. Obtener Contratos Validos (Lógica de Fechas)
        // Buscamos contratos que se solapen con el periodo:
        // (Contrato.Inicio <= Periodo.Fin) AND (Contrato.Fin >= Periodo.Inicio OR Contrato.Fin IS NULL)

        const { data: contratosRaw, error: errContratos } = await supabase
            .from('contratos_personal')
            .select(`
                *,
                empleados!fk_contrato_empleado!inner (
                    id,
                    nombre_completo
                ),
                salarios (
                    valor
                )
            `)
            .lte('fecha_inicio', periodo.fecha_fin); // Optimization: Start date must be before or on period end

        if (errContratos) {
            this.logger.error(`Error buscando contratos: ${errContratos.message}`);
            throw new InternalServerErrorException(errContratos.message);
        }

        // Filtrado en memoria para la parte del "Fin" (para manejar NULL facilmente)
        const periodStart = new Date(periodo.fecha_inicio);
        const contratos = contratosRaw?.filter(c => {
            // Si no tiene fin (indefinido activo) O si su fin es despues del inicio del periodo
            return !c.fecha_fin || new Date(c.fecha_fin) >= periodStart;
        }) || [];

        this.logger.log(`>> Contratos Totales (Inicio <= FinPer): ${contratosRaw?.length} | Filtrados (Fin >= IniPer): ${contratos.length}`);

        if (contratos.length === 0) {
            this.logger.warn(`No se encontraron contratos para el periodo ${periodo.fecha_inicio} - ${periodo.fecha_fin}`);
            throw new BadRequestException('No hay contratos activos para generar nómina.');
        }

        const resultados: any[] = [];

        // 5. Calcular por Empleado (Iterando contratos)
        for (const contrato of contratos) {
            const emp = contrato.empleados;
            // Validacion de seguridad
            if (!emp) continue;

            const salarioData: any = contrato.salarios;
            const salarioBase = Array.isArray(salarioData) ? (salarioData[0]?.valor || 0) : (salarioData?.valor || 0);
            const valorHora = salarioBase / 240; // Base 30 dias * 8 horas = 240


            // A. Calcular Horas (Simulado o desde reportes de turnos)
            // TODO: Conectar con modulo de turnos para obtener horas reales.
            // Por ahora 0 extras.
            const horasExtras = {
                diurna: 0,
                nocturna: 0,
                festiva: 0,
                dominical: 0,
            };

            const totalHorasExtraValor =
                horasExtras.diurna * valorHora * getMultiplicador('hora_extra_diurna') +
                horasExtras.nocturna * valorHora * getMultiplicador('hora_extra_nocturna') +
                horasExtras.festiva * valorHora * getMultiplicador('hora_extra_festiva') +
                horasExtras.dominical * valorHora * getMultiplicador('hora_dominical');

            const auxilioTransporte = 0; // Debería venir de parámetros (valor fijo)
            // TODO: Agregar auxilio transporte a parametros

            const totalDevengado = salarioBase + totalHorasExtraValor + auxilioTransporte;

            // B. Calcular Deducciones
            let totalDeducciones = 0;
            const deduccionesCalculadas: any[] = [];

            for (const ded of deducciones || []) {
                let valor = 0;
                if (ded.tipo === 'porcentaje') {
                    const base = ded.aplica_a === 'salario' ? salarioBase : totalDevengado;
                    valor = base * (Number(ded.valor) / 100);
                } else {
                    valor = Number(ded.valor);
                }
                totalDeducciones += valor;
                deduccionesCalculadas.push({
                    deduccion_id: ded.id,
                    valor_calculado: valor,
                });
            }

            const netoPagar = totalDevengado - totalDeducciones;

            // C. Guardar Nomina Empleado (Upsert manual logic to preserve hours)

            // 1. Buscar registro existente para preservar horas/recargos manuales (si no es recalculo forzoso destructivo)
            const { data: existingNomina } = await supabase
                .from('nomina_empleado')
                .select('*')
                .eq('empleado_id', emp.id)
                .eq('periodo_id', periodo.id)
                .single();

            // Si existe, usamos sus horas si son mayores a 0 (asumiendo que las registradas manualmente prevalecen o se suman)
            // Aquí asumimos que si ya existen en DB, son las válidas. 
            // Si queremos forzar recalculo de horas desde turnos, sería otra lógica.
            // PERO el requerimiento es "Registrar variables del mes" (Novedades/Horas) y luego generar.
            // Entonces, si ya están en DB, debemos respetarlas.

            const currentHorasExtras = {
                diurna: existingNomina?.horas_extra_diurnas ?? horasExtras.diurna,
                nocturna: existingNomina?.horas_extra_nocturnas ?? horasExtras.nocturna,
                festiva: existingNomina?.horas_extra_festivas ?? horasExtras.festiva,
                dominical: existingNomina?.horas_dominicales ?? horasExtras.dominical,
            };

            // Recalcular devengado con horas preservadas
            const totalHorasExtraValorPreservado =
                (currentHorasExtras.diurna || 0) * valorHora * getMultiplicador('hora_extra_diurna') +
                (currentHorasExtras.nocturna || 0) * valorHora * getMultiplicador('hora_extra_nocturna') +
                (currentHorasExtras.festiva || 0) * valorHora * getMultiplicador('hora_extra_festiva') +
                (currentHorasExtras.dominical || 0) * valorHora * getMultiplicador('hora_dominical');

            // Recargos (si hubiera lógica de valor)
            // Asumimos total_recargos viene de DB si existe, o 0.
            const totalRecargos = existingNomina?.total_recargos || 0;

            const totalDevengadoFinal = salarioBase + totalHorasExtraValorPreservado + auxilioTransporte + totalRecargos;

            // Recalcular deducciones sobre nuevo devengado si aplica
            let totalDeduccionesFinal = 0;
            const deduccionesCalculadasFinal: any[] = [];
            for (const ded of deducciones || []) {
                let valor = 0;
                if (ded.tipo === 'porcentaje') {
                    const base = ded.aplica_a === 'salario' ? salarioBase : totalDevengadoFinal;
                    valor = base * (Number(ded.valor) / 100);
                } else {
                    valor = Number(ded.valor);
                }
                totalDeduccionesFinal += valor;
                deduccionesCalculadasFinal.push({
                    deduccion_id: ded.id,
                    valor_calculado: valor,
                });
            }

            const netoPagarFinal = totalDevengadoFinal - totalDeduccionesFinal;

            // Upsert Logica: Si existe update, si no insert.
            let nominaId: number;

            if (existingNomina) {
                const { data: updated, error: updateError } = await supabase
                    .from('nomina_empleado')
                    .update({
                        salario_id: contrato.salario_id,
                        contrato_id: contrato.id, // Corrected: use contract.id source of truth
                        horas_normales: 240,
                        total_horas_extra: totalHorasExtraValorPreservado,
                        total_recargos: totalRecargos,
                        total_deducciones: totalDeduccionesFinal,
                        total_devengado: totalDevengadoFinal,
                        total_pagar: netoPagarFinal,
                        generado: true,
                        // No tocamos las columnas de horas individuales, se preservan.
                    })
                    .eq('id', existingNomina.id)
                    .select()
                    .single();

                if (updateError) {
                    this.logger.error(`Error actualizando nomina empleado ${emp.id}: ${updateError.message}`);
                    continue;
                }
                nominaId = updated.id;
            } else {
                const { data: newNomina, error: insertError } = await supabase
                    .from('nomina_empleado')
                    .insert({
                        empleado_id: emp.id,
                        contrato_id: contrato.id, // Corrected: use contract.id source of truth
                        salario_id: contrato.salario_id, // Corrected: use contract.salario_id source of truth
                        periodo_id: periodo.id,
                        horas_normales: 240,
                        horas_extra_diurnas: currentHorasExtras.diurna,
                        horas_extra_nocturnas: currentHorasExtras.nocturna,
                        horas_extra_festivas: currentHorasExtras.festiva,
                        horas_dominicales: currentHorasExtras.dominical,
                        total_horas_extra: totalHorasExtraValorPreservado,
                        total_recargos: totalRecargos,
                        total_deducciones: totalDeduccionesFinal,
                        total_devengado: totalDevengadoFinal,
                        total_pagar: netoPagarFinal,
                        generado: true,
                    })
                    .select()
                    .single();

                if (insertError) {
                    this.logger.error(`Error insertando nomina empleado ${emp.id}: ${insertError.message}`);
                    continue;
                }
                nominaId = newNomina.id;
            }

            // D. Guardar Detalle Deducciones (Reemplazar)
            await supabase.from('nomina_empleado_deducciones').delete().eq('nomina_empleado_id', nominaId);

            for (const dedCalc of deduccionesCalculadasFinal) {
                await supabase.from('nomina_empleado_deducciones').insert({
                    nomina_empleado_id: nominaId,
                    deduccion_id: dedCalc.deduccion_id,
                    valor_calculado: dedCalc.valor_calculado,
                });
            }

            resultados.push({ id: nominaId });
        }

        // Auditar generación
        const totalDevengado = resultados.reduce((sum, item) => sum + (item.devengado || 0), 0); // Need to accumulate these from loop or re-query
        // Better: re-query totals to be safe and accurate
        const { data: resumen } = await supabase
            .from('nomina_empleado')
            .select('total_pagar, total_devengado, total_deducciones')
            .eq('periodo_id', periodo.id);

        const sumPagar = resumen?.reduce((acc, curr) => acc + Number(curr.total_pagar), 0) || 0;
        const sumDevengado = resumen?.reduce((acc, curr) => acc + Number(curr.total_devengado), 0) || 0;
        const sumDeducido = resumen?.reduce((acc, curr) => acc + Number(curr.total_deducciones), 0) || 0;

        // Actualizar totales en nomina_periodos
        await supabase
            .from('nomina_periodos')
            .update({
                total_pagar: sumPagar,
                total_devengado: sumDevengado,
                total_deducciones: sumDeducido
            })
            .eq('id', periodo.id);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_periodos',
            registro_id: periodo.id,
            accion: 'UPDATE', // Generación
            datos_nuevos: {
                generated_count: resultados.length,
                total_pagar: sumPagar
            },
            usuario_id: userId,
        });

        return { message: 'Nómina generada exitosamente', total_procesados: resultados.length, total_pagar: sumPagar };
    }

    // 🔹 Listar Nominas Periodo
    async getNominaByPeriodo(periodoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('nomina_empleado')
            .select(`
         *,
         empleados(nombre_completo, cedula),
         salarios(valor)
       `)
            .eq('periodo_id', periodoId);

        if (error) throw error;
        return data;
    }

    // 🔹 Calcular Nomina Individual (Simulación / Pre-visualización)
    async calcularNominaEmpleado(empleadoId: number, anio: number, mes: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener Empleado y Contrato
        const { data: emp, error: errEmp } = await supabase
            .from('empleados')
            .select(`
                id,
                nombre_completo,
                salario_id,
                contrato_personal_id,
                contratos_personal!inner(salario_id),
                salarios!fk_salario_empleado(valor)
            `)
            .eq('id', empleadoId)
            .single();

        if (errEmp || !emp) throw new NotFoundException('Empleado no encontrado o sin contrato activo.');
        if (!emp.contrato_personal_id) throw new BadRequestException('Empleado sin contrato personal activo.');

        // 2. Obtener Parámetros Anuales
        const { data: parametros } = await supabase
            .from('nomina_valores_hora')
            .select('*')
            .eq('anio', anio)
            .eq('activo', true);

        if (!parametros || parametros.length === 0) throw new BadRequestException(`No hay parámetros de nómina configurados para el año ${anio}`);

        const getMultiplicador = (tipo: string) => {
            const p = parametros.find((p) => p.tipo === tipo);
            return p ? Number(p.multiplicador) : 0;
        };

        // 3. Calculos
        const salarioData: any = emp.salarios;
        const salarioBase = Array.isArray(salarioData) ? (salarioData[0]?.valor || 0) : (salarioData?.valor || 0);
        const valorHora = salarioBase / 240;

        // Simulación de horas (idealmente vendría de inputs o turnos)
        const horasExtras = {
            diurna: 0,
            nocturna: 0,
            festiva: 0,
            dominical: 0,
        };

        const totalHorasExtraValor =
            horasExtras.diurna * valorHora * getMultiplicador('hora_extra_diurna') +
            horasExtras.nocturna * valorHora * getMultiplicador('hora_extra_nocturna') +
            horasExtras.festiva * valorHora * getMultiplicador('hora_extra_festiva') +
            horasExtras.dominical * valorHora * getMultiplicador('hora_dominical');

        const auxilioTransporte = 0; // TODO: Parameterize
        const totalDevengado = salarioBase + totalHorasExtraValor + auxilioTransporte;

        // 4. Deducciones
        const { data: deducciones } = await supabase
            .from('nomina_deducciones')
            .select('*')
            .eq('activo', true);

        let totalDeducciones = 0;
        const detalleDeducciones: any[] = [];

        for (const ded of deducciones || []) {
            let valor = 0;
            if (ded.tipo === 'porcentaje') {
                const base = ded.aplica_a === 'salario' ? salarioBase : totalDevengado;
                valor = base * (Number(ded.valor) / 100);
            } else {
                valor = Number(ded.valor);
            }
            totalDeducciones += valor;
            detalleDeducciones.push({ ...ded, valor_calculado: valor });
        }

        return {
            empleado: { id: emp.id, nombre: emp.nombre_completo },
            periodo: { anio, mes },
            salario_base: salarioBase,
            devengado: {
                basico: salarioBase,
                horas_extras: totalHorasExtraValor,
                auxilio_transporte: auxilioTransporte,
                total: totalDevengado
            },
            deducciones: {
                total: totalDeducciones,
                detalle: detalleDeducciones
            },
            neto_pagar: totalDevengado - totalDeducciones
        };
    }

    // 🔹 Cerrar Periodo
    async closePeriod(periodoId: number, userId: number) {
        const supabase = this.supabaseService.getClient();

        // Verificar
        const { data: periodo } = await supabase.from('nomina_periodos').select('*').eq('id', periodoId).single();
        if (!periodo) throw new NotFoundException('Periodo no encontrado');
        if (periodo.cerrado) throw new BadRequestException('El periodo ya está cerrado');

        // Cerrar
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

    // 🔹 Recalcular Periodo (Wrapper de generarNomina pero forzoso)
    async recalculatePeriod(periodoId: number, userId: number) {
        const supabase = this.supabaseService.getClient();

        const { data: periodo } = await supabase.from('nomina_periodos').select('*').eq('id', periodoId).single();
        if (!periodo) throw new NotFoundException('Periodo no encontrado');
        if (periodo.cerrado) throw new BadRequestException('No se puede recalcular un periodo cerrado');

        // Generar nomina nuevamente (la lógica de generarNomina debería manejar upsert o limpieza previa)
        // Como generarNomina hace upsert por periodo_id, contrato_id, etc, debería ser seguro llamar de nuevo.
        return this.generarNomina(periodo.anio, periodo.mes, userId);
    }

    // 🔹 Historial por Empleado
    async getEmployeeHistory(empleadoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('nomina_empleado')
            .select(`
                *,
                nomina_periodos(anio, mes, fecha_inicio, fecha_fin)
            `)
            .eq('empleado_id', empleadoId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // 🔹 Resumen Periodo
    async getSummary(anio: number, mes: number) {
        const supabase = this.supabaseService.getClient();

        // Total pagado, total empleados, estatus
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

        const totalEmpleados = registros?.length || 0;
        const totalPagar = registros?.reduce((sum, r) => sum + Number(r.total_pagar), 0) || 0;
        const totalDevengado = registros?.reduce((sum, r) => sum + Number(r.total_devengado), 0) || 0;
        const totalDeducciones = registros?.reduce((sum, r) => sum + Number(r.total_deducciones), 0) || 0;

        return {
            periodo,
            estadisticas: {
                total_empleados: totalEmpleados,
                total_pagar: totalPagar,
                total_devengado: totalDevengado,
                total_deducciones: totalDeducciones
            }
        };
    }

    // 🔹 Listar todos los periodos
    async getAllPeriodos() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_periodos').select('*').order('anio', { ascending: false }).order('mes', { ascending: false });
        if (error) throw error;
        return data;
    }

    // 🔹 Detalle Completo de Nomina del Periodo
    async getPeriodoDetalle(periodoId: number) {
        const supabase = this.supabaseService.getClient();

        const { data: periodo } = await supabase.from('nomina_periodos').select('*').eq('id', periodoId).single();
        if (!periodo) throw new NotFoundException('Periodo no encontrado');

        const { data: empleados, error } = await supabase
            .from('nomina_empleado')
            .select(`
                *,
                empleados(nombre_completo, cedula, salario_id),
                contratos_personal(tipo_contrato)
            `)
            .eq('periodo_id', periodoId)
            .order('empleados(nombre_completo)', { ascending: true }); // Sort needs join awareness or post-sort

        if (error) throw error;

        if (error) throw error;

        // Frontend request: Return pure array
        return empleados;
    }

    // 🔹 Descargar Desprendible (Admin)
    async getAdminDesprendible(empleadoId: number, periodoId: number) {
        const supabase = this.supabaseService.getClient();
        // Check existence
        const { data: nomina } = await supabase
            .from('nomina_empleado')
            .select('*')
            .eq('periodo_id', periodoId)
            .eq('empleado_id', empleadoId)
            .single();

        if (!nomina) throw new NotFoundException('Nomina no encontrada para este empleado y periodo');

        // Mock PDF
        return {
            url: `https://api.proliseg.com/downloads/admin/nomina/${empleadoId}/${periodoId}/desprendible.pdf`,
            mensaje: "Simulación de PDF - Integrar motor de PDF real"
        };
    }
}

