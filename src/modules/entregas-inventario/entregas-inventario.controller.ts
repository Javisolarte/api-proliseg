import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { EntregasInventarioService } from './entregas-inventario.service';
import { CreateEntregaInventarioDto, DevolucionInventarioDto, DestruccionInventarioDto } from './dto/entrega-inventario.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Entregas Inventario y Actas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('entregas-inventario')
export class EntregasInventarioController {
  constructor(private readonly entregasInventarioService: EntregasInventarioService) { }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva acta de entrega' })
  create(@Body() createDto: CreateEntregaInventarioDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.entregasInventarioService.create(createDto, userId);
  }

  @Post('devolucion')
  @ApiOperation({ summary: 'Registrar la devolución de artículos y generar acta de recibido' })
  devolucion(@Body() devolucionDto: DevolucionInventarioDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.entregasInventarioService.procesarDevolucion(devolucionDto, userId);
  }

  @Post('destruccion')
  @ApiOperation({ summary: 'Registrar la baja o destrucción de un artículo' })
  destruccion(@Body() destruccionDto: DestruccionInventarioDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.entregasInventarioService.procesarDestruccion(destruccionDto, userId);
  }

  @Get()
  findAll() {
    return this.entregasInventarioService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.entregasInventarioService.findOne(+id);
  }

  @Get('cliente/:id')
  findByCliente(@Param('id') id: string) {
    return this.entregasInventarioService.findComodatosByCliente(+id);
  }
}
