import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*', // Ajustar según necesidades de seguridad
    },
    namespace: 'alerts',
})
export class BotonPanicoGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('BotonPanicoGateway');

    handleConnection(client: Socket) {
        this.logger.log(`Cliente conectado: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Cliente desconectado: ${client.id}`);
    }

    emitPanicEvent(data: any) {
        this.logger.warn(`🚨 Emitiendo alerta de pánico: ${data.id}`);
        this.server.emit('nuevo_panico', data);
    }
}
