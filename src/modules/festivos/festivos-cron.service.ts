import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FestivosCronService {
    private readonly logger = new Logger(FestivosCronService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
   * Se ejecuta automáticamente el 1 de Enero de cada año a las 01:00 AM
   * Genera los festivos del año que comienza y asegura que el siguiente esté listo.
   */
    @Cron(CronExpression.EVERY_YEAR)
    async generarFestivosAnuales() {
        const anioActual = new Date().getFullYear();
        const anioSiguiente = anioActual + 1;

        if (anioActual > 2050) {
            this.logger.log(`🏁 Límite de año 2050 alcanzado. No se requiere más generación automática.`);
            return;
        }

        this.logger.log(`📅 Mantenimiento anual: Generando festivos para ${anioActual} y asegurando ${anioSiguiente}...`);

        const supabase = this.supabaseService.getClient();

        // 1. Generar año actual (por si no se hizo o para refrescar)
        await supabase.rpc('generar_festivos_colombia', { anio_input: anioActual });

        // 2. Generar año siguiente (Cumple: "en 2029 crea 2030", "en 2030 crea 2031"...)
        if (anioSiguiente <= 2050) {
            const { error } = await supabase.rpc('generar_festivos_colombia', { anio_input: anioSiguiente });
            if (error) {
                this.logger.error(`❌ Error generando festivos para el próximo año (${anioSiguiente})`, error);
            } else {
                this.logger.log(`✅ Festivos para ${anioSiguiente} listos.`);
            }
        }
    }

    /**
     * Genera festivos en un rango de años (ej: 2028 a 2050)
     */
    async generarRangoFestivos(anioInicio: number, anioFin: number) {
        this.logger.log(`🚀 Iniciando generación masiva de festivos: ${anioInicio} -> ${anioFin}`);
        const supabase = this.supabaseService.getClient();
        let exitos = 0;
        let errores = 0;

        for (let anio = anioInicio; anio <= anioFin; anio++) {
            const { error } = await supabase.rpc('generar_festivos_colombia', { anio_input: anio });
            if (error) {
                this.logger.error(`❌ Falló generación para ${anio}`, error);
                errores++;
            } else {
                exitos++;
            }
        }

        this.logger.log(`🏁 Proceso completado. Éxitos: ${exitos}, Errores: ${errores}`);
        return { exitos, errores, total: exitos + errores };
    }

    /**
     * Método manual para disparar un año específico
     */
    async dispararGeneracionManual(anio: number) {
        this.logger.log(`🚀 Generación manual de festivos para el año ${anio}`);
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.rpc('generar_festivos_colombia', { anio_input: anio });

        if (error) {
            this.logger.error(`❌ Error en generación manual para ${anio}:`, error);
            throw error;
        }
        this.logger.log(`✅ Festivos para ${anio} generados con éxito.`);
        return { success: true, message: `Festivos para ${anio} generados.` };
    }
}
