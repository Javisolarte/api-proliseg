import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEntregaInventarioDto, DevolucionInventarioDto, DestruccionInventarioDto } from './dto/entrega-inventario.dto';
import { DocumentosGeneradosService } from '../documentos-generados/documentos-generados.service';
import { EntidadTipo } from '../documentos-generados/dto/documento-generado.dto';

@Injectable()
export class EntregasInventarioService {
    private readonly logger = new Logger(EntregasInventarioService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly documentosService: DocumentosGeneradosService
    ) { }

    /**
     * Sube fotos de evidencia al bucket de Supabase
     */
    private async uploadEvidencePhotos(photosBase64: string[], actaId: number): Promise<string[]> {
        if (!photosBase64 || photosBase64.length === 0) return [];
        
        const urls: string[] = [];
        const bucket = 'evidencias';
        
        for (let i = 0; i < photosBase64.length; i++) {
            const base64 = photosBase64[i];
            if (!base64.startsWith('data:image')) continue;

            try {
                const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (!matches || matches.length !== 3) continue;

                const mimeType = matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                const extension = mimeType.split('/')[1] || 'png';
                const fileName = `entregas/${actaId}/evidencia_${i}_${Date.now()}.${extension}`;

                // Subir al bucket
                await this.supabaseService.uploadFile(bucket, fileName, buffer, mimeType);
                
                // Obtener URL pública (asumiendo que el bucket evidencias es público o accesible vía link)
                // Si el bucket es privado, necesitaríamos generar URLs firmadas cada vez que veamos el acta,
                // pero por simplicidad usaremos la URL pública si el bucket lo permite, o el path.
                const { data } = this.supabaseService.getClient().storage.from(bucket).getPublicUrl(fileName);
                urls.push(data.publicUrl);
            } catch (error) {
                this.logger.error(`Error subiendo foto ${i}: ${error.message}`);
            }
        }
        
        return urls;
    }

