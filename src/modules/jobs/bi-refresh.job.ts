import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BiRefreshJob {
    private readonly logger = new Logger(BiRefreshJob.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Refresca las vistas materializadas de Analítica cada hora
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleBiRefresh() {
        this.logger.log('Starting automated BI Materialized Views refresh...');
        try {
            const supabase = this.supabaseService.getClient();
            const { error } = await supabase.rpc('refresh_analytics_views');

            if (error) {
                this.logger.error(`Failed to refresh BI views: ${error.message}`);
            } else {
                this.logger.log('BI Materialized Views refreshed successfully');
            }
        } catch (error) {
            this.logger.error('Unexpected error during BI refresh job:', error);
        }
    }
}
