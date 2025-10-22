import { Module } from '@nestjs/common';
import { AsignarTurnosController } from './asignar_turnos.controller';
import { AsignarTurnosService } from './asignar_turnos.service';
import { AuthModule } from '../auth/auth.module'; // Para autenticación
import { SupabaseModule } from '../supabase/supabase.module'; // Si tienes un módulo que expone SupabaseService

@Module({
  imports: [
    AuthModule,      // ✅ Para proteger rutas
    SupabaseModule,  // ✅ Para usar SupabaseService y acceder a las tablas
  ],
  controllers: [AsignarTurnosController],
  providers: [AsignarTurnosService],
  exports: [AsignarTurnosService],
})
export class AsignarTurnosModule {}