    async create(createDto: CreateEntregaInventarioDto, userId: number) {
        const supabase = this.supabaseService.getClient();

        // Obtener datos del empleado que está creando el acta (quien entrega)
        const { data: empleadoCreador } = await supabase
            .from('empleados')
            .select('nombre_completo, firma_digital_base64, cargo_oficial, cedula')
            .eq('usuario_id', userId)
            .single();

        const nombreEntrega = empleadoCreador?.nombre_completo || 'Funcionario Proliseg';
        const firmaEntrega = empleadoCreador?.firma_digital_base64 || null;
        const cargoEntrega = empleadoCreador?.cargo_oficial || 'Funcionario';
        const cedulaEntrega = empleadoCreador?.cedula || '';

        // 1. Procesar fotos (subir al bucket si existen)
        let fotosEvidenciaUrls: string[] = [];
        if (createDto.fotos_evidencia && createDto.fotos_evidencia.length > 0) {
            // Necesitamos un ID temporal o usar el timestamp para la carpeta
            const tempId = Date.now();
            fotosEvidenciaUrls = await this.uploadEvidencePhotos(createDto.fotos_evidencia, tempId);
        }

        // 2. Crear el registro maestro de la entrega
        const codigoActa = `ENT-${Date.now()}`;
        const { data: entrega, error: entregaError } = await supabase
            .from('entregas_inventario')
            .insert({
                codigo_acta: codigoActa,
                tipo_movimiento: 'entrega',
                tipo_destinatario: createDto.tipo_destinatario,
                empleado_id: createDto.empleado_id || null,
                puesto_id: createDto.puesto_id || null,
                cliente_id: createDto.cliente_id || null,
                modalidad_cliente: createDto.modalidad_cliente || null,
                entregado_por: userId,
                observaciones: createDto.observaciones || null,
                estado: 'pendiente_firma',
                firma_entrega: firmaEntrega,
                nombre_entrega: nombreEntrega,
                cargo_entrega: cargoEntrega,
                firma_recibe: createDto.firma_cliente_base64 || null,
                nombre_recibe: createDto.nombre_cliente || null,
                cargo_recibe: createDto.cargo_cliente || null,
                cedula_entrega: cedulaEntrega,
                cedula_recibe: createDto.cedula_recibe || '',
                fotos_evidencia: fotosEvidenciaUrls
            })
            .select()
            .single();

        if (entregaError) throw new BadRequestException(`Error creando entrega: ${entregaError.message}`);

        // 2. Procesar detalles y descontar stock
        for (const detalle of createDto.detalles) {
            // Guardar detalle
            await supabase.from('entregas_inventario_detalles').insert({
                entrega_id: entrega.id,
                variante_id: detalle.variante_id,
                cantidad: detalle.cantidad,
                condicion: detalle.condicion,
                categoria_snapshot_id: detalle.categoria_snapshot_id || null
            });

            // Descontar stock central y registrar movimiento
            const columnaStock = detalle.condicion === 'nuevo' ? 'stock_nuevo' : 'stock_segunda';
            
            // Obtener stock actual
            const { data: variante } = await supabase.from('articulos_dotacion_variantes').select('*').eq('id', detalle.variante_id).single();
            if(!variante || variante[columnaStock] < detalle.cantidad) {
                // Rolback is complex without transactions in pure Supabase API, but this is a simplified approach
                throw new BadRequestException(`Stock insuficiente para la variante ${detalle.variante_id}`);
            }

            // Actualizar stock variantes
            await supabase.rpc('decrementar_stock_variante', { 
                p_variante_id: detalle.variante_id, 
                p_cantidad: detalle.cantidad, 
                p_columna: columnaStock 
            }); // Requiere una función RPC, si no, se hace manual:
            
            await supabase.from('articulos_dotacion_variantes').update({
                [columnaStock]: variante[columnaStock] - detalle.cantidad,
                stock_actual: variante.stock_actual - detalle.cantidad
            }).eq('id', detalle.variante_id);

            // Registrar movimiento global
            await supabase.from('inventario_movimientos').insert({
                variante_id: detalle.variante_id,
                tipo_movimiento: 'salida',
                cantidad: detalle.cantidad,
                motivo: `Entrega acta ${codigoActa}`,
                empleado_id: createDto.empleado_id,
                realizado_por: userId
            });

            // Lógica por Destinatario:
            if (createDto.tipo_destinatario === 'empleado') {
                await supabase.from('dotaciones_empleado').insert({
                    empleado_id: createDto.empleado_id,
                    variante_id: detalle.variante_id,
                    cantidad: detalle.cantidad,
                    entregado_por: userId,
                    condicion: detalle.condicion,
                    observaciones: `Acta ${codigoActa}`
                });
            } else if (createDto.tipo_destinatario === 'puesto') {
                // Add to puesto
                const { data: puestoInv } = await supabase.from('inventario_puesto')
                    .select('*').eq('puesto_id', createDto.puesto_id).eq('variante_articulo_id', detalle.variante_id).single();
                
                if (puestoInv) {
                    await supabase.from('inventario_puesto').update({ cantidad_actual: puestoInv.cantidad_actual + detalle.cantidad }).eq('id', puestoInv.id);
                } else {
                    await supabase.from('inventario_puesto').insert({ puesto_id: createDto.puesto_id, variante_articulo_id: detalle.variante_id, cantidad_actual: detalle.cantidad, condicion: 'bueno' });
                }
            } else if (createDto.tipo_destinatario === 'cliente' && createDto.modalidad_cliente === 'comodato') {
                // Add to cliente
                const { data: cliInv } = await supabase.from('inventario_cliente')
                    .select('*').eq('cliente_id', createDto.cliente_id).eq('variante_articulo_id', detalle.variante_id).single();
                
                if (cliInv) {
                    await supabase.from('inventario_cliente').update({ cantidad_actual: cliInv.cantidad_actual + detalle.cantidad, fecha_ultima_entrega: new Date() }).eq('id', cliInv.id);
                } else {
                    await supabase.from('inventario_cliente').insert({ cliente_id: createDto.cliente_id, variante_articulo_id: detalle.variante_id, cantidad_actual: detalle.cantidad, condicion: detalle.condicion });
                }
            }
        }

        // Generar PDF automáticamente
        const urlPdf = await this.generarActaPdf(entrega.id);

        return {
            ...entrega,
            url_pdf: urlPdf,
            mensaje: 'Entrega registrada exitosamente.'
        };
    }

