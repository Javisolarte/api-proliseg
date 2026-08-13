import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { SystemLoggerService } from './system-logger.service';

export interface ServidorInternetStatus {
  id: number;
  nombre: string;
  ip_publica: string;
  puerto_rest: number;
  online: boolean;
  tiene_internet: boolean;
  latencia_ms: number | null;
  download_mbps: number | null;
  upload_mbps: number | null;
  uptime: string | null;
  cpu_load: number | null;
  memoria_usada_mb: number | null;
  memoria_total_mb: number | null;
  interfaz_wan: string | null;
  error?: string;
}

@Injectable()
export class MikrotikInternetService {
  private readonly logger = new Logger(MikrotikInternetService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly sysLogger: SystemLoggerService,
  ) {}

  /**
   * Obtiene el estado de internet de todos los servidores MikroTik registrados
   */
  async checkAllServersInternet(): Promise<ServidorInternetStatus[]> {
    const servidores = await this.getServidoresMikrotik();

    if (!servidores || servidores.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      servidores.map((s) => this.checkServerInternet(s)),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const s = servidores[index];
      return {
        id: s.id,
        nombre: s.nombre,
        ip_publica: s.ip_publica,
        puerto_rest: s.puerto_rest,
        online: false,
        tiene_internet: false,
        latencia_ms: null,
        download_mbps: null,
        upload_mbps: null,
        uptime: null,
        cpu_load: null,
        memoria_usada_mb: null,
        memoria_total_mb: null,
        interfaz_wan: null,
        error: result.reason?.message || 'Error desconocido',
      };
    });
  }

  /**
   * Verifica el estado de internet de un servidor MikroTik específico
   */
  private async checkServerInternet(servidor: any): Promise<ServidorInternetStatus> {
    const { id, nombre, ip_publica, puerto_rest, usuario, password } = servidor;
    const user = usuario || 'admin';
    const pass = password || '';

    // Ports to attempt: configured port first, then default 4433, 80, 443, 8080
    const portsToTry = Array.from(new Set([
      puerto_rest ? Number(puerto_rest) : null,
      4433,
      80,
      443,
      8080
    ].filter((p): p is number => p != null && p > 0)));

    const baseResult: ServidorInternetStatus = {
      id,
      nombre,
      ip_publica,
      puerto_rest: Number(puerto_rest || portsToTry[0] || 80),
      online: false,
      tiene_internet: false,
      latencia_ms: null,
      download_mbps: null,
      upload_mbps: null,
      uptime: null,
      cpu_load: null,
      memoria_usada_mb: null,
      memoria_total_mb: null,
      interfaz_wan: null,
    };

    const httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });
    const protocols = ['https', 'http'];

    for (const port of portsToTry) {
      for (const protocol of protocols) {
        const baseUrl = `${protocol}://${ip_publica}:${port}/rest`;

        try {
          // 1. Verificar que el MikroTik está accesible con system/resource
          const resourceResponse = await axios.get(`${baseUrl}/system/resource`, {
            auth: { username: user, password: pass },
            httpsAgent,
            timeout: 7000,
            headers: { 'User-Agent': 'curl/7.74.0', Accept: '*/*' },
          });

        const resource = resourceResponse.data;
        baseResult.online = true;
        baseResult.uptime = resource.uptime || null;
        baseResult.cpu_load = resource['cpu-load'] != null ? Number(resource['cpu-load']) : null;

        // Calcular memoria
        const totalMem = resource['total-memory'] ? Number(resource['total-memory']) : null;
        const freeMem = resource['free-memory'] ? Number(resource['free-memory']) : null;
        if (totalMem != null) {
          baseResult.memoria_total_mb = Math.round(totalMem / 1024 / 1024);
          if (freeMem != null) {
            baseResult.memoria_usada_mb = Math.round((totalMem - freeMem) / 1024 / 1024);
          }
        }

        this.logger.log(`✅ [INTERNET-CHECK] ${nombre} (${ip_publica}) — MikroTik accesible. Uptime: ${resource.uptime}`);

        // 2. Hacer ping a 8.8.8.8 para verificar internet y obtener latencia
        try {
          const pingResponse = await axios.post(
            `${baseUrl}/ping`,
            { address: '8.8.8.8', count: '3' },
            {
              auth: { username: user, password: pass },
              httpsAgent,
              timeout: 15000,
              headers: { 'User-Agent': 'curl/7.74.0', Accept: '*/*' },
            },
          );

          const pingResults = Array.isArray(pingResponse.data) ? pingResponse.data : [pingResponse.data];
          // Filter out summary entries, keep only actual ping results with time
          const pingEntries = pingResults.filter((p: any) => p.time != null && p.time !== '');

          if (pingEntries.length > 0) {
            baseResult.tiene_internet = true;
            // Extraer latencia promedio
            const latencies = pingEntries.map((p: any) => {
              const timeStr = String(p.time || '0');
              // MikroTik returns time like "12ms" or "12"
              return parseFloat(timeStr.replace('ms', '').trim());
            }).filter((l: number) => !isNaN(l) && l > 0);

            if (latencies.length > 0) {
              baseResult.latencia_ms = Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length);
            }
          } else {
            // Ping returned but no responses — no internet
            baseResult.tiene_internet = false;
          }
        } catch (pingErr) {
          this.logger.warn(`⚠️ [INTERNET-CHECK] ${nombre} — Ping falló: ${pingErr.message}`);
          baseResult.tiene_internet = false;
        }

        // 3. Obtener interfaces para velocidad tx/rx
        try {
          const ifaceResponse = await axios.get(`${baseUrl}/interface`, {
            auth: { username: user, password: pass },
            httpsAgent,
            timeout: 8000,
            headers: { 'User-Agent': 'curl/7.74.0', Accept: '*/*' },
          });

          const interfaces = ifaceResponse.data || [];
          // Buscar la interfaz WAN (ether1, pppoe-out1, o la que tenga más tráfico)
          const wanCandidates = interfaces.filter((iface: any) => {
            const name = (iface.name || '').toLowerCase();
            return (
              name === 'ether1' ||
              name.includes('wan') ||
              name.includes('pppoe') ||
              name.includes('lte') ||
              name.includes('wlan1')
            );
          });

          // Si no hay candidatos WAN, usar la interfaz con más tx-byte
          let wanInterface = wanCandidates.length > 0
            ? wanCandidates[0]
            : interfaces.sort((a: any, b: any) => Number(b['tx-byte'] || 0) - Number(a['tx-byte'] || 0))[0];

          if (wanInterface) {
            baseResult.interfaz_wan = wanInterface.name;

            // Obtener tasa actual de la interfaz: tx-byte y rx-byte son acumulados
            // Usaremos la API de monitor traffic para velocidad real
            try {
              const monitorResponse = await axios.post(
                `${baseUrl}/interface/monitor-traffic`,
                { interface: wanInterface.name, duration: '2s' },
                {
                  auth: { username: user, password: pass },
                  httpsAgent,
                  timeout: 10000,
                  headers: { 'User-Agent': 'curl/7.74.0', Accept: '*/*' },
                },
              );

              const monitorData = Array.isArray(monitorResponse.data)
                ? monitorResponse.data
                : [monitorResponse.data];
              
              // Tomar el último resultado de monitoreo
              const lastSample = monitorData[monitorData.length - 1];
              if (lastSample) {
                // rx-bits-per-second y tx-bits-per-second
                const rxBps = Number(lastSample['rx-bits-per-second'] || 0);
                const txBps = Number(lastSample['tx-bits-per-second'] || 0);
                baseResult.download_mbps = Math.round((rxBps / 1_000_000) * 100) / 100;
                baseResult.upload_mbps = Math.round((txBps / 1_000_000) * 100) / 100;
              }
            } catch (monitorErr) {
              this.logger.warn(`⚠️ [INTERNET-CHECK] ${nombre} — Monitor traffic falló: ${monitorErr.message}. Calculando desde bytes acumulados.`);
              
              // Fallback: calcular desde running rate si está disponible
              const rxByte = Number(wanInterface['rx-byte'] || 0);
              const txByte = Number(wanInterface['tx-byte'] || 0);
              if (rxByte > 0 || txByte > 0) {
                // No podemos calcular velocidad real sin delta, pero podemos mostrar los acumulados
                // como indicador de que hay tráfico
                baseResult.download_mbps = null;
                baseResult.upload_mbps = null;
              }
            }
          }
        } catch (ifaceErr) {
          this.logger.warn(`⚠️ [INTERNET-CHECK] ${nombre} — No se pudo obtener interfaces: ${ifaceErr.message}`);
        }

        return baseResult;

      } catch (err) {
        this.logger.warn(`⚠️ [INTERNET-CHECK] ${nombre} (${protocol}://${ip_publica}:${port}) — Error: ${err.message}`);
        continue;
      }
    } // end protocols loop
    } // end ports loop

    // Si llegamos aquí, ningún puerto o protocolo funcionó
    baseResult.error = 'No se pudo conectar al servidor MikroTik (todos los puertos REST probados)';
    return baseResult;
  }

  /**
   * Obtiene la lista de servidores MikroTik registrados en la base de datos
   */
  private async getServidoresMikrotik(): Promise<any[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_servidores_mikrotik')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      this.logger.error(`❌ [INTERNET-CHECK] Error al obtener servidores MikroTik: ${error.message}`);
      return [];
    }

    return data || [];
  }
}
