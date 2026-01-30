import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { OnEvent } from '@nestjs/event-emitter';
import axios from 'axios';

@Injectable()
export class WebhooksService {
    private readonly logger = new Logger(WebhooksService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Suscribe un nuevo webhook
     */
    async subscribe(puesto_id: number | null, url: string, events: string[], secret?: string) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('webhook_subscriptions')
            .insert({
                puesto_id,
                url,
                events,
                secret,
                activo: true
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Escucha eventos internos del sistema y dispara webhooks
     */
    @OnEvent('**') // Escucha todos los eventos
    async handleEvents(payload: any, eventName: string) {
        this.logger.debug(`Evento detectado para webhook: ${eventName}`);

        // Buscar suscripciones activas para este evento
        const supabase = this.supabaseService.getClient();
        const { data: subscriptions, error } = await supabase
            .from('webhook_subscriptions')
            .select('*')
            .eq('activo', true)
            .contains('events', [eventName]);

        if (error || !subscriptions) return;

        for (const sub of subscriptions) {
            if (this.validateContract(eventName, payload)) {
                this.dispatchWebhook(sub, eventName, payload);
            } else {
                this.logger.warn(`Evento ${eventName} rechazado por falla de contrato de datos`);
            }
        }
    }

    /**
     * Validación de Contrato (Pact-like simple)
     * Asegura que el payload tenga la estructura esperada para el evento
     */
    private validateContract(event: string, payload: any): boolean {
        // Ejemplo de validación básica por evento
        if (event.startsWith('incidente.')) {
            return !!payload.id && !!payload.puesto_id && !!payload.tipo;
        }
        if (event.startsWith('ronda.')) {
            return !!payload.id && !!payload.estado;
        }
        return true; // Fallback para otros eventos
    }

    private async dispatchWebhook(sub: any, event: string, payload: any) {
        const MAX_RETRIES = 3;
        const INITIAL_DELAY = 1000; // 1 segundo

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                this.logger.log(`Disparando webhook a ${sub.url} para evento ${event} (Intento ${attempt})`);

                await axios.post(sub.url, {
                    event,
                    timestamp: new Date().toISOString(),
                    payload,
                }, {
                    headers: {
                        'X-Webhook-Secret': sub.secret || '',
                        'Content-Type': 'application/json',
                    },
                    timeout: 5000,
                });

                this.logger.log(`Webhook enviado con éxito a ${sub.url}`);
                return; // Éxito, salir del loop
            } catch (error) {
                this.logger.error(`Fallo intento ${attempt} para ${sub.url}: ${error.message}`);

                if (attempt === MAX_RETRIES) {
                    this.logger.error(`Webhook a ${sub.url} falló definitivamente tras ${MAX_RETRIES} intentos`);
                    // Aquí podrías persistir en tabla de logs de errores
                } else {
                    const delay = INITIAL_DELAY * Math.pow(2, attempt - 1);
                    this.logger.warn(`Reintentando en ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
    }
}
