import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ControlAccesoService } from './control-acceso.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import axios from 'axios';

@ApiTags('Residentes App')
@ApiBearerAuth('JWT-auth')
@Controller('residentes-app')
export class ResidentesAppController {
  private readonly logger = new Logger(ResidentesAppController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly controlAccesoService: ControlAccesoService,
  ) {}

  private async getResidentFromUser(user: any) {
    const admin = this.supabaseService.getSupabaseAdminClient();
    const { data: resident, error } = await admin
      .from('residentes')
      .select('*')
      .eq('usuario_id', user.id)
      .maybeSingle();

    if (error || !resident) {
      throw new NotFoundException('Perfil de residente no encontrado o no vinculado');
    }
    return resident;
  }

  @Get('perfil')
  @ApiOperation({ summary: 'Obtener datos del apartamento, torre y perfil del residente logueado' })
  async getPerfil(@CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    // Consultar si tiene vehículo
    const { data: recopilacionReg } = await admin
      .from('control_acceso_recoleccion_registros')
      .select('tiene_vehiculo, placa_vehiculo')
      .eq('cedula', resident.documento)
      .maybeSingle();

    const { data: vehiculoReg } = await admin
      .from('vehiculos')
      .select('id')
      .eq('tarjeta_propietario', resident.documento)
      .limit(1);

    const tieneVehiculo = 
      !!recopilacionReg?.tiene_vehiculo || 
      !!recopilacionReg?.placa_vehiculo || 
      (vehiculoReg && vehiculoReg.length > 0);

    return {
      ok: true,
      residente: {
        ...resident,
        tiene_vehiculo: tieneVehiculo,
        placa_vehiculo: recopilacionReg?.placa_vehiculo || null
      },
      usuario: user,
    };
  }

  @Get('visitas')
  @ApiOperation({ summary: 'Obtener historial de visitas programadas por el residente desde visitas_acceso' })
  async getVisitas(@CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    let { data: persona } = await admin
      .from('personas_gestion_acceso')
      .select('id')
      .eq('entidad_tipo', 'residente')
      .eq('entidad_id', resident.id)
      .maybeSingle();

    if (!persona && resident.documento) {
      const { data: pByDoc } = await admin
        .from('personas_gestion_acceso')
        .select('id')
        .eq('documento_identidad', resident.documento)
        .maybeSingle();
      persona = pByDoc;
    }

    let query = admin
      .from('visitas_acceso')
      .select('*')
      .order('fecha_programada', { ascending: false });

    if (persona) {
      query = query.or(`residente_responsable_id.eq.${persona.id},residente_responsable_nombre.eq."${resident.nombre_completo}"`);
    } else {
      query = query.eq('residente_responsable_nombre', resident.nombre_completo);
    }

    const { data: visitas, error } = await query;
    if (error) {
      throw new BadRequestException(`Error al obtener visitas: ${error.message}`);
    }

    // Adaptar campos para compatibilidad con la app Flutter
    return (visitas || []).map(v => ({
      ...v,
      nombre_visitante_temporal: v.nombre_visitante,
      fecha_esperada: v.fecha_programada,
      observaciones: v.motivo,
    }));
  }

  @Post('visitas')
  @ApiOperation({ summary: 'Crear una visita en visitas_acceso y registrar en hardware' })
  async crearVisita(
    @Body() body: {
      nombre_visitante: string;
      documento_visitante?: string;
      telefono_visitante?: string;
      motivo?: string;
      fecha_programada?: string;
      fecha_esperada?: string; // fallback
      observacion?: string; // fallback
      dispositivo_id?: string;
      duracion_horas?: number;
    },
    @CurrentUser() user: any
  ) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    const nombreVisitante = body.nombre_visitante;
    if (!nombreVisitante) {
      throw new BadRequestException('El nombre del visitante es obligatorio');
    }

    const documentoVisitante = body.documento_visitante || '';
    const telefonoVisitante = body.telefono_visitante || null;
    const motivo = body.motivo || body.observacion || 'Visita programada';
    const fechaProgramada = body.fecha_programada || body.fecha_esperada || new Date().toISOString();
    const duracionHoras = body.duracion_horas || 2;

