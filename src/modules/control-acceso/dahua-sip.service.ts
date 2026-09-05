import { Injectable, Logger } from '@nestjs/common';
import * as dgram from 'dgram';
import * as crypto from 'crypto';
import { spawn } from 'child_process';

interface ActiveSipSession {
  callId: string;
  fromTag: string;
  toTag: string;
  cseq: number;
  sipSocket: dgram.Socket;
  rtpSocket: dgram.Socket;
  localSipPort: number;
  localRtpPort: number;
  remoteIp: string;
  remoteSipPort: number;
  remoteRtpPort: number;
  targetUser: string;
  ffmpegProcess?: any;
  stop: () => void;
}

@Injectable()
export class DahuaSipService {
  private readonly logger = new Logger('DahuaSipService');
  private activeSessions = new Map<string, ActiveSipSession>();

  /**
   * Obtiene la ruta al binario ffmpeg según el sistema operativo.
   */
  private getFfmpegBinary(): string {
    if (process.platform === 'win32') {
      return 'ffmpeg.exe';
    }
    return 'ffmpeg';
  }

  /**
   * Genera una cadena aleatoria alfanumérica.
   */
  private randomStr(len = 8): string {
    return crypto.randomBytes(len).toString('hex');
  }

  /**
   * Abre un socket UDP en un puerto efímero disponible.
   */
  private async createUdpSocket(): Promise<{ socket: dgram.Socket; port: number }> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      socket.bind(0, '0.0.0.0', () => {
        const addr = socket.address();
        resolve({ socket, port: addr.port });
      });
      socket.on('error', (err) => reject(err));
    });
  }

  /**
   * Construye un mensaje SIP INVITE con SDP para códec G.711A (PCMA / 8000Hz).
   */
  private buildInvite(
    callId: string,
    fromTag: string,
    cseq: number,
    localIp: string,
    localSipPort: number,
    targetIp: string,
    targetSipPort: number,
    localRtpPort: number,
    user = '8001',
  ): string {
    const sdp = [
      'v=0',
      `o=proliseg 1000 1000 IN IP4 ${localIp}`,
      's=ProlisegTalk',
      `c=IN IP4 ${localIp}`,
      't=0 0',
      `m=audio ${localRtpPort} RTP/AVP 8`,
      'a=rtpmap:8 PCMA/8000',
      'a=sendrecv',
      '',
    ].join('\r\n');

    const headers = [
      `INVITE sip:${user}@${targetIp}:${targetSipPort} SIP/2.0`,
      `Via: SIP/2.0/UDP ${localIp}:${localSipPort};branch=z9hG4bK-${this.randomStr(8)};rport`,
      `From: <sip:operator@${localIp}:${localSipPort}>;tag=${fromTag}`,
      `To: <sip:${user}@${targetIp}:${targetSipPort}>`,
      `Call-ID: ${callId}`,
      `CSeq: ${cseq} INVITE`,
      `Contact: <sip:operator@${localIp}:${localSipPort}>`,
      'Max-Forwards: 70',
      'User-Agent: Proliseg-Intercom/1.0',
      'Content-Type: application/sdp',
      `Content-Length: ${Buffer.byteLength(sdp, 'utf8')}`,
      '',
      sdp,
    ].join('\r\n');

    return headers;
  }

  /**
   * Construye un mensaje SIP ACK.
   */
  private buildAck(
    callId: string,
    fromTag: string,
    toTag: string,
    cseq: number,
    localIp: string,
    localSipPort: number,
    targetIp: string,
    targetSipPort: number,
    user = '8001',
  ): string {
    return [
      `ACK sip:${user}@${targetIp}:${targetSipPort} SIP/2.0`,
      `Via: SIP/2.0/UDP ${localIp}:${localSipPort};branch=z9hG4bK-${this.randomStr(8)};rport`,
      `From: <sip:operator@${localIp}:${localSipPort}>;tag=${fromTag}`,
      `To: <sip:${user}@${targetIp}:${targetSipPort}>;tag=${toTag}`,
      `Call-ID: ${callId}`,
      `CSeq: ${cseq} ACK`,
      'Max-Forwards: 70',
      'User-Agent: Proliseg-Intercom/1.0',
      'Content-Length: 0',
      '',
      '',
    ].join('\r\n');
  }

  /**
   * Construye un mensaje SIP BYE para colgar la llamada.
   */
  private buildBye(
    callId: string,
    fromTag: string,
    toTag: string,
    cseq: number,
    localIp: string,
    localSipPort: number,
    targetIp: string,
    targetSipPort: number,
    user = '8001',
  ): string {
    return [
      `BYE sip:${user}@${targetIp}:${targetSipPort} SIP/2.0`,
      `Via: SIP/2.0/UDP ${localIp}:${localSipPort};branch=z9hG4bK-${this.randomStr(8)};rport`,
      `From: <sip:operator@${localIp}:${localSipPort}>;tag=${fromTag}`,
      `To: <sip:${user}@${targetIp}:${targetSipPort}>;tag=${toTag}`,
      `Call-ID: ${callId}`,
      `CSeq: ${cseq} BYE`,
      'Max-Forwards: 70',
      'User-Agent: Proliseg-Intercom/1.0',
      'Content-Length: 0',
      '',
      '',
    ].join('\r\n');
  }

  /**
   * Parsea respuestas SIP estándar para extraer código, etiquetas y puerto RTP del SDP.
   */
  private parseSipMessage(raw: string): {
    statusCode: number;
    toTag?: string;
    rtpPort?: number;
    callId?: string;
  } {
    const lines = raw.split('\r\n');
    const firstLine = lines[0] || '';
    const statusMatch = firstLine.match(/^SIP\/2\.0\s+(\d+)/);
    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;

    let toTag: string | undefined;
    let rtpPort: number | undefined;
    let callId: string | undefined;

    for (const line of lines) {
      if (/^To:/i.test(line)) {
        const tagMatch = line.match(/tag=([a-zA-Z0-9_-]+)/);
        if (tagMatch) toTag = tagMatch[1];
      }
      if (/^Call-ID:/i.test(line)) {
        callId = line.replace(/^Call-ID:\s*/i, '').trim();
      }
      if (/^m=audio\s+(\d+)/i.test(line)) {
        const m = line.match(/^m=audio\s+(\d+)/i);
        if (m) rtpPort = parseInt(m[1], 10);
      }
    }

    return { statusCode, toTag, rtpPort, callId };
  }

  /**
   * Crea un paquete RTP estándar RFC 3550 para transportar G.711A (PCMA).
   */
  public createRtpPacket(payload: Buffer, seqNum: number, timestamp: number, ssrc: number): Buffer {
    const header = Buffer.alloc(12);
    header[0] = 0x80; // Version 2, no padding, no extension, CC=0
    header[1] = 0x08; // Payload type 8 = PCMA (G.711 A-law)
    header.writeUInt16BE(seqNum & 0xffff, 2);
    header.writeUInt32BE(timestamp >>> 0, 4);
    header.writeUInt32BE(ssrc >>> 0, 8);
    return Buffer.concat([header, payload]);
  }

  /**
   * Inicia una llamada SIP hacia un terminal Dahua para escuchar el audio de su micrófono.
   * Transcodifica los paquetes RTP G.711A recibidos a MP3 en tiempo real y los entrega al stream HTTP.
   */
  async openDahuaSipListenSession(
    targetIp: string,
    sipPort: number,
    rtpPortFallback: number,
    user = '8001',
    onAudioChunk?: (pcmAlawChunk: Buffer) => void,
  ): Promise<{ stop: () => void } | null> {
    const sessionKey = `${targetIp}:${sipPort}`;
    this.logger.log(`📞 [DAHUA-SIP] Iniciando llamada SIP a Dahua en ${sessionKey}...`);

    // Limpiar sesión previa si existe
    const prev = this.activeSessions.get(sessionKey);
    if (prev) {
      try { prev.stop(); } catch {}
      this.activeSessions.delete(sessionKey);
      await new Promise(r => setTimeout(r, 400));
    }

    try {
      const { socket: sipSocket, port: localSipPort } = await this.createUdpSocket();
      const { socket: rtpSocket, port: localRtpPort } = await this.createUdpSocket();

      const callId = `${this.randomStr(12)}@proliseg`;
      const fromTag = this.randomStr(8);
      let cseq = 1;
      let remoteToTag = '';
      let remoteRtpPort = rtpPortFallback || 15000;
      let isSessionActive = false;

      // Escuchar paquetes RTP entrantes desde el micrófono del Dahua
      rtpSocket.on('message', (msg) => {
        if (msg.length > 12 && onAudioChunk) {
          // Omitir cabecera RTP de 12 bytes para obtener el payload de audio G.711A puro
          const audioPayload = msg.subarray(12);
          onAudioChunk(audioPayload);
        }
      });

      const inviteMsg = this.buildInvite(
        callId,
        fromTag,
        cseq,
        '0.0.0.0',
        localSipPort,
        targetIp,
        sipPort,
        localRtpPort,
        user,
      );

      return new Promise((resolve) => {
        let timer: NodeJS.Timeout | null = null;
        let closed = false;

        const stop = () => {
          if (closed) return;
          closed = true;
          if (timer) clearTimeout(timer);
          this.logger.log(`🛑 [DAHUA-SIP] Finalizando llamada SIP con ${sessionKey}`);
          this.activeSessions.delete(sessionKey);

          if (isSessionActive && remoteToTag) {
            cseq++;
            const byeMsg = this.buildBye(
              callId,
              fromTag,
              remoteToTag,
              cseq,
              '0.0.0.0',
              localSipPort,
              targetIp,
              sipPort,
              user,
            );
            try {
              sipSocket.send(byeMsg, sipPort, targetIp);
            } catch {}
          }

          setTimeout(() => {
            try { sipSocket.close(); } catch {}
            try { rtpSocket.close(); } catch {}
          }, 300);
        };

        sipSocket.on('message', (msgBuf) => {
          const respStr = msgBuf.toString('utf8');
          const parsed = this.parseSipMessage(respStr);

          if (parsed.statusCode === 100 || parsed.statusCode === 180) {
            this.logger.debug(`[DAHUA-SIP] Estado intermedio: ${parsed.statusCode} (${sessionKey})`);
          } else if (parsed.statusCode === 200) {
            if (timer) clearTimeout(timer);
            isSessionActive = true;
            remoteToTag = parsed.toTag || this.randomStr(6);
            if (parsed.rtpPort) {
              remoteRtpPort = parsed.rtpPort;
            }

            this.logger.log(`🎉 [DAHUA-SIP] Llamada conectada 200 OK con ${sessionKey}. Dahua RTP Port: ${remoteRtpPort}`);

            // Enviar ACK para confirmar la sesión
            const ackMsg = this.buildAck(
              callId,
              fromTag,
              remoteToTag,
              cseq,
              '0.0.0.0',
              localSipPort,
              targetIp,
              sipPort,
              user,
            );
            try {
              sipSocket.send(ackMsg, sipPort, targetIp);
            } catch {}

            const session: ActiveSipSession = {
              callId,
              fromTag,
              toTag: remoteToTag,
              cseq,
              sipSocket,
              rtpSocket,
              localSipPort,
              localRtpPort,
              remoteIp: targetIp,
              remoteSipPort: sipPort,
              remoteRtpPort,
              targetUser: user,
              stop,
            };
            this.activeSessions.set(sessionKey, session);

            resolve({ stop });
          } else if (parsed.statusCode >= 400) {
            this.logger.warn(`⚠️ [DAHUA-SIP] Respuesta SIP de error ${parsed.statusCode} desde ${sessionKey}`);
            stop();
            resolve(null);
          }
        });

        // Enviar INVITE
        sipSocket.send(inviteMsg, sipPort, targetIp, (err) => {
          if (err) {
            this.logger.warn(`❌ [DAHUA-SIP] Error enviando INVITE a ${sessionKey}: ${err.message}`);
            stop();
            resolve(null);
          }
        });

        // Timeout de espera de respuesta SIP (3.5 segundos)
        timer = setTimeout(() => {
          if (!isSessionActive) {
            this.logger.warn(`⏱️ [DAHUA-SIP] Timeout esperando respuesta SIP de ${sessionKey}`);
            stop();
            resolve(null);
          }
        }, 3500);
      });
    } catch (e: any) {
      this.logger.error(`❌ [DAHUA-SIP] Excepción al iniciar SIP: ${e.message}`);
      return null;
    }
  }

  /**
   * Transmite el audio del micrófono del operador hacia el altavoz del Dahua vía RTP SIP.
   */
  async relayAudioToDahuaSip(
    audioStream: NodeJS.ReadableStream,
    targetIp: string,
    sipPort: number,
    rtpPortFallback: number,
    user = '8001',
  ): Promise<boolean> {
    const sessionKey = `${targetIp}:${sipPort}`;
    let active = this.activeSessions.get(sessionKey);

    // Si no hay llamada activa, abrirla primero
    if (!active) {
      this.logger.log(`🎙️ [DAHUA-SIP-TALK] No hay sesión activa. Negociando SIP INVITE previa para hablar...`);
      const listenSession = await this.openDahuaSipListenSession(targetIp, sipPort, rtpPortFallback, user);
      if (!listenSession) {
        this.logger.warn(`❌ [DAHUA-SIP-TALK] No se pudo establecer la llamada SIP con Dahua`);
        return false;
      }
      active = this.activeSessions.get(sessionKey);
    }

    if (!active) return false;

    return new Promise((resolve) => {
      // Transcodificar audio del operador (WebM/WAV/Opus) a G.711A (8000Hz, mono)
      const ffmpeg = spawn(this.getFfmpegBinary(), [
        '-hide_banner',
        '-loglevel', 'warning',
        '-i', 'pipe:0',
        '-f', 'alaw',
        '-ar', '8000',
        '-ac', '1',
        'pipe:1',
      ]);

      let seqNum = 1;
      let timestamp = 0;
      const ssrc = crypto.randomBytes(4).readUInt32BE(0);
      const CHUNK_SIZE = 160; // 160 bytes G.711A = 20ms de audio a 8000Hz
      let audioBuffer = Buffer.alloc(0);

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        audioBuffer = Buffer.concat([audioBuffer, chunk]);

        while (audioBuffer.length >= CHUNK_SIZE) {
          const frame = audioBuffer.subarray(0, CHUNK_SIZE);
          audioBuffer = audioBuffer.subarray(CHUNK_SIZE);

          const rtpPacket = this.createRtpPacket(frame, seqNum, timestamp, ssrc);
          seqNum = (seqNum + 1) & 0xffff;
          timestamp = (timestamp + CHUNK_SIZE) >>> 0;

          try {
            active?.rtpSocket.send(rtpPacket, active.remoteRtpPort, active.remoteIp);
          } catch {}
        }
      });

      audioStream.pipe(ffmpeg.stdin);

      audioStream.on('end', () => {
        try { ffmpeg.stdin.end(); } catch {}
        resolve(true);
      });

      audioStream.on('error', () => {
        try { ffmpeg.kill('SIGKILL'); } catch {}
        resolve(false);
      });

      ffmpeg.on('close', () => {
        resolve(true);
      });
    });
  }
}
