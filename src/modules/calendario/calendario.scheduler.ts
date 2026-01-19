import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CalendarioService } from './calendario.service';

@Injectable()
export class CalendarioScheduler {
    private readonly logger = new Logger(CalendarioScheduler.name);

    constructor(private readonly calendarioService: CalendarioService) { }

    /**
     * ⏰ Procesar recordatorios programados cada 5 minutos
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleRecordatorios() {
        this.logger.log('⏰ Verificando recordatorios de calendario...');
        try {
            const result = await this.calendarioService.procesarRecordatoriosPendientes();
            if (result.procesados > 0) {
                this.logger.log(`✅ ${result.procesados} recordatorios procesados y notificados.`);
            }
        } catch (error) {
            this.logger.error(`Error en handle recordatorios: ${error.message}`);
        }
    }

    /**
     * 📅 Enviar agenda diaria cada mañana a las 6:00 AM
     */
    @Cron('0 6 * * *')
    async handleAgendaDiaria() {
        this.logger.log('📅 Generando agenda diaria de calendario...');
        try {
            const result = await this.calendarioService.enviarAgendaDiaria();
            this.logger.log(`✅ Agenda enviada a ${result.notificados} usuarios.`);
        } catch (error) {
            this.logger.error(`Error en handle agenda diaria: ${error.message}`);
        }
    }
}