    let { data: persona } = await admin
      .from('personas_gestion_acceso')
      .select('id')
      .eq('entidad_tipo', 'residente')
      .eq('entidad_id', resident.id)
      .maybeSingle();

    if (!persona && resident.documento) {
      const { data: pByDoc } = await admin
        .from('personas_gestion_acceso')
        .select('id')
        .eq('documento_identidad', resident.documento)
        .maybeSingle();
      persona = pByDoc;
    }

    let dispositivoId = body.dispositivo_id;
    if (!dispositivoId) {
      // Intentar obtener el primer dispositivo permitido para el residente
      let permittedDeviceIds: string[] = [];
      if (persona) {
        const { data: permisos } = await admin
          .from('acceso_permisos_dispositivos')
          .select('dispositivo_id')
          .eq('persona_id', persona.id)
          .eq('activo', true);

        if (permisos && permisos.length > 0) {
          permittedDeviceIds = permisos.map(p => p.dispositivo_id);
        }
      }

      if (permittedDeviceIds.length > 0) {
        dispositivoId = permittedDeviceIds[0];
      } else {
        // Fallback por puesto_id
        const { data: devices } = await admin
          .from('dispositivos_iot')
          .select('id')
          .eq('puesto_id', resident.puesto_id)
          .eq('estado', 'operativo');

        if (devices && devices.length > 0) {
          dispositivoId = devices[0].id;
        }
      }
    }

    // Auto-completar destino (apto/local y torre) si está registrado
    const apto = resident.apto_casa || '';
    const torre = resident.torre_bloque || '';
    const destinoInfo = [
      torre ? `Torre ${torre}` : '',
      apto ? `Apto/Local ${apto}` : ''
    ].filter(Boolean).join(' - ');

    const finalMotivo = destinoInfo 
      ? `${motivo} (Destino: ${destinoInfo})`
      : motivo;

    const token = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const fechaVencimiento = new Date(new Date(fechaProgramada).getTime() + duracionHoras * 60 * 60 * 1000).toISOString();

    const payload = {
      nombre_visitante: nombreVisitante,
      documento_visitante: documentoVisitante,
      telefono_visitante: telefonoVisitante,
      motivo: finalMotivo,
      residente_responsable_id: persona?.id || null,
      residente_responsable_nombre: resident.nombre_completo,
      dispositivo_id: dispositivoId || null,
      fecha_programada: fechaProgramada,
      fecha_vencimiento: fechaVencimiento,
      duracion_horas: duracionHoras,
      token_qr: token,
      estado: 'programada'
    };

