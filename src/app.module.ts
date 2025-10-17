import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Configuration
import { validationSchema } from './config/validation.config';

// Database
import { DatabaseModule } from './database/database.module';

// Common


// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { EmpleadosModule } from './modules/empleados/empleados.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ContratosModule } from './modules/contratos/contratos.module';
import { TurnosModule } from './modules/turnos/turnos.module';
import { AsistenciasModule } from './modules/asistencias/asistencias.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { IaModule } from './modules/ia/ia.module';
import { ServiciosModule } from './modules/servicios/servicios.module';
import { PermisosModule } from './modules/permisos/permisos.module';
import { AsignacionesModule } from './modules/asignaciones/asignaciones.module';
import { PuestosModule } from './modules/puestos/puestos.module';
import { SubpuestosModule } from './modules/subpuestos/subpuestos.module';
import { TurnosConfiguracionModule } from './modules/turnos_configuracion/turnos_configuracion.module';
import { RolesModule } from './modules/roles/roles.module';






@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema,
    }),
    SupabaseModule,

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Database
    DatabaseModule,

    // Feature modules
    AuthModule,
    UsuariosModule,
    EmpleadosModule,
    ClientesModule,
    ContratosModule,
    TurnosModule,
    AsistenciasModule,
    IaModule,
    ServiciosModule,
    PermisosModule,
    AsignacionesModule,
    PuestosModule,
    SubpuestosModule,
    TurnosConfiguracionModule
  
  ],
  providers: [
    // Global guards - order matters!
   
  ],
})
export class AppModule {}