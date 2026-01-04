import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePqrsfDto, UpdatePqrsfDto, AddRespuestaDto, AddAdjuntoDto } from './dto/pqrsf.dto';

@Injectable()
export class PqrsfService {
    private readonly logger = new Logger(PqrsfService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createPqrsfDto: CreatePqrsfDto, userId: number) {
        const supabase = this.supabaseService.getClient();

        // Obtener usuario externo para el response (validar si el userId es de usuarios_externos)
        // Asumo que el userId viene del token y corresponde a la tabla usuarios_externos

        const { data, error } = await supabase
            .from('pqrsf')
            .insert({
                ...createPqrsfDto,
                usuario_cliente_id: userId,
                fecha_creacion: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`Error creando PQRSF: ${JSON.stringify(error)}`);
            throw error;
        }

        return data;
    }

    async findAll(filters?: { clienteId?: number; estado?: string; fechaInicio?: string; fechaFin?: string }) {
        const supabase = this.supabaseService.getClient();
        let query = supabase
            .from('pqrsf')
            .select(`
                *,
                cliente:cliente_id(nombre_empresa),
                creado_por:usuario_cliente_id(nombre_completo),
                contrato:contrato_id(id),
                puesto:puesto_id(nombre)
            `)
            .order('created_at', { ascending: false });

        if (filters?.clienteId) query = query.eq('cliente_id', filters.clienteId);
        if (filters?.estado) query = query.eq('estado', filters.estado);
        if (filters?.fechaInicio) query = query.gte('created_at', filters.fechaInicio);
        if (filters?.fechaFin) query = query.lte('created_at', filters.fechaFin);

        const { data, error } = await query;

        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('pqrsf')
            .select(`
                *,
                cliente:cliente_id(nombre_empresa),
                creado_por:usuario_cliente_id(nombre_completo),
                contrato:contrato_id(id),
                puesto:puesto_id(nombre),
                respuestas:pqrsf_respuestas(
                    id, mensaje, created_at, visible_para_cliente,
                    respondido_por:respondido_por(nombre_completo)
                ),
                adjuntos:pqrsf_adjuntos(
                    id, tipo, url, created_at
                ),
                asignaciones:pqrsf_asignaciones(
                    id, fecha_asignacion, activo,
                    asignado_a:asignado_a(nombre_completo)
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) throw new NotFoundException(`PQRSF #${id} no encontrado`);

        return data;
    }

    async update(id: number, updatePqrsfDto: UpdatePqrsfDto, userId: number) {
        const supabase = this.supabaseService.getClient();

        // Prepare update object
        const updateData: any = { ...updatePqrsfDto };

        // If closing, set fecha_cierre
        if (updatePqrsfDto.estado === 'cerrado') {
            updateData.fecha_cierre = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('pqrsf')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async addRespuesta(id: number, dto: AddRespuestaDto, userId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Agregar respuesta
        const { data: respuesta, error } = await supabase
            .from('pqrsf_respuestas')
            .insert({
                pqrsf_id: id,
                respondido_por: userId,
                mensaje: dto.mensaje,
                visible_para_cliente: dto.visible_para_cliente
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Actualizar estado a 'respondido' o 'en_proceso' si estaba abierto
        await supabase
            .from('pqrsf')
            .update({
                estado: 'respondido',
                fecha_respuesta: new Date().toISOString()
            })
            .eq('id', id)
            .eq('estado', 'abierto'); // Solo si es abierto, cambiamos a respondido. Si ya estaba en proceso, quizas mantener.

        return respuesta;
    }

    async addAdjunto(id: number, dto: AddAdjuntoDto, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('pqrsf_adjuntos')
            .insert({
                pqrsf_id: id,
                tipo: dto.tipo,
                url: dto.url,
                creado_por: userId
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}
