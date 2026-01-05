import { Module } from '@nestjs/common';
import { AutoservicioEmpleadoController } from './autoservicio-empleado.controller';
import { AutoservicioClienteController } from './autoservicio-cliente.controller';
import { AutoservicioService } from './autoservicio.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { PqrsfModule } from '../pqrsf/pqrsf.module';

@Module({
    imports: [SupabaseModule, AuthModule, PqrsfModule],
    controllers: [AutoservicioEmpleadoController, AutoservicioClienteController],
    providers: [AutoservicioService],
})
export class AutoservicioModule { }
