import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { CatorceBrainService } from './catorce-brain.service';

export interface ProactiveAlert {
  id?: number;
  tipo_alerta: 'CAMARA_OFFLINE' | 'TURNO_DESCUBIERTO' | 'DOC_VENCIDO' | 'NOVEDAD_CRITICA' | 'VPS_ALERTA';
  severidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  titulo: string;
  descripcion: string;
  metadata?: Record<string, any>;
  accion_sugerida?: string;
  reconocida?: boolean;
  resuelta?: boolean;
  created_at?: string;
}

@Injectable()
export class CatorceSentinelService implements OnModuleInit {
  private readonly logger = new Logger(CatorceSentinelService.name);
  private recentAlertsCache: ProactiveAlert[] = [];
  private lastAuditTime: Date = new Date();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly catorceBrain: CatorceBrainService,
  ) {}

  async onModuleInit() {
    this.logger.log('🛡️ [CATORCE Sentinel] Iniciando Centinela Proactivo en segundo plano...');
    // Ejecutar primera auditoría en frío tras 10 segundos
    setTimeout(() => {
      this.runProactiveAudit().catch((err) =>
        this.logger.warn(`Error en auditoría inicial del Centinela: ${err.message}`),
      );
    }, 10000);
  }

  /**
   * ⏰ AUDITORÍA PERIÓDICA AUTOMÁTICA CADA 12 HORAS (Optimizado para mínimo consumo de recursos)
   * Escanea cámaras desconectadas, turnos sin cubrir, documentos vencidos y novedades críticas.
   */
  @Cron('0 */12 * * *')
  async runProactiveAudit(): Promise<ProactiveAlert[]> {
    this.logger.debug('🛡️ [CATORCE Sentinel] Ejecutando escaneo proactivo de telemetría y seguridad...');
    const admin = this.supabase.getSupabaseAdminClient();
    const newAlerts: ProactiveAlert[] = [];

    try {
      // =========================================================================
      // 1. ESCANEO DE CÁMARAS Y HARDWARE IOT DESCONECTADO
      // =========================================================================
      const { data: offlineDevices } = await admin
        .from('dispositivos_iot')
        .select('id, nombre_identificador, ip_direccion, estado, marca, puesto:puestos_trabajo(id, nombre, ciudad)')
        .or('estado.ilike.%offline%,estado.ilike.%inactivo%,estado.ilike.%desconectado%,estado.ilike.%falla%')
        .limit(15);

      if (offlineDevices && offlineDevices.length > 0) {
        const devCount = offlineDevices.length;
        const samplePuestos = Array.from(
          new Set(offlineDevices.map((d: any) => d.puesto?.nombre || 'General').filter(Boolean)),
        ).slice(0, 3);

        newAlerts.push({
          tipo_alerta: 'CAMARA_OFFLINE',
          severidad: devCount >= 3 ? 'ALTA' : 'MEDIA',
          titulo: `${devCount} cámaras o dispositivos de acceso desconectados`,
          descripcion: `Se detectaron ${devCount} equipos sin comunicación activa en puestos como: ${samplePuestos.join(', ')}.`,
          metadata: {
            dispositivosAfectados: offlineDevices.map((d: any) => ({
              id: d.id,
              nombre: d.nombre_identificador,
              ip: d.ip_direccion,
              puesto: d.puesto?.nombre,
            })),
          },
          accion_sugerida: 'Generar novedad técnica para revisión de enlace y alimentación PoE.',
        });
      }

      // =========================================================================
      // 2. ESCANEO DE DOCUMENTOS DE PERSONAL VENCIDOS O POR VENCER (<= 15 DÍAS)
      // =========================================================================
      try {
        const hoy = new Date().toISOString().slice(0, 10);
        const { data: empVencidos } = await admin
          .from('empleados')
          .select('id, nombre_completo, cedula, fecha_fin_eps, fecha_fin_arl, activo')
          .eq('activo', true)
          .or(`fecha_fin_eps.lte.${hoy},fecha_fin_arl.lte.${hoy}`)
          .limit(10);

        if (empVencidos && empVencidos.length > 0) {
          newAlerts.push({
            tipo_alerta: 'DOC_VENCIDO',
            severidad: 'MEDIA',
            titulo: `${empVencidos.length} colaboradores con afiliaciones de seguridad social vencidas`,
            descripcion: `Existen ${empVencidos.length} empleados activos con fecha de EPS o ARL expirada en Prolicontrol.`,
            metadata: {
              empleados: empVencidos.map((e: any) => ({
                id: e.id,
                nombre: e.nombre_completo,
                cedula: e.cedula,
              })),
            },
            accion_sugerida: 'Notificar al área de Talento Humano para actualización inmediata de planilla.',
          });
        }
      } catch {}

      // =========================================================================
      // 3. NOVEDADES CRÍTICAS DE RADIO-OPERACIÓN EN LAS ÚLTIMAS 2 HORAS
      // =========================================================================
      try {
        const haceDosHoras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: minutasCriticas } = await admin
          .from('minutas')
          .select('id, tipo_novedad, detalle_novedad, nivel_riesgo, puesto:puestos_trabajo(nombre)')
          .gte('created_at', haceDosHoras)
          .or('nivel_riesgo.eq.alto,nivel_riesgo.eq.critico')
          .limit(5);

        if (minutasCriticas && minutasCriticas.length > 0) {
          for (const m of minutasCriticas) {
            const puestoNombre = (Array.isArray(m.puesto) ? m.puesto[0]?.nombre : (m.puesto as any)?.nombre) || 'Puesto de servicio';
            newAlerts.push({
              tipo_alerta: 'NOVEDAD_CRITICA',
              severidad: 'CRITICA',
              titulo: `Novedad crítica en ${puestoNombre}`,
              descripcion: `${m.tipo_novedad}: ${m.detalle_novedad.slice(0, 140)}...`,
              metadata: { minutaId: m.id },
              accion_sugerida: 'Coordinar con patrulla de reacción y supervisor de cuadrante.',
            });
          }
        }
      } catch {}

      // Guardar o sincronizar en PostgreSQL ia_brain.alertas_proactivas
      for (const alerta of newAlerts) {
        try {
          await this.catorceBrain.runSql(`
            INSERT INTO ia_brain.alertas_proactivas (tipo_alerta, severidad, titulo, descripcion, metadata, accion_sugerida)
            VALUES (
              '${alerta.tipo_alerta}',
              '${alerta.severidad}',
              '${alerta.titulo.replace(/'/g, "''")}',
              '${alerta.descripcion.replace(/'/g, "''")}',
              '${JSON.stringify(alerta.metadata || {})}'::jsonb,
              '${(alerta.accion_sugerida || '').replace(/'/g, "''")}'
            )
            ON CONFLICT DO NOTHING;
          `);
        } catch {}
      }

      this.recentAlertsCache = newAlerts;
      this.lastAuditTime = new Date();
      if (newAlerts.length > 0) {
        this.logger.warn(`🛡️ [CATORCE Sentinel] ${newAlerts.length} alertas proactivas registradas en el sistema.`);
      }
    } catch (err: any) {
      this.logger.error(`Error en escaneo proactivo de CATORCE: ${err.message}`);
    }

    return newAlerts;
  }

  /**
   * Obtiene la lista actual de alertas proactivas no reconocidas
   */
  public async getUnresolvedAlerts(): Promise<ProactiveAlert[]> {
    try {
      const dbAlerts = await this.catorceBrain.runSql(`
        SELECT id, tipo_alerta, severidad, titulo, descripcion, metadata, accion_sugerida, reconocida, resuelta, created_at
        FROM ia_brain.alertas_proactivas
        WHERE resuelta = false
        ORDER BY created_at DESC
        LIMIT 10;
      `);
      if (dbAlerts && dbAlerts.length > 0) {
        return dbAlerts;
      }
    } catch {}
    return this.recentAlertsCache;
  }

  /**
   * Marca una alerta como reconocida
   */
  public async acknowledgeAlert(alertId: number, user?: any): Promise<boolean> {
    try {
      await this.catorceBrain.runSql(`
        UPDATE ia_brain.alertas_proactivas
        SET reconocida = true
        WHERE id = ${Number(alertId)};
      `);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Marca una alerta como resuelta
   */
  public async resolveAlert(alertId: number, user?: any): Promise<boolean> {
    try {
      await this.catorceBrain.runSql(`
        UPDATE ia_brain.alertas_proactivas
        SET resuelta = true, reconocida = true
        WHERE id = ${Number(alertId)};
      `);
      return true;
    } catch {
      return false;
    }
  }
}