    async procesarDevolucion(dto: DevolucionInventarioDto, userId: number) {
        const supabase = this.supabaseService.getClient();
        const codigoActa = `DEV-${Date.now()}`;

        // Obtener datos del empleado que está creando el acta (quien RECIBE en una devolución)
        const { data: empleadoCreador } = await supabase
            .from('empleados')
            .select('nombre_completo, firma_digital_base64, cargo_oficial')
            .eq('usuario_id', userId)
            .single();

        const nombreRecibe = empleadoCreador?.nombre_completo || 'Funcionario Proliseg';
        const firmaRecibe = empleadoCreador?.firma_digital_base64 || null;
        const cargoRecibe = empleadoCreador?.cargo_oficial || 'Funcionario';

        // 1. Crear Acta de Recibido (Devolución)
        const { data: devolucion, error: devError } = await supabase.from('entregas_inventario').insert({
            codigo_acta: codigoActa,
            tipo_movimiento: 'devolucion',
            tipo_destinatario: dto.tipo_origen,
            empleado_id: dto.tipo_origen === 'empleado' ? dto.origen_id : null,
            puesto_id: dto.tipo_origen === 'puesto' ? dto.origen_id : null,
            cliente_id: dto.tipo_origen === 'cliente' ? dto.origen_id : null,
            entregado_por: userId,
            observaciones: dto.observaciones,
            estado: 'pendiente_firma',
            firma_recibe: firmaRecibe,
            nombre_recibe: nombreRecibe,
            cargo_recibe: cargoRecibe,
            firma_entrega: dto.firma_cliente_base64 || null,
            nombre_entrega: dto.nombre_cliente || null,
            cargo_entrega: dto.cargo_cliente || null
        }).select().single();

        if(devError) throw new BadRequestException(devError.message);

        for(const det of dto.detalles) {
            // Forzar uniformes (ej. por categoria) a 'segunda' - Para simplificar, forzamos todo lo devuelto a 'segunda' si es que era 'nuevo'
            const condicionFinal = 'segunda'; // Regla de negocio: devuelto -> segunda

            await supabase.from('entregas_inventario_detalles').insert({
                entrega_id: devolucion.id,
                variante_id: det.variante_id,
                cantidad: det.cantidad,
                condicion: condicionFinal
            });

            // Ingresar a inventario central
            const { data: varData } = await supabase.from('articulos_dotacion_variantes').select('*').eq('id', det.variante_id).single();
            if(varData) {
                await supabase.from('articulos_dotacion_variantes').update({
                    stock_segunda: varData.stock_segunda + det.cantidad,
                    stock_actual: varData.stock_actual + det.cantidad
                }).eq('id', det.variante_id);
            }

            // Registrar movimiento global
            await supabase.from('inventario_movimientos').insert({
                variante_id: det.variante_id,
                tipo_movimiento: 'entrada',
                cantidad: det.cantidad,
                motivo: `Devolución acta ${codigoActa} forzado a Segunda`,
                empleado_id: dto.tipo_origen === 'empleado' ? dto.origen_id : null,
                realizado_por: userId
            });

            // Descontar del destinatario respectivo
            if(dto.tipo_origen === 'empleado') {
                 // Simplificado: idealmente descontaríamos el registro exacto de dotaciones_empleado
                 // pero como puede haber varios, solo insertamos un movimiento o restamos logicamente si tuviera contador
            } else if (dto.tipo_origen === 'puesto') {
                const { data: puestoInv } = await supabase.from('inventario_puesto').select('*').eq('puesto_id', dto.origen_id).eq('variante_articulo_id', det.variante_id).single();
                if(puestoInv && puestoInv.cantidad_actual >= det.cantidad) {
                    await supabase.from('inventario_puesto').update({ cantidad_actual: puestoInv.cantidad_actual - det.cantidad }).eq('id', puestoInv.id);
                }
            } else if (dto.tipo_origen === 'cliente') {
                const { data: cliInv } = await supabase.from('inventario_cliente').select('*').eq('cliente_id', dto.origen_id).eq('variante_articulo_id', det.variante_id).single();
                if(cliInv && cliInv.cantidad_actual >= det.cantidad) {
                    await supabase.from('inventario_cliente').update({ cantidad_actual: cliInv.cantidad_actual - det.cantidad }).eq('id', cliInv.id);
                }
            }
        }

        // Generar PDF automáticamente
        const urlPdf = await this.generarActaPdf(devolucion.id);

        return {
            ...devolucion,
            url_pdf: urlPdf,
            mensaje: 'Devolución registrada exitosamente.'
        };
    }

