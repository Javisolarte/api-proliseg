import { Module } from '@nestjs/common';
import { EntregasInventarioService } from './entregas-inventario.service';
import { EntregasInventarioController } from './entregas-inventario.controller';
import { DocumentosGeneradosModule } from '../documentos-generados/documentos-generados.module';

@Module({
  imports: [DocumentosGeneradosModule],
  controllers: [EntregasInventarioController],
  providers: [EntregasInventarioService],
  exports: [EntregasInventarioService],
})
export class EntregasInventarioModule { }
