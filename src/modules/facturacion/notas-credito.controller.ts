import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
// import { NotasCreditoService } from './notas-credito.service';

@ApiTags('Notas de Crédito')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('facturacion/notas-credito')
export class NotasCreditoController {
  // constructor(private readonly notasCreditoService: NotasCreditoService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las notas de crédito' })
  findAll() {
    return []; // this.notasCreditoService.findAll();
  }

  @Post('emitir')
  @ApiOperation({ summary: 'Emitir una nueva nota de crédito a Factus' })
  emitirNota(@Body() dto: any, @CurrentUser() user: any) {
    return { status: 'mock' }; // this.notasCreditoService.emitir(dto, user?.id);
  }
}
