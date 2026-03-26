import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AsignarTurnosService } from '../modules/asignar_turnos/asignar_turnos.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(AsignarTurnosService);

  console.log('🚀 INICIANDO REGENERACIÓN GLOBAL DE ABRIL 2026...');
  
  try {
    const result = await service.generarTurnosAutomaticos(4, 2026, 203);
    console.log('✅ REGENERACIÓN COMPLETADA:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('❌ ERROR FATAL:', err);
  }

  await app.close();
}

bootstrap();
