import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { SentryFilter } from './common/filters/sentry.filter';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as Sentry from '@sentry/nestjs';

// Configuration
import { validationSchema } from './config/validation.config';

// Database
import { DatabaseModule } from './database/database.module';

// Common
import { HelpersModule } from './common/helpers/helpers.module';

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
import { SubpuestosModule } from "./modules/subpuestos/subpuestos.module";
import { TiposCursoVigilanciaModule } from "./modules/tipos-curso-vigilancia/tipos-curso-vigilancia.module";
import { TurnosConfiguracionModule } from './modules/turnos_configuracion/turnos_configuracion.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { ArlModule } from './modules/arl/arl.module';
import { FondosPensionModule } from './modules/fondos_pension/fondos_pension.module';
import { EpsModule } from './modules/eps/eps.module';
import { SedesModule } from './modules/sedes/sedes.module';
import { AsignarTurnosModule } from './modules/asignar_turnos/asignar_turnos.module';
import { TurnosReemplazosModule } from './modules/turnos_reemplazos/turnos_reemplazos.module';
import { MinutasModule } from './modules/minutas/minutas.module';
import { CapacitacionesModule } from './modules/capacitaciones/capacitaciones.module';
import { RutasModule } from './modules/rutas/rutas.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { ModulosModule } from './modules/modulos/modulos.module';
import { SalariosModule } from './modules/salarios/salarios.module';
import { RolesModule } from './modules/roles/roles.module';
import { NovedadesModule } from './modules/novedades/novedades.module';
import { IncidentesModule } from './modules/incidentes/incidentes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CategoriasDotacionModule } from './modules/categorias-dotacion/categorias-dotacion.module';
import { ArticulosDotacionModule } from './modules/articulos-dotacion/articulos-dotacion.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { DotacionesModule } from './modules/dotaciones/dotaciones.module';
import { ContratosPersonalModule } from './modules/contratos-personal/contratos-personal.module';
import { NominaModule } from './modules/nomina/nomina.module';
import { EstudiosSeguridadModule } from './modules/estudios-seguridad/estudios-seguridad.module';
import { GeocercasModule } from './modules/geocercas/geocercas.module';

import { AutoservicioModule } from './modules/autoservicio/autoservicio.module';
import { TiposVigilanteModule } from './modules/tipos-vigilante/tipos-vigilante.module';
import { VehiculosModule } from './modules/vehiculos/vehiculos.module';
import { VisitasModule } from './modules/visitas/visitas.module';
import { EvidenciasModule } from './modules/evidencias/evidencias.module';
import { SupervisorModule } from './modules/supervisor/supervisor.module';
import { PqrsfModule } from './modules/pqrsf/pqrsf.module';
import { BotonPanicoModule } from './modules/boton-panico/boton-panico.module';
import { UbicacionesModule } from './modules/ubicaciones/ubicaciones.module';
import { MemorandosModule } from './modules/memorandos/memorandos.module';
import { ComunicacionesModule } from './modules/comunicaciones/comunicaciones.module';
import { AspirantesModule } from './modules/aspirantes/aspirantes.module';
import { FileManagerModule } from './modules/file-manager/file-manager.module';
import { FestivosModule } from './modules/festivos/festivos.module';
import { CorreosCorporativosModule } from './modules/correos-corporativos/correos-corporativos.module';
import { CalendarioModule } from './modules/calendario/calendario.module';

// 🆕 New modules - Document management
import { PlantillasModule } from './modules/plantillas/plantillas.module';
import { DocumentosGeneradosModule } from './modules/documentos-generados/documentos-generados.module';
import { FirmasModule } from './modules/firmas/firmas.module';
import { CotizacionesModule } from './modules/cotizaciones/cotizaciones.module';

// 🆕 New modules - Access control & residential
import { ResidentesModule } from './modules/residentes/residentes.module';
import { VisitantesModule } from './modules/visitantes/visitantes.module';
import { VisitasRegistroModule } from './modules/visitas-registro/visitas-registro.module';
import { ListasAccesoModule } from './modules/listas-acceso/listas-acceso.module';

// 🆕 New modules - Rondas & RRHH
import { RondasDefinicionModule } from './modules/rondas-definicion/rondas-definicion.module';
import { RondasEjecucionModule } from './modules/rondas-ejecucion/rondas-ejecucion.module';
import { ConsentimientosModule } from './modules/consentimientos/consentimientos.module';
import { VerificacionReferenciasModule } from './modules/verificacion-referencias/verificacion-referencias.module';

// 🆕 New modules - Operations & Maintenance
import { VisitasTecnicasModule } from './modules/visitas-tecnicas/visitas-tecnicas.module';
import { InventarioPuestoModule } from './modules/inventario-puesto/inventario-puesto.module';

// 🆕 Production modules
import { HealthModule } from './modules/health/health.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { ExportModule } from './modules/export/export.module';
import { SecurityModule } from './modules/security/security.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ClientesConfigModule } from './modules/clientes-config/clientes-config.module';
import { PoliticasModule } from './modules/politicas/politicas.module';
import { BiModule } from './modules/bi/bi.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ComplianceModule } from './modules/compliance/compliance.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema,
    }),
    SupabaseModule,

    // Cron jobs
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    // Monitoring
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ttl: 600, // 10 minutes default
    }),

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
    TiposCursoVigilanciaModule,
    TurnosConfiguracionModule,
    NotificacionesModule,
    ArlModule,
    FondosPensionModule,
    EpsModule,
    SedesModule,
    AsignarTurnosModule,
    TurnosReemplazosModule,
    MinutasModule,
    CapacitacionesModule,
    RutasModule,
    ReportesModule,
    AuditoriaModule,
    ModulosModule,
    SalariosModule,
    RolesModule,
    NovedadesModule,
    IncidentesModule,
    DashboardModule,
    CategoriasDotacionModule,
    ArticulosDotacionModule,
    ProveedoresModule,
    InventarioModule,
    DotacionesModule,
    ContratosPersonalModule,
    NominaModule,
    AutoservicioModule,
    TiposVigilanteModule,
    VehiculosModule,
    VisitasModule,
    EvidenciasModule,
    SupervisorModule,
    PqrsfModule,
    BotonPanicoModule,
    UbicacionesModule,
    MemorandosModule,
    ComunicacionesModule,
    EstudiosSeguridadModule,
    GeocercasModule,
    AspirantesModule,
    FileManagerModule,
    FestivosModule,
    HelpersModule,
    CorreosCorporativosModule,
    CalendarioModule,

    // 🆕 Document management modules
    PlantillasModule,
    DocumentosGeneradosModule,
    FirmasModule,
    CotizacionesModule,

    // 🆕 Access control & residential modules
    ResidentesModule,
    VisitantesModule,
    VisitasRegistroModule,
    ListasAccesoModule,

    // 🆕 Rondas & RRHH modules
    RondasDefinicionModule,
    RondasEjecucionModule,
    ConsentimientosModule,
    VerificacionReferenciasModule,

    // 🆕 Operations & Maintenance modules
    VisitasTecnicasModule,
    InventarioPuestoModule,

    // 🆕 Production-ready modules
    HealthModule,
    FeatureFlagsModule,
    ExportModule,
    SecurityModule,
    JobsModule,
    ClientesConfigModule,
    PoliticasModule,
    BiModule,
    WebhooksModule,
    ComplianceModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule { }
