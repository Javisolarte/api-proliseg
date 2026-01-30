import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseHealthIndicator extends HealthIndicator {
    constructor(private readonly supabaseService: SupabaseService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            const supabase = this.supabaseService.getClient();
            // Una consulta simple al esquema para verificar conectividad
            const { error } = await supabase.from('roles').select('id').limit(1);

            if (error) {
                throw new HealthCheckError('Supabase check failed', error);
            }

            return this.getStatus(key, true);
        } catch (e) {
            throw new HealthCheckError('Supabase is unreachable', e);
        }
    }
}
