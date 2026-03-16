import { Module } from '@nestjs/common';
import { AutoservicioEmpleadoController } from './autoservicio-empleado.controller';
import { AutoservicioClienteController } from './autoservicio-cliente.controller';
import { AutoservicioSupervisorController } from './autoservicio-supervisor.controller';
import { VisitasTecnicasAutoservicioController } from './visitas-tecnicas-autoservicio.controller';
import { AutoservicioService } from './autoservicio.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { PqrsfModule } from '../pqrsf/pqrsf.module';
import { IaModule } from '../ia/ia.module';
import { BotonPanicoModule } from '../boton-panico/boton-panico.module';
import { UbicacionesModule } from '../ubicaciones/ubicaciones.module';
import { VisitasTecnicasModule } from '../visitas-tecnicas/visitas-tecnicas.module';

@Module({
    imports: [SupabaseModule, AuthModule, PqrsfModule, IaModule, BotonPanicoModule, UbicacionesModule, VisitasTecnicasModule],
    controllers: [
        AutoservicioEmpleadoController, 
        AutoservicioClienteController, 
        AutoservicioSupervisorController,
        VisitasTecnicasAutoservicioController
    ],
    providers: [AutoservicioService],
})
export class AutoservicioModule { }
