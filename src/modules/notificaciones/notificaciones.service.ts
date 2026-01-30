import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import {
  RegistrarDispositivoDto,
  ConfigurarPreferenciasDto
} from './dto/notificaciones.dto';

@Injectable()
export class NotificacionesService implements OnModuleInit {
  private readonly logger = new Logger(NotificacionesService.name);
  private emailTransporter: nodemailer.Transporter;
  private firebaseApp: admin.app.App;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.initializeEmail();
  }

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeEmail() {
    this.emailTransporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  private initializeFirebase() {
    try {
      if (!admin.apps.length) {
        const serviceAccount = this.configService.get('FIREBASE_SERVICE_ACCOUNT');
        if (serviceAccount) {
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount)),
          });
          this.logger.log('✅ Firebase Admin inicializado correctamente');
        } else {
          this.logger.warn('⚠️ No se configuró FIREBASE_SERVICE_ACCOUNT. Notificaciones Push no funcionarán.');
        }
      } else {
        this.firebaseApp = admin.app();
      }
    } catch (error) {
      this.logger.error('❌ Error inicializando Firebase:', error);
    }
  }

  // ==========================================
  // 1. GESTIÓN DE DISPOSITIVOS Y PREFERENCIAS
  // ==========================================

  async registrarDispositivo(userId: number, dto: RegistrarDispositivoDto, tipoUsuario: 'usuario' | 'empleado' = 'usuario') {
    const supabase = this.supabaseService.getClient();

    const dataToUpsert: any = {
      token_dispositivo: dto.token_dispositivo,
      plataforma: dto.plataforma,
      modelo_dispositivo: dto.modelo_dispositivo,
      app_version: dto.app_version,
      activo: true,
      ultimo_uso: new Date().toISOString()
    };

    if (tipoUsuario === 'usuario') dataToUpsert.usuario_id = userId;
    else dataToUpsert.empleado_id = userId;

    const { data, error } = await supabase
      .from('notificaciones_dispositivos')
      .upsert(dataToUpsert, { onConflict: 'token_dispositivo' })
      .select()
      .single();

    if (error) {
      this.logger.error(`Error registrando dispositivo: ${error.message}`);
      throw new Error('Error al registrar dispositivo');
    }
    return data;
  }

  async configurarPreferencias(userId: number, dto: ConfigurarPreferenciasDto) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('notificaciones_preferencias')
      .upsert({
        usuario_id: userId,
        evento_id: dto.evento_id,
        canal: dto.canal,
        habilitado: dto.habilitado,
        horario_silencio_inicio: dto.horario_silencio_inicio,
        horario_silencio_fin: dto.horario_silencio_fin
      }, { onConflict: 'usuario_id, evento_id, canal' })
      .select();

    if (error) throw new Error(error.message);
    return data;
  }

  // ==========================================
  // 2. CORE: MOTOR DE ENVÍO
  // ==========================================

  async dispararEvento(codigoEvento: string, datos: any) {
    const supabase = this.supabaseService.getClient();

    const { data: evento } = await supabase
      .from('notificaciones_eventos')
      .select('*')
      .eq('codigo', codigoEvento)
      .eq('activo', true)
      .single();

    if (!evento) {
      this.logger.warn(`Evento ${codigoEvento} no encontrado o inactivo`);
      return;
    }

    const destinatarios = datos.destinatarios || [];

    for (const dest of destinatarios) {
      const { data: plantillas } = await supabase
        .from('notificaciones_plantillas')
        .select('*')
        .eq('evento_id', evento.id)
        .eq('activo', true);

      if (!plantillas || plantillas.length === 0) {
        this.logger.warn(`No hay plantillas para el evento ${codigoEvento}`);
        continue;
      }

      for (const plantilla of plantillas) {
        const puedeEnviar = await this.verificarPreferencias(dest.id, dest.tipo, evento.id, plantilla.canal);

        const esCritico = evento.prioridad_por_defecto === 'critica';
        const esObligatorio = evento.canales_obligatorios?.includes(plantilla.canal);

        if (puedeEnviar || esCritico || esObligatorio) {
          const mensajeRenderizado = this.renderizarPlantilla(plantilla.cuerpo_template, datos.variables);
          const asuntoRenderizado = plantilla.asunto_template
            ? this.renderizarPlantilla(plantilla.asunto_template, datos.variables)
            : null;

          await this.encolarNotificacion({
            destinatario_tipo: dest.tipo,
            destinatario_id: dest.id,
            evento_id: evento.id,
            canal: plantilla.canal,
            titulo: asuntoRenderizado,
            mensaje: mensajeRenderizado,
            datos_extra: plantilla.metadata_template ? { ...plantilla.metadata_template, ...datos.extra } : datos.extra,
            prioridad: evento.prioridad_por_defecto
          });
        }
      }
    }
  }

  private async verificarPreferencias(userId: number, userType: string, eventoId: number, canal: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();

    let query = supabase.from('notificaciones_preferencias')
      .select('*')
      .eq('evento_id', eventoId)
      .eq('canal', canal);

    if (userType === 'usuario') query = query.eq('usuario_id', userId);
    else query = query.eq('empleado_id', userId);

    const { data: pref } = await query.single();

    if (pref) {
      if (!pref.habilitado) return false;

      if (pref.horario_silencio_inicio && pref.horario_silencio_fin) {
        const ahora = new Date();
        const horaActual = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}:00`;
        // Comparación simple de cadenas de tiempo
        if (horaActual >= pref.horario_silencio_inicio && horaActual <= pref.horario_silencio_fin) {
          return false;
        }
        // Nota: no maneja rangos que cruzan la medianoche (ej: 23:00 a 06:00) sin lógica adicional
      }
    }

    return true;
  }

  private renderizarPlantilla(template: string, variables: any = {}): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
  }

  private async encolarNotificacion(data: any) {
    const supabase = this.supabaseService.getClient();
    await supabase.from('notificaciones_envios').insert(data);
    this.logger.log(`Notificación encolada: ${data.canal} para ${data.destinatario_tipo} ${data.destinatario_id}`);
  }

  // ==========================================
  // 3. WORKER: PROCESAMIENTO DE COLAS
  // ==========================================

  // Esté método se ejecuta automáticamente cada minuto
  @Cron(CronExpression.EVERY_MINUTE)
  async procesarColaEnvios(limit = 50) {
    const supabase = this.supabaseService.getClient();

    const { data: pendientes } = await supabase
      .from('notificaciones_envios')
      .select('*')
      .eq('estado', 'pendiente')
      .lte('fecha_programada', new Date().toISOString())
      .order('prioridad', { ascending: false })
      .limit(limit);

    if (!pendientes?.length) return;

    this.logger.log(`Procesando ${pendientes.length} notificaciones pendientes...`);

    const promesas = pendientes.map(async (envio) => {
      await supabase.from('notificaciones_envios').update({ estado: 'procesando' }).eq('id', envio.id);

      try {
        let resultado;
        switch (envio.canal) {
          case 'push':
            resultado = await this.enviarPush(envio);
            break;
          case 'email':
            resultado = await this.enviarEmail(envio);
            break;
          case 'whatsapp':
            resultado = await this.enviarWhatsApp(envio);
            break;
          case 'in_app':
            resultado = { success: true, id_externo: 'db_stored' };
            break;
          default:
            resultado = { success: false, error: 'Canal no soportado' };
        }

        await supabase.from('notificaciones_envios').update({
          estado: resultado.success ? 'enviado' : 'fallido',
          fecha_envio: resultado.success ? new Date().toISOString() : null,
          intentos_realizados: (envio.intentos_realizados || 0) + 1,
          proveedor_id_externo: resultado.id_externo,
          error_log: resultado.error
        }).eq('id', envio.id);

      } catch (error) {
        this.logger.error(`Fallo envío ${envio.id}:`, error);
        await supabase.from('notificaciones_envios').update({
          estado: 'fallido',
          intentos_realizados: (envio.intentos_realizados || 0) + 1,
          error_log: error.message
        }).eq('id', envio.id);
      }
    });

    await Promise.all(promesas);
  }

  // ==========================================
  // 4. INTEGRACIONES (PROVIDERS)
  // ==========================================

  private async enviarPush(envio: any) {
    if (!this.firebaseApp) return { success: false, error: 'Firebase no configurado' };

    const supabase = this.supabaseService.getClient();

    const query = supabase.from('notificaciones_dispositivos').select('token_dispositivo').eq('activo', true);
    if (envio.destinatario_tipo === 'usuario') query.eq('usuario_id', envio.destinatario_id);
    else query.eq('empleado_id', envio.destinatario_id);

    const { data: dispositivos } = await query;

    if (!dispositivos?.length) return { success: false, error: 'No hay dispositivos registrados' };

    const tokens = dispositivos.map(d => d.token_dispositivo);
    if (tokens.length === 0) return { success: false, error: 'Lista de tokens vacía' };

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: envio.titulo || 'Nueva notificación',
        body: envio.mensaje,
      },
      data: {
        ...(envio.datos_extra || {}),
        click_action: envio.accion_url || 'FLUTTER_NOTIFICATION_CLICK',
        notification_id: String(envio.id)
      },
      android: { priority: 'high' as any }
    };

    try {
      const response = await this.firebaseApp.messaging().sendEachForMulticast(message);

      return {
        success: response.successCount > 0,
        id_externo: `success:${response.successCount},fail:${response.failureCount}`,
        error: response.failureCount > 0 ? 'Algunos tokens fallaron' : null
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  private async enviarEmail(envio: any) {
    const supabase = this.supabaseService.getClient();
    let emailDestino = '';

    if (envio.destinatario_tipo === 'usuario') {
      const { data } = await supabase.from('usuarios_externos').select('email').eq('id', envio.destinatario_id).single();
      emailDestino = data?.email;
    } else if (envio.destinatario_tipo === 'empleado') {
      const { data } = await supabase.from('empleados').select('email').eq('id', envio.destinatario_id).single();
      emailDestino = data?.email;
    }

    if (!emailDestino) return { success: false, error: 'Email no encontrado' };

    try {
      const info = await this.emailTransporter.sendMail({
        from: this.configService.get('SMTP_FROM'),
        to: emailDestino,
        subject: envio.titulo,
        html: envio.mensaje
      });
      return { success: true, id_externo: info.messageId };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  private async enviarWhatsApp(envio: any) {
    this.logger.log(`[WHATSAPP MOCK] Sending to ID ${envio.destinatario_id}: ${envio.mensaje}`);
    return { success: true, id_externo: 'mock_wa_123' };
  }
  async verificarAsignacionesIncompletas() {
    // Implementación pendiente o placeholder para corregir error de build
    this.logger.debug('Verificando asignaciones incompletas (Placeholder)');
    return { verificados: 0, notificaciones_creadas: 0 };
  }
}

