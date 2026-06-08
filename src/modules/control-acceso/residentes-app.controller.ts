import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ControlAccesoService } from './control-acceso.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import axios from 'axios';

@ApiTags('Residentes App')
@ApiBearerAuth('JWT-auth')
@Controller('residentes-app')
export class ResidentesAppController {
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
    return {
      ok: true,
      residente: resident,
      usuario: user,
    };
  }

  @Get('visitas')
  @ApiOperation({ summary: 'Obtener historial de visitas programadas por el residente' })
  async getVisitas(@CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    const { data: visitas, error } = await admin
      .from('visitas_registro')
      .select('*')
      .eq('residente_destino_id', resident.id)
      .order('fecha_esperada', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error al obtener visitas: ${error.message}`);
    }

    return visitas || [];
  }

  @Post('visitas')
  @ApiOperation({ summary: 'Crear una visita y generar un código QR de 8 dígitos' })
  async crearVisita(
    @Body() body: {
      nombre_visitante: string;
      documento_visitante?: string;
      fecha_esperada: string;
      observacion?: string;
    },
    @CurrentUser() user: any
  ) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    if (!body.nombre_visitante) {
      throw new BadRequestException('El nombre del visitante es obligatorio');
    }

    const token = Math.floor(10000000 + Math.random() * 90000000).toString();

    let visitanteId = null;
    if (body.documento_visitante) {
      const { data: v } = await admin
        .from('visitantes')
        .select('id')
        .eq('documento', body.documento_visitante)
        .maybeSingle();
      if (v) visitanteId = v.id;
    }

    const { data: newVisita, error } = await admin
      .from('visitas_registro')
      .insert({
        puesto_id: resident.puesto_id,
        residente_destino_id: resident.id,
        visitante_id: visitanteId,
        nombre_visitante_temporal: body.nombre_visitante,
        fecha_entrada: null,
        fecha_salida: null,
        estado: 'programada',
        token_qr: token,
        fecha_esperada: body.fecha_esperada,
        observaciones: body.observacion || null,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error al crear visita: ${error.message}`);
    }

    return {
      ok: true,
      visita: newVisita,
      token_qr: token,
    };
  }

  @Delete('visitas/:id')
  @ApiOperation({ summary: 'Cancelar una visita programada' })
  async cancelarVisita(@Param('id') id: string, @CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    const { data: visita } = await admin
      .from('visitas_registro')
      .select('id')
      .eq('id', id)
      .eq('residente_destino_id', resident.id)
      .maybeSingle();

    if (!visita) {
      throw new NotFoundException('Visita no encontrada o no pertenece a este residente');
    }

    const { error } = await admin
      .from('visitas_registro')
      .update({ estado: 'cancelado' })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Error al cancelar visita: ${error.message}`);
    }

    return { ok: true, mensaje: 'Visita cancelada con éxito' };
  }

  @Get('eventos')
  @ApiOperation({ summary: 'Obtener historial de ingresos/salidas de su apartamento o visitas' })
  async getEventos(@CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    const { data: visitas } = await admin
      .from('visitas_registro')
      .select('visitante_id, nombre_visitante_temporal')
      .eq('residente_destino_id', resident.id);

    const documents = [resident.documento].filter(Boolean);

    const visitorIds = (visitas || []).map(v => v.visitante_id).filter(Boolean);
    if (visitorIds.length > 0) {
      const { data: vts } = await admin
        .from('visitantes')
        .select('documento')
        .in('id', visitorIds);
      if (vts) {
        documents.push(...vts.map(v => v.documento).filter(Boolean));
      }
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
  async activarPanico(@CurrentUser() user: any) {
    const resident = await this.getResidentFromUser(user);
    const admin = this.supabaseService.getSupabaseAdminClient();

    const { data: device } = await admin
      .from('dispositivos_iot')
      .select('id, nombre_identificador')
      .eq('puesto_id', resident.puesto_id)
      .limit(1)
      .maybeSingle();

    const deviceId = device?.id || null;
    const deviceName = device?.nombre_identificador || 'Dispositivo Central';

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
}
