import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class IaRutasService {
  private readonly logger = new Logger(IaRutasService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async registrarUbicacion(empleadoId: number, puestoId: number, lat: number, lon: number, evento: string) {
    const supabase = this.supabaseService.getClient();
    await supabase.from('rutas_gps').insert({
      empleado_id: empleadoId,
      puesto_id: puestoId,
      latitud: lat,
      longitud: lon,
      evento,
      tipo_ruta: 'rondero',
    });
  }
}
