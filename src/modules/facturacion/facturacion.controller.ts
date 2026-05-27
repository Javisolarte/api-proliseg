import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FacturacionService } from './facturacion.service';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Facturacion')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('facturacion')
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) { }

  @Get()
  @ApiOperation({ summary: 'Listar todas las facturas' })
  findAll() {
    return this.facturacionService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una factura por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.facturacionService.findOne(id);
  }

  @Post('emitir')
  @ApiOperation({ summary: 'Crear y emitir una nueva factura electrónica a Factus' })
  emitirFactura(@Body() dto: CrearFacturaDto, @CurrentUser() user: any) {
    return this.facturacionService.emitirFactura(dto, user?.id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar el PDF de la factura desde Factus' })
  descargarPdf(@Param('id', ParseIntPipe) id: number) {
    return this.facturacionService.descargarPdf(id);
  }
}
