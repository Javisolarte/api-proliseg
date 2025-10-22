import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class IaSupervisorService {
  private readonly logger = new Logger(IaSupervisorService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async analizarAsistencia(empleadoId: number) {
    const supabase = this.supabaseService.getClient();

    // Obtener las últimas asistencias del empleado
    const { data: asistencias } = await supabase
      .from('asistencias_historico')
      .select('*')
      .eq('empleado_id', empleadoId)
      .order('fecha', { ascending: false })
      .limit(10);

    if (!asistencias || asistencias.length < 5) return;

    const faltas = asistencias.filter(a => a.estado === 'falta').length;
    const retrasos = asistencias.filter(a => a.estado === 'retraso').length;

    if (faltas >= 3 || retrasos >= 5) {
      await supabase.from('supervisor_alerts').insert({
        empleado_id: empleadoId,
        tipo_alerta: 'comportamiento_anormal',
        descripcion: `El empleado presenta ${faltas} faltas y ${retrasos} retrasos recientes.`,
      });
      this.logger.warn(`⚠️ Alerta generada para empleado ${empleadoId}`);
    }
  }
}
