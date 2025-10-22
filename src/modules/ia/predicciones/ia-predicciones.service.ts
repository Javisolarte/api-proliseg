import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class IaPrediccionesService {
  private readonly logger = new Logger(IaPrediccionesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async registrarPrediccion(empleadoId: number, tipo: 'ausencia' | 'incidente', probabilidad: number) {
    const supabase = this.supabaseService.getClient();
    await supabase.from('ia_predicciones_incidentes').insert({
      empleado_id: empleadoId,
      tipo_prediccion: tipo,
      probabilidad,
      modelo_version: 'v1.0',
    });
  }
}
