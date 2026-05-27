import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RangosService } from './rangos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Rangos Facturación')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('facturacion/rangos')
export class RangosController {
  constructor(private readonly rangosService: RangosService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener los rangos de numeración desde la BD local' })
  findAll() {
    return this.rangosService.findAll();
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sincronizar los rangos de numeración con la API de Factus' })
  syncRangos() {
    return this.rangosService.syncRangosFactus();
  }
}
