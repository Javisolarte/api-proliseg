import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CrearPoliticaDto, RegistrarConsentimientoDto } from './dto/politicas.dto';
import { ComplianceService } from '../compliance/compliance.service';
import { IntegrityService } from '../../common/services/integrity.service';
import * as crypto from 'crypto';

type SujetoLegal = {
    id: number;
    empleadoId?: number | null;
    empleado_id?: number | null;
    cliente_id?: number | null;
    rol?: string;
    nombre_completo?: string;
    cedula?: string;
    correo?: string;
    email?: string;
    user_id?: string;
};

type RequestMetadata = {
    ip?: string;
    ua?: string;
    sessionId?: string | null;
};

@Injectable()
export class PoliticasService {
    private readonly logger = new Logger(PoliticasService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly complianceService: ComplianceService,
        private readonly integrityService: IntegrityService,
    ) { }

    async obtenerPoliticaVigente(codigo: string = 'POLITICA_TRATAMIENTO_DATOS') {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('politicas')
            .select('*')
            .eq('codigo', codigo)
            .eq('vigente', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) {
            this.logger.warn(`No se encontro politica vigente para codigo: ${codigo}`);
            return null;
        }

        const paginas = await this.obtenerPaginasPolitica(data.id);
        const hashDocumento = data.hash_contenido || this.calcularHashDocumento(data, paginas);

        return {
            ...data,
            paginas,
            paginas_total: data.paginas_total || paginas.length || 1,
            hash_contenido: hashDocumento,
        };
    }

    async verificarConsentimiento(sujeto: SujetoLegal, codigoPolitica: string = 'POLITICA_TRATAMIENTO_DATOS') {
        const politica = await this.obtenerPoliticaVigente(codigoPolitica);
        if (!politica) {
            return {
                requiere_aceptacion: false,
                puede_continuar: true,
                mensaje: 'No hay politica vigente',
            };
        }

        const sujetoLegal = this.normalizarSujeto(sujeto);
        const supabase = this.supabaseService.getClient();
        const { data, error } = await this.aplicarFiltroSujeto(
            supabase
                .from('consentimientos')
                .select('*')
                .eq('politica_id', politica.id)
                .eq('aceptado', true)
                .eq('revocado', false),
            sujetoLegal,
        )
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            this.logger.warn(`Error verificando consentimiento: ${error.message}`);
        }

        if (data) {
            return {
                requiere_aceptacion: false,
                puede_continuar: true,
                consentimiento: data,
                politica: this.toPoliticaResumen(politica),
            };
        }