    const { data: newVisita, error } = await admin
      .from('visitas_acceso')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error al crear visita: ${error.message}`);
    }

    if (newVisita.dispositivo_id && newVisita.token_qr) {
      this.controlAccesoService.registrarVisitaEnHardware(newVisita).catch(err =>
        this.controlAccesoService['logger'].error(`❌ [VISITA-HW] Error al registrar visita desde App en hardware: ${err.message}`)
      );
    }

    const responseVisita = {
      ...newVisita,
      nombre_visitante_temporal: newVisita.nombre_visitante,
      fecha_esperada: newVisita.fecha_programada,
      observaciones: newVisita.motivo,
    };

    return {
      ok: true,
      visita: responseVisita,
      token_qr: token,
    };
  }

  @Delete('visitas/:id')
  @ApiOperation({ summary: 'Cancelar una visita programada en visitas_acceso y hardware' })
  async cancelarVisita(@Param('id') id: string, @CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    const { data: visita, error: getErr } = await admin
      .from('visitas_acceso')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (getErr || !visita) {
      throw new NotFoundException('Visita no encontrada');
    }

    let { data: persona } = await admin
      .from('personas_gestion_acceso')
      .select('id')
      .eq('entidad_tipo', 'residente')
      .eq('entidad_id', resident.id)
      .maybeSingle();

    if (!persona && resident.documento) {
      const { data: pByDoc } = await admin
        .from('personas_gestion_acceso')
        .select('id')
        .eq('documento_identidad', resident.documento)
        .maybeSingle();
      persona = pByDoc;
    }

    const isResponsible = 
      (persona && visita.residente_responsable_id === persona.id) ||
      visita.residente_responsable_nombre === resident.nombre_completo;

    if (!isResponsible) {
      throw new BadRequestException('Esta visita no pertenece a este residente');
    }

    const { data: updatedVisita, error: updErr } = await admin
      .from('visitas_acceso')
      .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      throw new BadRequestException(`Error al cancelar visita: ${updErr.message}`);
    }

    if (updatedVisita?.dispositivo_id) {
      this.controlAccesoService.eliminarVisitaDeHardware(updatedVisita).catch(err =>
        this.controlAccesoService['logger'].warn(`⚠️ [VISITA-HW] Limpieza al cancelar desde App falló: ${err.message}`)
      );
    }

    return { ok: true, mensaje: 'Visita cancelada con éxito' };
  }

  @Get('eventos')
  @ApiOperation({ summary: 'Obtener historial de ingresos/salidas de su apartamento o visitas' })
  async getEventos(@CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    let { data: persona } = await admin
      .from('personas_gestion_acceso')
      .select('id')
      .eq('entidad_tipo', 'residente')
      .eq('entidad_id', resident.id)
      .maybeSingle();

    if (!persona && resident.documento) {
      const { data: pByDoc } = await admin
        .from('personas_gestion_acceso')
        .select('id')
        .eq('documento_identidad', resident.documento)
        .maybeSingle();
      persona = pByDoc;
    }

    let queryVisitas = admin
      .from('visitas_acceso')
      .select('documento_visitante');

    if (persona) {
      queryVisitas = queryVisitas.or(`residente_responsable_id.eq.${persona.id},residente_responsable_nombre.eq."${resident.nombre_completo}"`);
    } else {
      queryVisitas = queryVisitas.eq('residente_responsable_nombre', resident.nombre_completo);
    }

    const { data: visitas } = await queryVisitas;

    const documents = [resident.documento].filter(Boolean);
    if (visitas && visitas.length > 0) {
      documents.push(...visitas.map(v => v.documento_visitante).filter(Boolean));
    }

    let query = admin
      .from('dispositivos_eventos_historico')
      .select(`
        *,
        dispositivo:dispositivos_iot(nombre_identificador)
      `)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (documents.length > 0) {
      query = query.in('documento_persona', documents);
    } else {
      query = query.eq('documento_persona', resident.documento);
    }

    const { data: logs, error } = await query;
    if (error) {
      throw new BadRequestException(`Error al obtener historial: ${error.message}`);
    }

    return logs || [];
  }

  @Post('panico')
  @ApiOperation({ summary: 'Activar botón de pánico de emergencia' })
  async activarPanico(
    @Body() body: {
      latitud?: number;
      longitud?: number;
      precision_metros?: number;
      dispositivo?: string;
      version_app?: string;
      mensaje?: string;
    },
    @CurrentUser() user: any
  ) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    const { data: device } = await admin
      .from('dispositivos_iot')
      .select('id, nombre_identificador')
      .eq('puesto_id', resident.puesto_id)
      .limit(1)
      .maybeSingle();

    const deviceId = device?.id || null;

    const eventPayload = {
      dispositivo_id: deviceId,
      tipo_evento: 'alarma',
      metodo_acceso: 'remoto',
      nombre_persona: `PÁNICO: ${resident.nombre_completo}`,
      documento_persona: resident.documento,
      timestamp: new Date().toISOString(),
      detalles_raw: {
        tipo_alarma: 'PANICO_RESIDENTE',
        torre: resident.torre_bloque,
        apto: resident.apto_casa,
        telefono: resident.telefono || resident.correo,
        residente_id: resident.id,
        mensaje: body.mensaje || 'Alerta activada desde app móvil',
        latitud: body.latitud || null,
        longitud: body.longitud || null,
        precision_metros: body.precision_metros || null,
        dispositivo: body.dispositivo || 'app-movil',
        version_app: body.version_app || null,
      },
    };

    const { data: newEvent, error } = await admin
      .from('dispositivos_eventos_historico')
      .insert(eventPayload)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error al registrar alerta de pánico: ${error.message}`);
    }

    return {
      ok: true,
      mensaje: 'Alerta de pánico enviada correctamente a la central de monitoreo',
      evento: newEvent,
    };
  }

  @Get('listas-acceso')
  @ApiOperation({ summary: 'Obtener lista de personas en su whitelist/blacklist personal' })
  async getListasAcceso(@CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    const { data: listas, error } = await admin
      .from('listas_acceso')
      .select('*')
      .eq('creado_por_residente_id', resident.id)
      .eq('activo', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error al obtener lista de acceso: ${error.message}`);
    }

    return listas || [];
  }

  @Post('listas-acceso')
  @ApiOperation({ summary: 'Agregar persona a su whitelist o blacklist' })
  async agregarALista(
    @Body() body: {
      documento: string;
      nombre_persona?: string;
      tipo_lista: 'blanca' | 'negra';
      motivo?: string;
    },
    @CurrentUser() user: any
  ) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    if (!body.documento) {
      throw new BadRequestException('El documento es obligatorio');
    }

    const { data: newEntry, error } = await admin
      .from('listas_acceso')
      .insert({
        puesto_id: resident.puesto_id,
        documento: body.documento,
        tipo_lista: body.tipo_lista,
        motivo: body.motivo || `Agregado por Residente Apto ${resident.apto_casa || ''} Torre ${resident.torre_bloque || ''}`,
        creado_por_residente_id: resident.id,
        activo: true,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error al agregar a la lista: ${error.message}`);
    }

    return {
      ok: true,
      entrada: newEntry,
    };
  }

  @Delete('listas-acceso/:id')
  @ApiOperation({ summary: 'Eliminar persona de su whitelist o blacklist' })
  async eliminarDeLista(@Param('id') id: string, @CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    const { data: entry } = await admin
      .from('listas_acceso')
      .select('id')
      .eq('id', id)
      .eq('creado_por_residente_id', resident.id)
      .maybeSingle();

    if (!entry) {
      throw new NotFoundException('Registro no encontrado o no pertenece a este residente');
    }

    const { error } = await admin
      .from('listas_acceso')
      .update({ activo: false })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Error al eliminar de la lista: ${error.message}`);
    }

    return { ok: true, mensaje: 'Persona removida de su lista con éxito' };
  }

  @Get('dispositivos')
  @ApiOperation({ summary: 'Obtener los dispositivos de control de acceso asignados al puesto del residente' })
  async getDispositivos(@CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    // 1. Obtener persona vinculada al residente (si existe) para buscar sus permisos específicos
    const { data: persona } = await admin
      .from('personas_gestion_acceso')
      .select('id')
      .eq('documento_identidad', resident.documento)
      .eq('activo', true)
      .maybeSingle();

    let permittedDeviceIds: string[] = [];

    if (persona) {
      // 2. Obtener permisos de acceso del residente
      const { data: permisos } = await admin
        .from('acceso_permisos_dispositivos')
        .select('dispositivo_id')
        .eq('persona_id', persona.id)
        .eq('activo', true);

      if (permisos && permisos.length > 0) {
        permittedDeviceIds = permisos.map(p => p.dispositivo_id);
      }
    }

    // 3. Consultar dispositivos
    // Query A: por IDs permitidos (si hay alguno)
    let devicesA: any[] = [];
    if (permittedDeviceIds.length > 0) {
      const { data, error: errA } = await admin
        .from('dispositivos_iot')
        .select('id, nombre_identificador, ip_direccion, apertura_desde_app, apertura_latitud, apertura_longitud, apertura_radio, apertura_automatica, apertura_auto_vehiculo_only, apertura_velocidad_minima, configuracion_tecnica')
        .in('id', permittedDeviceIds)
        .eq('estado', 'operativo');
      if (errA) throw new BadRequestException(`Error al obtener dispositivos vinculados: ${errA.message}`);
      devicesA = data || [];
    }

    // Query B: por puesto_id (si resident.puesto_id no es nulo)
    let devicesB: any[] = [];
    if (resident.puesto_id) {
      const { data, error: errB } = await admin
        .from('dispositivos_iot')
        .select('id, nombre_identificador, ip_direccion, apertura_desde_app, apertura_latitud, apertura_longitud, apertura_radio, apertura_automatica, apertura_auto_vehiculo_only, apertura_velocidad_minima, configuracion_tecnica')
        .eq('puesto_id', resident.puesto_id)
        .eq('estado', 'operativo');
      if (errB) throw new BadRequestException(`Error al obtener dispositivos del puesto: ${errB.message}`);
      devicesB = data || [];
    }

    // Combinar los dos conjuntos de dispositivos (evitando duplicados)
    const deviceMap = new Map<string, any>();
    for (const d of devicesA) {
      deviceMap.set(d.id, { ...d, vinculado: true });
    }
    for (const d of devicesB) {
      if (!deviceMap.has(d.id)) {
        deviceMap.set(d.id, { ...d, vinculado: permittedDeviceIds.includes(d.id) });
      }
    }

    const devicesMapped = Array.from(deviceMap.values());
    return devicesMapped;
  }

  @Post('dispositivo/:deviceId/puerta')
  @ApiOperation({ summary: 'Apertura/cierre remota de puerta desde la app para residentes autorizados con vehículo' })
  async controlPuertaResidente(
    @Param('deviceId') deviceId: string,
    @Body() body: { command?: 'abrir' | 'cerrar' },
    @CurrentUser() user: any
  ) {
    const command = body?.command || 'abrir';
    if (command !== 'abrir' && command !== 'cerrar') {
      throw new BadRequestException('Comando inválido. Debe ser abrir o cerrar');
    }

    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    // 1. Obtener dispositivo y verificar si permite apertura desde el app
    const { data: device, error: devErr } = await admin
      .from('dispositivos_iot')
      .select('*')
      .eq('id', deviceId)
      .maybeSingle();

    if (devErr || !device) {
      throw new NotFoundException('Dispositivo no encontrado');
    }

    if (!device.apertura_desde_app) {
      throw new BadRequestException('La apertura desde el app no está habilitada para este dispositivo');
    }

    // 2. Verificar si el residente tiene vehículo
    const { data: recopilacionReg } = await admin
      .from('control_acceso_recoleccion_registros')
      .select('tiene_vehiculo, placa_vehiculo')
      .eq('cedula', resident.documento)
      .maybeSingle();

    const { data: vehiculoReg } = await admin
      .from('vehiculos')
      .select('id')
      .eq('tarjeta_propietario', resident.documento)
      .limit(1);

    const tieneVehiculo = 
      !!recopilacionReg?.tiene_vehiculo || 
      !!recopilacionReg?.placa_vehiculo || 
      (vehiculoReg && vehiculoReg.length > 0);

    if (!tieneVehiculo) {
      throw new BadRequestException('Acceso denegado: El residente no tiene un vehículo registrado');
    }

    // 3. Verificar si el residente está sincronizado a este dispositivo
    const { data: persona } = await admin
      .from('personas_gestion_acceso')
      .select('id')
      .eq('documento_identidad', resident.documento)
      .eq('activo', true)
      .maybeSingle();

    if (!persona) {
      throw new BadRequestException('Acceso denegado: No se encontró una persona activa para este residente');
    }

    const { data: permiso } = await admin
      .from('acceso_permisos_dispositivos')
      .select('id')
      .eq('persona_id', persona.id)
      .eq('dispositivo_id', deviceId)
      .eq('activo', true)
      .maybeSingle();

    if (!permiso) {
      throw new BadRequestException('Acceso denegado: El residente no está sincronizado a este dispositivo');
    }

    // 4. Ejecutar el comando de puerta
    this.logger.log(`🚪 [APERTURA REMOTA APP] Residente ${resident.nombre_completo} (CC ${resident.documento}) ejecutando "${command}" en dispositivo ${device.nombre_identificador} (${device.ip_direccion})`);
    
    const result = await this.controlAccesoService.controlPuerta(
      device.ip_direccion,
      1,
      command,
      {
        deviceId: device.id,
        user: device.credencial_usuario,
        pass: device.credencial_password,
        port: device.configuracion_tecnica?.puerto,
        marca: device.configuracion_tecnica?.marca,
        operator: {
          id: user.id,
          nombre_completo: `RESIDENTE: ${resident.nombre_completo}`,
        }
      }
    );

    if (!result.ok) {
      throw new BadRequestException(result.mensaje || 'Error al ejecutar el comando en el dispositivo');
    }

    return {
      ok: true,
      mensaje: `Comando ${command} enviado con éxito al dispositivo`,
      detalle: result.detalle || null
    };
  }
}
