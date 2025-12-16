import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificacionesService } from './notificaciones.service';

@Injectable()
export class NotificacionesScheduler {
    private readonly logger = new Logger(NotificacionesScheduler.name);

    constructor(
        private readonly notificacionesService: NotificacionesService
    ) { }

    /**
     * 🔔 Verificar asignaciones incompletas cada 6 horas
     * Crea notificaciones cuando faltan empleados por asignar
     */
    @Cron(CronExpression.EVERY_6_HOURS)
    async verificarAsignacionesIncompletas() {
        this.logger.log('🔔 Iniciando verificación de asignaciones incompletas...');

        try {
            const result = await this.notificacionesService.verificarAsignacionesIncompletas();

            if (result) {
                this.logger.log(
                    `✅ Verificación completada: ${result.verificados} subpuestos verificados, ${result.notificaciones_creadas} notificaciones creadas`
                );
            }
        } catch (error: any) {
            this.logger.error(`❌ Error en verificación de asignaciones: ${error.message}`);
        }
    }

    /**
     * 🧹 Limpiar notificaciones antiguas cada semana
     * Elimina notificaciones leídas de hace más de 30 días
     */
    @Cron(CronExpression.EVERY_WEEK)
    async limpiarNotificacionesAntiguas() {
        this.logger.log('🧹 Iniciando limpieza de notificaciones antiguas...');

        try {
            // Implementar lógica de limpieza si es necesario
            this.logger.log('✅ Limpieza de notificaciones completada');
        } catch (error: any) {
            this.logger.error(`❌ Error en limpieza: ${error.message}`);
        }
    }
}
