import { Injectable } from '@nestjs/common';
import { AccessToken, RoomServiceClient, ParticipantInfo, Room } from 'livekit-server-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LiveKitService {
  private apiKey: string;
  private apiSecret: string;
  private serverUrl: string;
  private roomService: RoomServiceClient;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY') || '';
    this.apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET') || '';
    this.serverUrl = this.configService.get<string>('LIVEKIT_URL') || '';
    
    if (!this.apiKey || !this.apiSecret || !this.serverUrl) {
      console.error('⚠️ [LiveKitService] Faltan variables de entorno para LiveKit');
    }

    // Cliente para gestionar salas y participantes
    this.roomService = new RoomServiceClient(this.serverUrl, this.apiKey, this.apiSecret);
  }

  /**
   * Genera un token para unirse a una sala de radio (Room)
   */
  async generateToken(identity: string, roomName: string, canPublish: boolean = true): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: identity,
      name: identity,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }

  /**
   * Listar todos los canales de radio activos
   */
  async listRooms(): Promise<Room[]> {
    return await this.roomService.listRooms();
  }

  /**
   * Eliminar/Cerrar un canal de radio
   */
  async deleteRoom(roomName: string): Promise<void> {
    await this.roomService.deleteRoom(roomName);
  }

  /**
   * Listar participantes en un canal
   */
  async listParticipants(roomName: string): Promise<ParticipantInfo[]> {
    return await this.roomService.listParticipants(roomName);
  }

  /**
   * Expulsar a alguien de la radio
   */
  async removeParticipant(roomName: string, identity: string): Promise<void> {
    await this.roomService.removeParticipant(roomName, identity);
  }

  getServerUrl(): string {
    return this.serverUrl;
  }
}