    async procesarDestruccion(dto: DestruccionInventarioDto, userId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Verificar stock
        const columna = dto.condicion === 'nuevo' ? 'stock_nuevo' : 'stock_segunda';
        const { data: variante } = await supabase.from('articulos_dotacion_variantes').select('*').eq('id', dto.variante_id).single();
        
        if(!variante || variante[columna] < dto.cantidad) {
            throw new BadRequestException('Stock insuficiente para la destrucción.');
        }

        // 2. Descontar
        await supabase.from('articulos_dotacion_variantes').update({
            [columna]: variante[columna] - dto.cantidad,
            stock_actual: variante.stock_actual - dto.cantidad
        }).eq('id', dto.variante_id);

        // 3. Registrar movimiento 'destruccion'
        const { data, error } = await supabase.from('inventario_movimientos').insert({
            variante_id: dto.variante_id,
            tipo_movimiento: 'salida',
            cantidad: dto.cantidad,
            motivo: `DESTRUCCIÓN: ${dto.motivo}`,
            realizado_por: userId
        }).select().single();

        if(error) throw new BadRequestException(error.message);
        return data;
    }

    async findAll() {
        const supabase = this.supabaseService.getSupabaseAdminClient();
        const { data, error } = await supabase.from('entregas_inventario').select(`
            *,
            empleado:empleados(id, nombre_completo),
            puesto:puestos_trabajo(id, nombre),
            cliente:clientes(id, nombre_empresa),
            entregado:usuarios_externos(id, nombre_completo),
            detalles:entregas_inventario_detalles(*, variante:articulos_dotacion_variantes(talla, articulo:articulos_dotacion(nombre, codigo)))
        `).order('created_at', { ascending: false });

        if(error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getSupabaseAdminClient();
        const { data, error } = await supabase.from('entregas_inventario').select(`
            *,
            detalles:entregas_inventario_detalles(*),
            cliente:clientes(nombre_empresa),
            puesto:puestos_trabajo(nombre, codigo_puesto, cliente_id),
            empleado:empleados(nombre_completo, cedula, cargo_oficial)
        `).eq('id', id).single();

        if (error) {
            this.logger.error(`Error in findOne(id: ${id}): ${error.message} - ${error.details} - ${error.hint}`);
            throw new NotFoundException('Acta no encontrada');
        }
        return data;
    }

    async findComodatosByCliente(clienteId: number) {
        const supabase = this.supabaseService.getSupabaseAdminClient();
        const { data, error } = await supabase.from('inventario_cliente').select(`
            *,
            variante:articulos_dotacion_variantes(talla, articulo:articulos_dotacion(nombre, codigo, categoria:categorias_dotacion(nombre)))
        `).eq('cliente_id', clienteId).gt('cantidad_actual', 0);

        if(error) throw error;
        return data;
    }
    async generarActaPdf(id: number) {
        try {
            const acta = await this.findOne(id);
            if (!acta) return null;

            const supabase = this.supabaseService.getSupabaseAdminClient();

            // Obtener detalles con info del artículo y categoría
            const { data: detallesCompletos } = await supabase
                .from('entregas_inventario_detalles')
                .select(`
                    *,
                    variante:articulos_dotacion_variantes(
                        talla,
                        articulo:articulos_dotacion(
                            nombre,
                            codigo,
                            descripcion,
                            metadata,
                            categoria:categorias_dotacion(
                                id,
                                nombre,
                                plantilla_acta_id
                            )
                        )
                    )
                `)
                .eq('entrega_id', id);

            // Determinar la plantilla correcta: usar la categoría del primer artículo
            let plantillaId: number | null = null;
            if (detallesCompletos && detallesCompletos.length > 0) {
                const primerCategoria = detallesCompletos[0]?.variante?.articulo?.categoria;
                if (primerCategoria?.plantilla_acta_id) {
                    plantillaId = primerCategoria.plantilla_acta_id;
                }
            }

            // Fallback: buscar SIG-GO-F-19 si no hay plantilla en la categoría
            if (!plantillaId) {
                const { data: plantillaDefault } = await supabase
                    .from('plantillas_documentos')
                    .select('id')
                    .eq('nombre', 'SIG-GO-F-19')
                    .eq('activa', true)
                    .order('version', { ascending: false })
                    .limit(1)
                    .single();

                if (!plantillaDefault) {
                    this.logger.warn("No se encontró plantilla activa SIG-GO-F-19 ni plantilla por categoría");
                    return null;
                }
                plantillaId = plantillaDefault.id;
            }

            // Formatear fechas
            const options: Intl.DateTimeFormatOptions = { 
                timeZone: 'America/Bogota',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            };
            const formatter = new Intl.DateTimeFormat('es-CO', options);
            const dateParts = formatter.formatToParts(new Date(acta.created_at));
            const getPart = (type: string) => dateParts.find(p => p.type === type)?.value;
            const fechaActa = `${getPart('day')}/${getPart('month')}/${getPart('year')} ${getPart('hour')}:${getPart('minute')}`;

            // Determinar entidad id
            let entidadTipo = EntidadTipo.EMPLEADO;
            let entidadId = acta.empleado_id;
            let clienteNombre = 'No aplica';
            let lugarActa = 'No aplica';

            if (acta.tipo_destinatario === 'cliente') {
                entidadTipo = EntidadTipo.CLIENTE;
                entidadId = acta.cliente_id;
                clienteNombre = acta.cliente?.nombre_empresa || 'Cliente sin nombre';
                lugarActa = acta.cliente?.nombre_empresa || 'Sede del cliente';
            } else if (acta.tipo_destinatario === 'puesto') {
                entidadTipo = EntidadTipo.CLIENTE;
                entidadId = acta.puesto?.cliente_id || 0;
                clienteNombre = acta.puesto?.cliente?.nombre_empresa || 'Cliente del puesto';
                lugarActa = acta.puesto?.nombre || 'Sede del puesto';
            } else if (acta.tipo_destinatario === 'empleado') {
                entidadTipo = EntidadTipo.EMPLEADO;
                entidadId = acta.empleado_id;
                clienteNombre = 'Entrega interna (Empleado)';
                lugarActa = acta.empleado?.nombre_completo || 'Sede principal';
            }

            // Formatear items para la tabla usando detalles enriquecidos
            const itemsSource = detallesCompletos || acta.detalles || [];
            const itemsFormatted = itemsSource.map((d: any) => {
                const art = d.variante?.articulo;
                const meta = art?.metadata || {};
                const marca = meta.marca || '';
                const modelo = meta.modelo || '';
                const serial = meta.serial || '';
                const marcaModeloSerial = [marca, modelo, serial].filter(Boolean).join(' / ') || d.variante?.talla || 'N/A';
                const nombre = art?.nombre || 'Artículo sin descripción';
                const codigo = art?.codigo || '';
                const descripcionFull = codigo ? `[${codigo}] ${nombre}` : nombre;

                return {
                    cantidad: d.cantidad,
                    descripcion: descripcionFull,
                    serial: marcaModeloSerial,
                    estado: d.condicion === 'nuevo' ? 'NUEVO' : 'BUENO'
                };
            });

            const ensureBase64Prefix = (signature: string | null) => {
                if (!signature) return null;
                if (signature.startsWith('data:image')) return signature;
                return `data:image/png;base64,${signature}`;
            };

            // Obtener fotos de evidencia (almacenadas en el acta)
            const fotosEvidencia: string[] = (acta as any).fotos_evidencia || [];

            const datos = {
                fecha_acta: fechaActa,
                es_entrega: acta.tipo_movimiento === 'entrega',
                es_devolucion: acta.tipo_movimiento === 'devolucion',
                modalidad: acta.modalidad_cliente ? acta.modalidad_cliente.replace('_', ' ').toUpperCase() : 'NO APLICA',
                es_comodato: acta.modalidad_cliente === 'comodato',
                cliente_nombre: clienteNombre,
                lugar_acta: lugarActa,
                estado_acta: acta.estado ? acta.estado.replace('_', ' ').toUpperCase() : 'COMPLETADA',
                codigo_acta: acta.codigo_acta,
                nombre_entrega: acta.nombre_entrega || 'No especificado',
                cargo_entrega: acta.cargo_entrega || 'No especificado',
                nombre_recibe: acta.nombre_recibe || 'No especificado',
                cargo_recibe: acta.cargo_recibe || 'No especificado',
                id_entrega: acta.cedula_entrega || '',
                id_recibe: acta.cedula_recibe || '',
                items: itemsFormatted,
                observaciones: acta.observaciones || 'Sin observaciones.',
                fotos_evidencia_urls: fotosEvidencia,
                firma_entrega: ensureBase64Prefix(acta.firma_entrega),
                firma_recibe: ensureBase64Prefix(acta.firma_recibe)
            };

            // Crear registro en documentos_generados
            const doc = await this.documentosService.create({
                plantilla_id: Number(plantillaId),
                entidad_tipo: entidadTipo,
                entidad_id: entidadId || 0,
                datos_json: datos
            });

            // Vincular el documento generado con el acta
            await supabase
                .from('entregas_inventario')
                .update({ documento_generado_id: doc.id, estado: 'firmado' })
                .eq('id', id);

            // Firmas para la tabla firmas_documentos
            if (acta.firma_entrega) {
                await supabase.from('firmas_documentos').insert({
                    documento_id: doc.id,
                    nombre_firmante: acta.nombre_entrega || 'Quien entrega',
                    cargo_firmante: acta.cargo_entrega || 'Responsable',
                    firma_base64: acta.firma_entrega,
                    tipo_firma: 'biometrica',
                    orden: 1,
                    firmado_en: new Date().toISOString()
                });
            }

            if (acta.firma_recibe) {
                await supabase.from('firmas_documentos').insert({
                    documento_id: doc.id,
                    nombre_firmante: acta.nombre_recibe || 'Quien recibe',
                    cargo_firmante: acta.cargo_recibe || 'Responsable',
                    firma_base64: acta.firma_recibe,
                    tipo_firma: 'biometrica',
                    orden: 2,
                    es_ultima_firma: true,
                    firmado_en: new Date().toISOString()
                });
            }

            this.logger.log(`📄 Documento acta inventario generado con éxito (Doc ID: ${doc.id})`);

            // Generar PDF usando Puppeteer/API
            try {
                const pdfResult = await this.documentosService.generarPdf(doc.id);
                this.logger.log(`✅ PDF generado para acta ${id}: ${pdfResult?.url_pdf}`);
                return pdfResult?.url_pdf;
            } catch (pdfError) {
                this.logger.error(`⚠️ Error generando PDF real para acta ${id}:`, pdfError);
                return null;
            }

        } catch (error) {
            this.logger.error("Error al generar acta en PDF:", error);
            return null;
        }
    }
}