        return {
            requiere_aceptacion: politica.requiere_aceptacion !== false,
            puede_continuar: politica.bloquea_si_no_acepta === false,
            bloquea_continuacion: politica.bloquea_si_no_acepta !== false,
            politica_pendiente: this.toPoliticaPublica(politica),
        };
    }

    async obtenerEstadoInicial(sujeto: SujetoLegal) {
        const pendientes = await this.obtenerPendientes(sujeto);
        const bloqueaContinuacion = pendientes.some((politica) => politica.bloquea_si_no_acepta !== false);

        return {
            requiere_modal: pendientes.length > 0,
            total_pendientes: pendientes.length,
            bloquea_continuacion: bloqueaContinuacion,
            puede_continuar: pendientes.length === 0 || !bloqueaContinuacion,
            pendientes,
        };
    }

    async obtenerPoliticasVigentesPublicas() {
        const supabase = this.supabaseService.getClient();
        const { data: politicas, error } = await supabase
            .from('politicas')
            .select('*')
            .eq('vigente', true)
            .order('tipo_documento', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw new BadRequestException('Error consultando politicas vigentes');
        if (!politicas?.length) return [];

        const documentos: any[] = [];
        for (const politica of politicas) {
            const paginas = await this.obtenerPaginasPolitica(politica.id);
            const hashDocumento = politica.hash_contenido || this.calcularHashDocumento(politica, paginas);
            documentos.push(this.toPoliticaPublica({
                ...politica,
                paginas,
                paginas_total: politica.paginas_total || paginas.length || 1,
                hash_contenido: hashDocumento,
            }));
        }

        return documentos;
    }

    async registrarConsentimiento(
        sujeto: SujetoLegal,
        dto: RegistrarConsentimientoDto,
        metadata: RequestMetadata,
    ) {
        const supabase = this.supabaseService.getClient();
        const sujetoLegal = this.normalizarSujeto(sujeto);

        const { data: politica, error: politicaError } = await supabase
            .from('politicas')
            .select('*')
            .eq('id', dto.politica_id)
            .maybeSingle();

        if (politicaError || !politica) {
            throw new NotFoundException('Politica no encontrada');
        }

        if (politica.vigente === false) {
            throw new BadRequestException('Solo se puede aceptar o rechazar la version vigente de la politica');
        }

        const paginas = await this.obtenerPaginasPolitica(politica.id);
        const documentoHash = politica.hash_contenido || this.calcularHashDocumento(politica, paginas);

        if (dto.aceptado) {
            const { data: consentimientoVigente } = await this.aplicarFiltroSujeto(
                supabase
                    .from('consentimientos')
                    .select('*')
                    .eq('politica_id', politica.id)
                    .eq('aceptado', true)
                    .eq('revocado', false),
                sujetoLegal,
            )
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (consentimientoVigente) {
                return {
                    ya_registrado: true,
                    puede_continuar: true,
                    consentimiento: consentimientoVigente,
                };
            }
        }

        const timestamp = new Date().toISOString();
        const evidencia = {
            politica_id: politica.id,
            politica_codigo: politica.codigo,
            politica_version: politica.version,
            documento_hash: documentoHash,
            aceptado: dto.aceptado,
            usuario_id: sujetoLegal.usuarioId,
            empleado_id: sujetoLegal.empleadoId,
            cliente_id: sujetoLegal.clienteId,
            tipo_titular: sujetoLegal.tipoTitular,
            titular_id: sujetoLegal.titularId,
            titular_nombre: sujetoLegal.nombre,
            titular_documento: sujetoLegal.documento,
            fecha_decision: timestamp,
            ip_address: metadata.ip || null,
            user_agent: metadata.ua || null,
            metodo_firma: dto.metodo_firma || 'clickwrap',
            tiempo_lectura_segundos: dto.tiempo_lectura_segundos || 0,
            pantalla_origen: dto.pantalla_origen || 'prolicontrol',
        };
        const firmaHash = this.integrityService.generateHash(evidencia);
        const bloqueaContinuacion = !dto.aceptado && politica.bloquea_si_no_acepta !== false;

        const dataToSave: Record<string, unknown> = {
            usuario_id: sujetoLegal.usuarioId,
            empleado_id: sujetoLegal.empleadoId,
            politica_id: dto.politica_id,
            aceptado: dto.aceptado,
            ip_address: metadata.ip || null,
            user_agent: metadata.ua || null,
            firmado_hash: firmaHash,
            tipo_titular: sujetoLegal.tipoTitular,
            titular_id: sujetoLegal.titularId,
            politica_codigo: politica.codigo,
            politica_version: politica.version,
            documento_hash: documentoHash,
            fecha_decision: timestamp,
            fecha_visualizacion: timestamp,
            firma_electronica: true,
            metodo_firma: dto.metodo_firma || 'clickwrap',
            decision_expresa: true,
            bloquea_continuacion: bloqueaContinuacion,
            rechazo_motivo: dto.rechazo_motivo || null,
            sesion_id: metadata.sessionId || null,
            metadatos: {
                ...(dto.metadatos || {}),
                evidencia_legal: evidencia,
                paginas_total: politica.paginas_total || paginas.length || 1,
            },
            created_at: timestamp,
        };

        const { data, error } = await supabase
            .from('consentimientos')
            .insert(dataToSave)
            .select()
            .single();

        if (error) {
            this.logger.error(`Error guardando consentimiento: ${error.message}`);
            throw new InternalServerErrorException('Error al registrar consentimiento');
        }

        await this.registrarAuditoriaConsentimiento({
            consentimiento_id: data.id,
            usuario_id: sujetoLegal.usuarioId,
            empleado_id: sujetoLegal.empleadoId,
            politica_id: politica.id,
            evento: dto.aceptado ? 'ACEPTADO' : 'RECHAZADO',
            ip_address: metadata.ip || null,
            user_agent: metadata.ua || null,
            documento_hash: documentoHash,
            firmado_hash: firmaHash,
            detalles: {
                politica_codigo: politica.codigo,
                politica_version: politica.version,
                tipo_titular: sujetoLegal.tipoTitular,
                titular_id: sujetoLegal.titularId,
                rechazo_motivo: dto.rechazo_motivo || null,
            },
        });

        await this.complianceService.logLegalAction({
            usuario_id: sujetoLegal.usuarioId,
            entidad: 'consentimientos',
            entidad_id: String(data.id),
            accion: dto.aceptado ? 'ACCEPT' : 'REJECT',
            ip: metadata.ip,
            user_agent: metadata.ua,
            detalles: {
                politica_id: politica.id,
                politica_codigo: politica.codigo,
                politica_version: politica.version,
                documento_hash: documentoHash,
                bloquea_continuacion: bloqueaContinuacion,
            },
        });

        this.logger.log(`Consentimiento ${dto.aceptado ? 'aceptado' : 'rechazado'}: usuario ${sujetoLegal.usuarioId} - politica ${dto.politica_id}`);

        return {
            consentimiento: data,
            politica: this.toPoliticaResumen({ ...politica, hash_contenido: documentoHash, paginas_total: paginas.length }),
            aceptado: dto.aceptado,
            puede_continuar: !bloqueaContinuacion,
            bloquea_continuacion: bloqueaContinuacion,
            mensaje: dto.aceptado
                ? 'Autorizacion registrada correctamente'
                : 'No puede continuar el proceso sin aceptar esta politica',
        };
    }

    async crearNuevaVersion(dto: CrearPoliticaDto, usuarioId?: number) {
        const supabase = this.supabaseService.getClient();
        const paginas = dto.paginas || [];
        const hashContenido = this.calcularHashDocumento(
            {
                codigo: dto.codigo,
                version: dto.version,
                contenido: dto.contenido,
            },
            paginas,
        );

        await supabase
            .from('politicas')
            .update({ vigente: false })
            .eq('codigo', dto.codigo);

        const { data, error } = await supabase
            .from('politicas')
            .insert({
                codigo: dto.codigo,
                nombre: dto.nombre,
                version: dto.version,
                contenido: dto.contenido,
                tipo_documento: dto.tipo_documento || 'politica_tratamiento_datos',
                resumen: dto.resumen || null,
                requiere_aceptacion: dto.requiere_aceptacion ?? true,
                bloquea_si_no_acepta: dto.bloquea_si_no_acepta ?? true,
                paginas_total: paginas.length || 1,
                hash_contenido: hashContenido,
                metadatos: dto.metadatos || {},
                vigente: true,
                fecha_vigencia: new Date().toISOString(),
                publicado_en: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);

        if (paginas.length > 0) {
            const paginasToSave = paginas.map((pagina) => ({
                politica_id: data.id,
                numero_pagina: pagina.numero_pagina,
                titulo: pagina.titulo,
                contenido: pagina.contenido,
                hash_integridad: this.integrityService.generateHash({
                    politica_id: data.id,
                    numero_pagina: pagina.numero_pagina,
                    titulo: pagina.titulo,
                    contenido: pagina.contenido,
                }),
            }));
            const { error: paginasError } = await supabase.from('politicas_paginas').insert(paginasToSave);
            if (paginasError) throw new BadRequestException(paginasError.message);
        }

        if (usuarioId) {
            await this.complianceService.logLegalAction({
                usuario_id: usuarioId,
                entidad: 'politicas',
                entidad_id: String(data.id),
                accion: 'CREATE_VERSION',
                detalles: {
                    codigo: dto.codigo,
                    version: dto.version,
                    hash_contenido: hashContenido,
                },
            });
        }

        return {
            ...data,
            paginas,
            hash_contenido: hashContenido,
        };
    }

    async obtenerPendientes(sujeto: SujetoLegal) {
        const supabase = this.supabaseService.getClient();

        const { data: politicas, error } = await supabase
            .from('politicas')
            .select('*')
            .eq('vigente', true)
            .order('created_at', { ascending: true });

        if (error) throw new BadRequestException('Error consultando politicas vigentes');
        if (!politicas?.length) return [];

        const pendientes: any[] = [];
        for (const politica of politicas.filter((item) => item.requiere_aceptacion !== false)) {
            const estado = await this.verificarConsentimiento(sujeto, politica.codigo);
            if (estado.requiere_aceptacion && estado.politica_pendiente) {
                pendientes.push(estado.politica_pendiente);
            }
        }

        return pendientes;
    }

    async revocarConsentimiento(sujeto: SujetoLegal, politicaId: number, motivo: string, metadata?: RequestMetadata) {
        const supabase = this.supabaseService.getClient();
        const sujetoLegal = this.normalizarSujeto(sujeto);

        const { data: actual, error: findError } = await this.aplicarFiltroSujeto(
            supabase
                .from('consentimientos')
                .select('*')
                .eq('politica_id', politicaId)
                .eq('revocado', false),
            sujetoLegal,
        )
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (findError || !actual) {
            throw new NotFoundException('Consentimiento no encontrado');
        }

        const timestamp = new Date().toISOString();
        const { data, error } = await supabase
            .from('consentimientos')
            .update({
                revocado: true,
                fecha_revocacion: timestamp,
                metadatos: {
                    ...(actual.metadatos || {}),
                    motivo_revocacion: motivo,
                    fecha_revocacion: timestamp,
                },
            })
            .eq('id', actual.id)
            .select()
            .single();

        if (error) throw new BadRequestException('Error al revocar consentimiento');

        await this.registrarAuditoriaConsentimiento({
            consentimiento_id: actual.id,
            usuario_id: sujetoLegal.usuarioId,
            empleado_id: sujetoLegal.empleadoId,
            politica_id: politicaId,
            evento: 'REVOCADO',
            ip_address: metadata?.ip || null,
            user_agent: metadata?.ua || null,
            documento_hash: actual.documento_hash || null,
            firmado_hash: actual.firmado_hash || null,
            detalles: { motivo },
        });

        await this.complianceService.logLegalAction({
            usuario_id: sujetoLegal.usuarioId,
            entidad: 'consentimientos',
            entidad_id: String(actual.id),
            accion: 'REVOKE',
            ip: metadata?.ip,
            user_agent: metadata?.ua,
            detalles: { politica_id: politicaId, motivo },
        });

        return data;
    }

    private async obtenerPaginasPolitica(politicaId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('politicas_paginas')
            .select('numero_pagina,titulo,contenido,hash_integridad')
            .eq('politica_id', politicaId)
            .order('numero_pagina', { ascending: true });

        if (error) {
            this.logger.warn(`No se pudieron obtener paginas de politica ${politicaId}: ${error.message}`);
            return [];
        }

        return data || [];
    }

    private async registrarAuditoriaConsentimiento(payload: Record<string, unknown>) {
        const supabase = this.supabaseService.getClient();
        const hashIntegridad = this.integrityService.generateHash(payload);
        const { error } = await supabase.from('consentimientos_auditoria').insert({
            ...payload,
            hash_integridad: hashIntegridad,
        });

        if (error) {
            this.logger.error(`Error auditando consentimiento: ${error.message}`);
            throw new InternalServerErrorException('No se pudo auditar la decision legal');
        }
    }

    private normalizarSujeto(sujeto: SujetoLegal) {
        if (!sujeto?.id) throw new BadRequestException('Usuario no valido para consentimiento legal');

        const empleadoId = sujeto.empleadoId ?? sujeto.empleado_id ?? null;
        const clienteId = sujeto.cliente_id ?? null;
        const rol = (sujeto.rol || '').toLowerCase();
        const tipoTitular = rol.includes('cliente') ? 'cliente' : empleadoId ? 'empleado' : 'usuario';
        const titularId = String(clienteId || empleadoId || sujeto.id);

        return {
            usuarioId: sujeto.id,
            empleadoId,
            clienteId,
            tipoTitular,
            titularId,
            nombre: sujeto.nombre_completo || null,
            documento: sujeto.cedula || null,
            correo: sujeto.correo || sujeto.email || null,
            userId: sujeto.user_id || null,
        };
    }

    private aplicarFiltroSujeto(query: any, sujetoLegal: ReturnType<PoliticasService['normalizarSujeto']>) {
        const filtros = [`usuario_id.eq.${sujetoLegal.usuarioId}`];
        if (sujetoLegal.empleadoId) filtros.push(`empleado_id.eq.${sujetoLegal.empleadoId}`);
        return query.or(filtros.join(','));
    }

    private calcularHashDocumento(politica: any, paginas: any[] = []) {
        const dataString = JSON.stringify({
            codigo: politica.codigo,
            version: politica.version,
            contenido: politica.contenido,
            paginas: paginas.map((pagina) => ({
                numero_pagina: pagina.numero_pagina,
                titulo: pagina.titulo,
                contenido: pagina.contenido,
            })),
        });

        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    private toPoliticaResumen(politica: any) {
        return {
            id: politica.id,
            codigo: politica.codigo,
            nombre: politica.nombre,
            version: politica.version,
            tipo_documento: politica.tipo_documento,
            paginas_total: politica.paginas_total || 1,
            hash_contenido: politica.hash_contenido,
            fecha_vigencia: politica.fecha_vigencia,
        };
    }

    private toPoliticaPublica(politica: any) {
        return {
            ...this.toPoliticaResumen(politica),
            resumen: politica.resumen,
            contenido: politica.contenido,
            paginas: politica.paginas || [],
            requiere_aceptacion: politica.requiere_aceptacion !== false,
            bloquea_si_no_acepta: politica.bloquea_si_no_acepta !== false,
            aviso_privacidad: politica.aviso_privacidad,
            finalidad_principal: politica.finalidad_principal,
        };
    }
}
