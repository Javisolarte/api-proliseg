import { Module } from '@nestjs/common';
import { AutoservicioEmpleadoController } from './autoservicio-empleado.controller';
import { AutoservicioClienteController } from './autoservicio-cliente.controller';
import { AutoservicioService } from './autoservicio.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [AutoservicioEmpleadoController, AutoservicioClienteController],
    providers: [AutoservicioService],
})
export class AutoservicioModule { }
