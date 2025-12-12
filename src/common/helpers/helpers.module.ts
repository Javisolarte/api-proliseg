import { Module, Global } from '@nestjs/common';
import { PuestosHelperService } from './puestos-helper.service';
import { EmpleadosHelperService } from './empleados-helper.service';
import { RlsValidationService } from './rls-validation.service';
import { SupabaseModule } from '../../modules/supabase/supabase.module';

/**
 * 🔧 HELPERS MODULE
 * 
 * Módulo global que exporta servicios auxiliares para RLS y validaciones.
 * Estos servicios están disponibles en toda la aplicación sin necesidad de importar el módulo.
 */
@Global()
@Module({
    imports: [SupabaseModule],
    providers: [
        PuestosHelperService,
        EmpleadosHelperService,
        RlsValidationService,
    ],
    exports: [
        PuestosHelperService,
        EmpleadosHelperService,
        RlsValidationService,
    ],
})
export class HelpersModule { }
