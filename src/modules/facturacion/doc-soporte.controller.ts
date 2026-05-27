import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Documentos Soporte')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('facturacion/documentos-soporte')
export class DocSoporteController {

  @Get()
  @ApiOperation({ summary: 'Listar todos los documentos soporte' })
  findAll() {
    return []; 
  }

  @Post('emitir')
  @ApiOperation({ summary: 'Emitir un nuevo documento soporte a Factus' })
  emitirDocSoporte(@Body() dto: any, @CurrentUser() user: any) {
    return { status: 'mock' }; 
  }
}
