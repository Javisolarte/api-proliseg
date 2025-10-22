import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class IaReentrenamientoService {
  private readonly logger = new Logger(IaReentrenamientoService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async evaluarDesempeno(empleadoId: number, promedio: number) {
    const supabase = this.supabaseService.getClient();
    if (promedio < 3) {
      await supabase.from('ia_reentrenamiento_personal').insert({
        empleado_id: empleadoId,
        motivo: 'Bajo rendimiento promedio detectado',
        nivel_riesgo: promedio < 2 ? 'alto' : 'medio',
        requiere_reentrenamiento: true,
        recomendacion: 'Sugerido reentrenamiento en protocolo general',
      });
      this.logger.warn(`🚨 Reentrenamiento sugerido para empleado ${empleadoId}`);
    }
  }
}
