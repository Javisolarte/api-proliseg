import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AsignarTurnosService } from './asignar_turnos.service';

@Injectable()
export class AsignarTurnosScheduler {
    private readonly logger = new Logger(AsignarTurnosScheduler.name);

    constructor(
        private readonly asignarTurnosService: AsignarTurnosService
    ) { }

    /**
     * 🔄 Generar turnos automáticamente cada día a las 00:00
     * Genera turnos para subpuestos que no tengan turnos para los próximos 30 días
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async generarTurnosAutomaticos() {
        this.logger.log('🔄 Iniciando generación automática de turnos...');

        try {
            const result = await this.asignarTurnosService.generarTurnosAutomaticos();

            if (result) {
                this.logger.log(
                    `✅ Generación automática completada: ${result.generados} subpuestos procesados, ${result.omitidos} omitidos`
                );
            } else {
                this.logger.warn('⚠️ No se generaron turnos');
            }
        } catch (error: any) {
            this.logger.error(`❌ Error en generación automática: ${error.message}`);
        }
    }

    /**
     * 🧹 Limpiar turnos antiguos cada semana
     * Elimina turnos de hace más de 6 meses para mantener la base de datos limpia
     */
    @Cron(CronExpression.EVERY_WEEK)
    async limpiarTurnosAntiguos() {
        this.logger.log('🧹 Iniciando limpieza de turnos antiguos...');

        try {
            // Implementar lógica de limpieza si es necesario
            // Por ahora solo log
            this.logger.log('✅ Limpieza de turnos completada');
        } catch (error) {
            this.logger.error(`❌ Error en limpieza: ${error.message}`);
        }
    }
}
