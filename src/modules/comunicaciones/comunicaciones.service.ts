import { Injectable, Logger } from '@nestjs/common';
import { ComunicacionesGateway, SesionActiva } from './comunicaciones.gateway';
import { SupabaseService } from '../supabase/supabase.service';
import { SubirGrabacionDto } from './dto/subir-grabacion.dto';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ComunicacionesService {
    private readonly logger = new Logger(ComunicacionesService.name);
    private transporter: nodemailer.Transporter;

    constructor(
        private readonly gateway: ComunicacionesGateway,
        private readonly supabase: SupabaseService,
        private readonly configService: ConfigService,
    ) {
        // Configure email transporter
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
            port: this.configService.get('SMTP_PORT', 587),
            secure: false,
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            },
        });
    }

    /**
     * 📊 Obtener estadísticas de comunicaciones (Tiempo Real + Histórico)
     */
    async getEstadisticas() {
        const statsRealTime = this.gateway.getEstadisticas();
        const db = this.supabase.getClient();
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        try {
            // 1. Total llamadas histórico
            const { count: totalLlamadas } = await db
                .from('comunicaciones_historial')
                .select('*', { count: 'exact', head: true });

            // 2. Llamadas hoy
            const { count: llamadasHoy } = await db
                .from('comunicaciones_historial')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', hoy.toISOString());

            // 3. Duración promedio
            const { data: duraciones } = await db
                .from('comunicaciones_historial')
                .select('duracion_segundos');

            let promedio = 0;
            if (duraciones && duraciones.length > 0) {
                const totalDuracion = duraciones.reduce((acc, curr) => acc + (curr.duracion_segundos || 0), 0);
                promedio = Math.round(totalDuracion / duraciones.length);
            }

            return {
                total_llamadas: totalLlamadas || 0,
                llamadas_hoy: llamadasHoy || 0,
                duracion_promedio: promedio,
                comunicaciones_activas: statsRealTime.sesiones_activas,
                clientes_conectados: statsRealTime.clientes_conectados,
                empleados_online: statsRealTime.empleados_online,
                sesiones_detalladas: statsRealTime.lista_sesiones,
                timestamp: new Date(),
            };
        } catch (error) {
            this.logger.error('Error calculando estadísticas:', error);
            return {
                total_llamadas: 0,
                llamadas_hoy: 0,
                duracion_promedio: 0,
                comunicaciones_activas: statsRealTime.sesiones_activas,
                clientes_conectados: statsRealTime.clientes_conectados,
                empleados_online: statsRealTime.empleados_online,
                sesiones_detalladas: statsRealTime.lista_sesiones,
                timestamp: new Date(),
            };
        }
    }

    /**
     * 🔍 Validar que un empleado existe y obtener su información
     */
    async validarEmpleado(empleado_id: number) {
        const db = this.supabase.getClient();

        const { data, error } = await db
            .from('empleados')
            .select('id, nombre_completo, cedula, telefono')
            .eq('id', empleado_id)
            .single();

        if (error || !data) {
            throw new Error(`Empleado ${empleado_id} no encontrado`);
        }

        return data;
    }

    /**
     * 🏢 Obtener información de un puesto
     */
    async obtenerInfoPuesto(puesto_id: number) {
        const db = this.supabase.getClient();

        const { data, error } = await db
            .from('puestos_trabajo')
            .select('id, nombre, direccion, ciudad, cliente_id, clientes(nombre_empresa)')
            .eq('id', puesto_id)
            .single();

        if (error || !data) {
            this.logger.warn(`Puesto ${puesto_id} no encontrado`);
            return null;
        }

        return data;
    }

    /**
     * 🌍 Obtener servidores ICE (STUN/TURN) - Optimizados para Redes Móviles (NAT Traversal)
     */
    async getIceServers() {
        const turnUser = process.env.TURN_USER || 'openrelayproject';
        const turnSecret = process.env.TURN_SECRET || 'openrelayproject';

        // Redundancia extrema para saltar firewalls de datos móviles
        const iceServers: any[] = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { 
              urls: 'turn:openrelay.metered.ca:80', 
              username: turnUser, 
              credential: turnSecret 
            },
            { 
              urls: 'turn:openrelay.metered.ca:443', 
              username: turnUser, 
              credential: turnSecret 
            },
            { 
              urls: 'turn:openrelay.metered.ca:443?transport=tcp', 
              username: turnUser, 
              credential: turnSecret 
            },
            { 
              urls: 'turns:openrelay.metered.ca:443?transport=tcp', 
              username: turnUser, 
              credential: turnSecret 
            }
        ];

        const formattedServers = iceServers.map(s => ({
            ...s,
            url: Array.isArray(s.urls) ? s.urls[0] : s.urls
        }));

        this.logger.log('🧊 Sirviendo ICE Servers optimizados para NAT Traversal');
        return { iceServers: formattedServers };
    }

    /**
     * 🎙️ Subir grabación de audio y guardar metadatos
     */
    async subirGrabacion(file: any, dto: SubirGrabacionDto) {
        const db = this.supabase.getSupabaseAdminClient();
        const fileName = `${dto.sesion_id}_${Date.now()}.webm`;
        const filePath = `recordings/${fileName}`;

        // Validación defensiva final en el servicio
        if (!file || !file.buffer) {
            this.logger.error('❌ Servicio recibió un archivo inválido');
            throw new Error('El objeto de archivo es inválido o no tiene contenido (buffer)');
        }

        const audioBuffer = file.buffer;

        // 1. Subir a Supabase Storage usando helper
        await this.supabase.uploadFile('audio-calls', filePath, audioBuffer, 'audio/webm');

        // 2. Generar URL pública
        const supabaseUrl = process.env.SUPABASE_URL;
        const audioUrl = `${supabaseUrl}/storage/v1/object/public/audio-calls/${filePath}`;

        // 3. Guardar en la base de datos
        const { data, error: dbError } = await db
            .from('comunicaciones_historial')
            .insert({
                sesion_id: dto.sesion_id,
                empleado_id: dto.empleado_id,
                puesto_id: dto.puesto_id,
                usuario_dashboard_id: dto.usuario_dashboard_id,
                tipo: dto.tipo,
                duracion_segundos: dto.duracion_segundos,
                audio_path: filePath,
                audio_url: audioUrl,
                latitud: dto.latitud,
                longitud: dto.longitud,
                fecha_inicio: dto.fecha_inicio,
                fecha_fin: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) {
            this.logger.error(`Error al guardar en historial: ${dbError.message}`);
            throw new Error(`Error al registrar historial: ${dbError.message}`);
        }

        return data;
    }

    /**
     * 📜 Obtener historial de comunicaciones
     */
    async getHistorial(query: { limit?: number, offset?: number, empleado_id?: number }) {
        const db = this.supabase.getClient();
        let q = db
            .from('comunicaciones_historial')
            .select(`
                *,
                empleados(nombre_completo),
                puestos_trabajo(nombre)
            `)
            .order('created_at', { ascending: false });

        if (query.empleado_id) {
            q = q.eq('empleado_id', query.empleado_id);
        }

        if (query.limit) q = q.limit(query.limit);
        if (query.offset) q = q.range(query.offset || 0, (query.offset || 0) + (query.limit || 10) - 1);

        const { data, error } = await q;

        if (error) {
            this.logger.error(`Error al obtener historial: ${error.message}`);
            throw new Error('No se pudo obtener el historial');
        }

        return data;
    }

    /**
     * 🔍 Obtener detalle de una grabación
     */
    async getHistorialDetalle(id: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('comunicaciones_historial')
            .select(`
                *,
                empleados(nombre_completo, cedula, telefono),
                puestos_trabajo(nombre, direccion, ciudad)
            `)
            .eq('id', id)
            .single();

        if (error) {
            throw new Error(`Registro no encontrado: ${error.message}`);
        }

        return data;
    }

    /**
     * 🗑️ Eliminar registro y archivo
     */
    async eliminarHistorial(id: number) {
        const db = this.supabase.getSupabaseAdminClient();

        // 1. Obtener registro para saber la ruta del archivo
        const { data: registro } = await db
            .from('comunicaciones_historial')
            .select('audio_path')
            .eq('id', id)
            .single();

        // 2. Eliminar de Storage si existe
        if (registro?.audio_path) {
            await this.supabase.deleteFile('audio-calls', registro.audio_path);
        }

        // 3. Eliminar de DB
        const { error } = await db
            .from('comunicaciones_historial')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Error al eliminar: ${error.message}`);

        return { success: true };
    }

    // 🟢 BLOQUE 4 - Email & WhatsApp Communications
    /**
     * 📧 Enviar email
     */
    async enviarEmail(destinatarios: string[], asunto: string, cuerpo: string, adjuntos?: any[]) {
        try {
            const mailOptions = {
                from: this.configService.get('SMTP_FROM', 'noreply@proliseg.com'),
                to: destinatarios.join(', '),
                subject: asunto,
                html: cuerpo,
                attachments: adjuntos || [],
            };

            const info = await this.transporter.sendMail(mailOptions);

            this.logger.log(`Email enviado: ${info.messageId}`);
            return {
                success: true,
                messageId: info.messageId,
                destinatarios,
            };
        } catch (error) {
            this.logger.error('Error enviando email:', error);
            throw new Error('Error al enviar email');
        }
    }

    /**
     * 📱 Enviar WhatsApp
     */
    async enviarWhatsApp(numero: string, mensaje: string) {
        // TODO: Integrate with WhatsApp API (Twilio, WhatsApp Business API, etc.)
        this.logger.log(`WhatsApp enviado a ${numero}: ${mensaje.substring(0, 50)}...`);

        // Simulación de envío
        return {
            success: true,
            numero,
            mensaje_id: `wa_${Date.now()}`,
            nota: 'Integración de WhatsApp pendiente - requiere configuración de API',
        };
    }

    /**
     * 📄 Enviar cotización por email/WhatsApp
     */
    async enviarCotizacionCliente(cotizacionId: number, email: string, telefono?: string, enviarWhatsApp = false) {
        const publicUrl = `${this.configService.get('APP_URL', 'https://app.proliseg.com')}/public/cotizaciones/${cotizacionId}`;

        // Enviar email
        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1976D2;">Nueva Cotización - PROLISEG</h2>
                <p>Estimado cliente,</p>
                <p>Le hemos enviado una nueva cotización para su revisión.</p>
                <p style="margin: 30px 0;">
                    <a href="${publicUrl}" 
                       style="background-color: #1976D2; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 4px; display: inline-block;">
                        Ver Cotización
                    </a>
                </p>
                <p style="color: #666; font-size: 12px;">
                    Este enlace estará disponible por 30 días.
                </p>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 11px;">
                    PROLISEG - Seguridad Profesional<br>
                    Este es un correo automático, por favor no responder.
                </p>
            </div>
        `;

        const emailResult = await this.enviarEmail(
            [email],
            'Nueva Cotización - PROLISEG',
            emailBody
        );

        let whatsappResult: any = null;
        if (enviarWhatsApp && telefono) {
            const whatsappMessage = `Hola! Te hemos enviado una nueva cotización. Puedes verla aquí: ${publicUrl}`;
            whatsappResult = await this.enviarWhatsApp(telefono, whatsappMessage);
        }

        return {
            email: emailResult,
            whatsapp: whatsappResult,
            publicUrl,
        };
    }

    /**
     * 🔔 Notificar emergencia
     */
    async notificarEmergencia(data: {
        empleado_id: number;
        mensaje: string;
        puesto_id?: number;
        latitud?: number;
        longitud?: number;
    }) {
        this.gateway.emitEvent('emergencia_comunicacion', {
            ...data,
            timestamp: new Date(),
        });

        this.logger.warn(`🚨 EMERGENCIA: ${data.mensaje} - Empleado ${data.empleado_id}`);
    }
}
