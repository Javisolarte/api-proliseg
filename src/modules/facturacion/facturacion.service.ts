import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FactusApiService } from './factus-api.service';
import { CrearFacturaDto } from './dto/crear-factura.dto';

@Injectable()
export class FacturacionService {
  private readonly logger = new Logger(FacturacionService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly factusApiService: FactusApiService,
  ) {}

  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('facturas')
      .select('*, clientes(nombre_empresa, nit)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('facturas')
      .select('*, facturas_items(*), clientes(nombre_empresa, nit)')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Factura interna con ID ${id} no encontrada`);
    }

    return data;
  }

  async emitirFactura(dto: CrearFacturaDto, usuarioId?: number) {
    const supabase = this.supabaseService.getClient();
    
    // 1. Obtener Token de Factus de BD o auth (Por simplificar usamos env o BD)
    // Para simplificar asumo uso directo de login. 
    // Lo ideal es cachear el token en `facturacion_config`
    const factusToken = process.env.FACTUS_STATIC_TOKEN || 'SU_TOKEN_DE_PRUEBA';

    // 2. Crear factura en BD local como borrador
    const totalItems = dto.items.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);
    const totalImpuestos = dto.items.reduce((acc, item) => acc + ((item.cantidad * item.precio_unitario) * (item.impuesto_tasa || 0) / 100), 0);
    const totalFactura = totalItems + totalImpuestos;

    const { data: factura, error: facturaError } = await supabase
      .from('facturas')
      .insert({
        cliente_id: dto.cliente_id,
        fecha_emision: dto.fecha_emision || new Date().toISOString().split('T')[0],
        fecha_vencimiento: dto.fecha_vencimiento,
        subtotal: totalItems,
        impuestos: totalImpuestos,
        total: totalFactura,
        estado: 'borrador',
        creado_por: usuarioId,
        observaciones: dto.observaciones
      })
      .select()
      .single();

    if (facturaError) {
      throw new BadRequestException('Error guardando factura en base de datos local');
    }

    // Insertar items
    const itemsData = dto.items.map(i => ({
      factura_id: factura.id,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      impuesto_tasa: i.impuesto_tasa || 0,
      total: (i.cantidad * i.precio_unitario) * (1 + ((i.impuesto_tasa || 0)/100))
    }));

    await supabase.from('facturas_items').insert(itemsData);

    // 3. Obtener cliente para enviarlo a Factus
    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', dto.cliente_id).single();

    // 4. Mapear DTO de Factus
    // NOTA: Estos valores deben adaptarse a los códigos específicos exigidos por la DIAN
    const payloadFactus = {
      number: factura.id.toString(), // o un secuencial especifico
      type_document_id: 1, // Factura de Venta de talonario o de papel
      customer: {
        identification: cliente?.nit || '123456789',
        company: cliente?.nombre_empresa || 'Consumidor Final',
        // Mas campos obligatorios segun Factus (address, email, etc.)
      },
      items: dto.items.map(i => ({
        name: i.descripcion,
        quantity: i.cantidad,
        price: i.precio_unitario,
        // impuestos ...
      })),
      // Múltiples requerimientos según https://developers.factus.com.co
    };

    try {
      // Llamada real deshabilitada hasta tener credenciales válidas
      // const factusResponse = await this.factusApiService.emitirFactura(factusToken, payloadFactus);
      const factusResponse = { data: { bill: { id: "factus_123", cufe: "cufe_123456" } } };

      // 5. Actualizar la BD local con el estado validada y CUFE
      await supabase.from('facturas').update({
        estado: 'validada',
        factus_id: factusResponse.data?.bill?.id,
        factus_cufe: factusResponse.data?.bill?.cufe,
      }).eq('id', factura.id);

      return {
        message: 'Factura emitida y validada con éxito',
        factura_id: factura.id,
        factus_data: factusResponse.data
      };
    } catch (err) {
      await supabase.from('facturas').update({ estado: 'rechazada' }).eq('id', factura.id);
      throw err;
    }
  }

  async descargarPdf(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data: factura } = await supabase.from('facturas').select('numero_factura').eq('id', id).single();
    
    if (!factura?.numero_factura) {
       throw new BadRequestException('La factura no tiene número asignado o no fue validada');
    }

    const factusToken = process.env.FACTUS_STATIC_TOKEN || 'SU_TOKEN_DE_PRUEBA';
    // const res = await this.factusApiService.descargarPdf(factusToken, factura.numero_factura);
    return { url: 'https://factus.test/url-to-pdf' }; // Mock por ahora
  }
}
