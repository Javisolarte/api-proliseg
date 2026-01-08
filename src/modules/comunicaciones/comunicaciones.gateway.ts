import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AudioChunkDto, IniciarComunicacionDto, FinalizarComunicacionDto, MensajeTextoDto, ResponderComunicacionDto, OrigenAudio } from './dto/comunicacion.dto';

interface SesionActiva {
    sesion_id: string;
    empleado_id: number;
    empleado_nombre?: string;
    puesto_id?: number;
    cliente_id?: number;
    tipo: string;
    mensaje_inicial?: string;
    fecha_inicio: Date;
    socket_id: string; // Socket ID de la app que inició la sesión
    latitud?: number;
    longitud?: number;
    chunks_recibidos: number;
    respondiendo?: boolean; // Indica si el dashboard está respondiendo
    usuario_dashboard_id?: number; // ID del usuario del dashboard que responde
    chunks_dashboard: number; // Contador de chunks desde el dashboard
}

@WebSocketGateway({
    cors: {
        origin: '*', // Ajustar según necesidades de seguridad en producción
    },
    namespace: 'comunicaciones',
})
export class ComunicacionesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('ComunicacionesGateway');

    // Almacenamiento en memoria de sesiones activas
    private sesionesActivas: Map<string, SesionActiva> = new Map();

    // Mapeo de socket.id a sesion_id
    private socketToSesion: Map<string, string> = new Map();

    handleConnection(client: Socket) {
        this.logger.log(`🔌 Cliente conectado: ${client.id}`);

        // Enviar lista de sesiones activas al nuevo cliente
        const sesiones = Array.from(this.sesionesActivas.values()).map(s => ({
            sesion_id: s.sesion_id,
            empleado_id: s.empleado_id,
            empleado_nombre: s.empleado_nombre,
            tipo: s.tipo,
            mensaje_inicial: s.mensaje_inicial,
            fecha_inicio: s.fecha_inicio,
            duracion_segundos: Math.floor((Date.now() - s.fecha_inicio.getTime()) / 1000),
        }));

        client.emit('sesiones_activas', sesiones);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`🔌 Cliente desconectado: ${client.id}`);

        // Si el cliente que se desconecta tenía una sesión activa, finalizarla
        const sesionId = this.socketToSesion.get(client.id);
        if (sesionId) {
            const sesion = this.sesionesActivas.get(sesionId);
            if (sesion) {
                this.logger.warn(`⚠️ Sesión ${sesionId} interrumpida por desconexión`);
                this.server.emit('sesion_finalizada', {
                    sesion_id: sesionId,
                    motivo: 'Desconexión del cliente',
                    estado: 'interrumpida',
                });
                this.sesionesActivas.delete(sesionId);
            }
            this.socketToSesion.delete(client.id);
        }
    }

    /**
     * 🎙️ Iniciar una nueva sesión de comunicación
     */
    @SubscribeMessage('iniciar_comunicacion')
    handleIniciarComunicacion(
        @MessageBody() data: IniciarComunicacionDto,
        @ConnectedSocket() client: Socket,
    ) {
        // Generar ID único para la sesión
        const sesionId = `sesion_${Date.now()}_${data.empleado_id}`;

        const sesion: SesionActiva = {
            sesion_id: sesionId,
            empleado_id: data.empleado_id,
            puesto_id: data.puesto_id,
            cliente_id: data.cliente_id,
            tipo: data.tipo,
            mensaje_inicial: data.mensaje_inicial,
            fecha_inicio: new Date(),
            socket_id: client.id,
            latitud: data.latitud,
            longitud: data.longitud,
            chunks_recibidos: 0,
            chunks_dashboard: 0,
        };

        this.sesionesActivas.set(sesionId, sesion);
        this.socketToSesion.set(client.id, sesionId);

        this.logger.log(`🎙️ Nueva sesión de comunicación iniciada: ${sesionId} por empleado ${data.empleado_id}`);

        // Notificar a todos los clientes (dashboard) que hay una nueva sesión
        this.server.emit('nueva_comunicacion', {
            sesion_id: sesionId,
            empleado_id: data.empleado_id,
            tipo: data.tipo,
            mensaje_inicial: data.mensaje_inicial,
            puesto_id: data.puesto_id,
            cliente_id: data.cliente_id,
            fecha_inicio: sesion.fecha_inicio,
            latitud: data.latitud,
            longitud: data.longitud,
        });

        // Confirmar al emisor
        client.emit('sesion_iniciada', {
            sesion_id: sesionId,
            estado: 'activa',
        });

        return { success: true, sesion_id: sesionId };
    }

    /**
     * 🔊 Transmitir chunk de audio
     */
    @SubscribeMessage('audio_chunk')
    handleAudioChunk(
        @MessageBody() data: AudioChunkDto,
        @ConnectedSocket() client: Socket,
    ) {
        const sesion = this.sesionesActivas.get(data.sesion_id);

        if (!sesion) {
            this.logger.error(`❌ Sesión no encontrada: ${data.sesion_id}`);
            client.emit('error', { message: 'Sesión no encontrada' });
            return { success: false, error: 'Sesión no encontrada' };
        }

        const origen = data.origen || OrigenAudio.APP;

        // Incrementar contador según origen
        if (origen === OrigenAudio.APP) {
            sesion.chunks_recibidos++;
        } else {
            sesion.chunks_dashboard++;
        }

        this.logger.debug(`🔊 Audio chunk recibido desde ${origen}: sesión ${data.sesion_id}, seq ${data.sequence}`);

        // Routing selectivo según origen
        if (origen === OrigenAudio.APP) {
            // Audio de app → Broadcast a todos los dashboards (excepto emisor)
            client.broadcast.emit('audio_stream', {
                sesion_id: data.sesion_id,
                audio_data: data.audio_data,
                sequence: data.sequence,
                formato: data.formato || 'webm',
                duracion_ms: data.duracion_ms,
                es_final: data.es_final,
                empleado_id: sesion.empleado_id,
                origen: OrigenAudio.APP,
            });
        } else {
            // Audio de dashboard → Solo a la app de esa sesión
            const appSocket = this.server.sockets.sockets.get(sesion.socket_id);
            if (appSocket) {
                appSocket.emit('audio_stream_dashboard', {
                    sesion_id: data.sesion_id,
                    audio_data: data.audio_data,
                    sequence: data.sequence,
                    formato: data.formato || 'webm',
                    duracion_ms: data.duracion_ms,
                    es_final: data.es_final,
                    usuario_dashboard_id: sesion.usuario_dashboard_id,
                    origen: OrigenAudio.DASHBOARD,
                });
                this.logger.debug(`📡 Audio enviado a app ${sesion.socket_id}`);
            } else {
                this.logger.warn(`⚠️ App desconectada para sesión ${data.sesion_id}`);
            }
        }

        return { success: true, sequence: data.sequence, origen };
    }

    /**
     * 🛑 Finalizar sesión de comunicación
     */
    @SubscribeMessage('finalizar_comunicacion')
    handleFinalizarComunicacion(
        @MessageBody() data: FinalizarComunicacionDto,
        @ConnectedSocket() client: Socket,
    ) {
        const sesion = this.sesionesActivas.get(data.sesion_id);

        if (!sesion) {
            this.logger.error(`❌ Sesión no encontrada: ${data.sesion_id}`);
            return { success: false, error: 'Sesión no encontrada' };
        }

        const duracion = Math.floor((Date.now() - sesion.fecha_inicio.getTime()) / 1000);

        this.logger.log(`🛑 Sesión finalizada: ${data.sesion_id}, duración: ${duracion}s, chunks: ${sesion.chunks_recibidos}`);

        // Notificar a todos los clientes
        this.server.emit('sesion_finalizada', {
            sesion_id: data.sesion_id,
            empleado_id: sesion.empleado_id,
            duracion_segundos: duracion,
            chunks_totales: sesion.chunks_recibidos,
            motivo: data.motivo,
            estado: 'finalizada',
        });

        // Limpiar sesión
        this.sesionesActivas.delete(data.sesion_id);
        this.socketToSesion.delete(sesion.socket_id);

        return { success: true, duracion_segundos: duracion };
    }

    /**
     * 📞 Dashboard responde a una comunicación
     */
    @SubscribeMessage('responder_comunicacion')
    handleResponderComunicacion(
        @MessageBody() data: ResponderComunicacionDto,
        @ConnectedSocket() client: Socket,
    ) {
        const sesion = this.sesionesActivas.get(data.sesion_id);

        if (!sesion) {
            this.logger.error(`❌ Sesión no encontrada: ${data.sesion_id}`);
            return { success: false, error: 'Sesión no encontrada' };
        }

        // Marcar sesión como respondiendo
        sesion.respondiendo = true;
        sesion.usuario_dashboard_id = data.usuario_dashboard_id;

        this.logger.log(`📞 Dashboard usuario ${data.usuario_dashboard_id} respondiendo a sesión ${data.sesion_id}`);

        // Notificar a la app que el dashboard está respondiendo
        const appSocket = this.server.sockets.sockets.get(sesion.socket_id);
        if (appSocket) {
            appSocket.emit('dashboard_respondiendo', {
                sesion_id: data.sesion_id,
                usuario_dashboard_id: data.usuario_dashboard_id,
                mensaje_respuesta: data.mensaje_respuesta,
                timestamp: new Date(),
            });
        }

        // Notificar a todos los dashboards
        this.server.emit('respuesta_iniciada', {
            sesion_id: data.sesion_id,
            usuario_dashboard_id: data.usuario_dashboard_id,
            mensaje_respuesta: data.mensaje_respuesta,
        });

        return { success: true, sesion_id: data.sesion_id };
    }

    /**
     * 💬 Enviar mensaje de texto rápido
     */
    @SubscribeMessage('mensaje_texto')
    handleMensajeTexto(
        @MessageBody() data: MensajeTextoDto,
        @ConnectedSocket() client: Socket,
    ) {
        this.logger.log(`💬 Mensaje de texto de empleado ${data.empleado_id}: ${data.mensaje}`);

        // Broadcast a todos los clientes
        this.server.emit('nuevo_mensaje', {
            empleado_id: data.empleado_id,
            mensaje: data.mensaje,
            puesto_id: data.puesto_id,
            prioridad: data.prioridad || 'normal',
            timestamp: new Date(),
        });

        return { success: true };
    }

    /**
     * 📊 Obtener sesiones activas
     */
    @SubscribeMessage('obtener_sesiones_activas')
    handleObtenerSesionesActivas(@ConnectedSocket() client: Socket) {
        const sesiones = Array.from(this.sesionesActivas.values()).map(s => ({
            sesion_id: s.sesion_id,
            empleado_id: s.empleado_id,
            empleado_nombre: s.empleado_nombre,
            tipo: s.tipo,
            mensaje_inicial: s.mensaje_inicial,
            fecha_inicio: s.fecha_inicio,
            duracion_segundos: Math.floor((Date.now() - s.fecha_inicio.getTime()) / 1000),
            chunks_recibidos: s.chunks_recibidos,
            latitud: s.latitud,
            longitud: s.longitud,
        }));

        client.emit('sesiones_activas', sesiones);
        return { success: true, sesiones };
    }

    /**
     * Método público para emitir eventos desde el servicio
     */
    emitEvent(event: string, data: any) {
        this.server.emit(event, data);
    }

    /**
     * Obtener estadísticas de sesiones activas
     */
    getEstadisticas() {
        return {
            sesiones_activas: this.sesionesActivas.size,
            clientes_conectados: this.server.sockets.sockets.size,
        };
    }
}
