/**
 * 📚 GUÍA DE IMPLEMENTACIÓN: EJEMPLO COMPLETO DE SERVICIO CON RLS
 * 
 * Este archivo muestra cómo implementar un servicio con soporte completo
 * para filtros RLS (Row Level Security).
 * 
 * PATRÓN A SEGUIR PARA TODOS LOS SERVICIOS:
 * 1. Inyectar RlsHelperService en el constructor
 * 2. Agregar parámetro opcional `rlsContext?: RlsContext` a métodos que consultan datos
 * 3. Usar `rlsHelper.applyRlsFilter()` antes de ejecutar queries
 * 4. Para operaciones de escritura, validar acceso primero con findOne()
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RlsHelperService } from '../../common/services/rls-helper.service';
import { RlsContext } from '../../config/permissions.config';

@Injectable()
export class ExampleServiceWithRLS {
    private readonly logger = new Logger(ExampleServiceWithRLS.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly rlsHelper: RlsHelperService, // ✅ Inyectar RLS Helper
    ) { }

    /**
     * ✅ PATRÓN 1: Listar todos los registros con filtros RLS
     */
    async findAll(rlsContext?: RlsContext) {
        const db = this.supabase.getClient();

        // Iniciar query base
        let query = db
            .from('tabla_ejemplo')
            .select('*')
            .order('created_at', { ascending: false });

        // Aplicar filtros RLS si el contexto está presente
        if (rlsContext) {
            query = this.rlsHelper.applyRlsFilter(query, 'tabla_ejemplo', rlsContext);
        }

        const { data, error } = await query;

        if (error) {
            this.logger.error(`Error al listar: ${error.message}`);
            throw error;
        }

        return data;
    }

    /**
     * ✅ PATRÓN 2: Obtener un registro por ID con validación RLS
     */
    async findOne(id: number, rlsContext?: RlsContext) {
        const db = this.supabase.getClient();

        let query = db
            .from('tabla_ejemplo')
            .select('*')
            .eq('id', id);

        // Aplicar filtros RLS
        if (rlsContext) {
            query = this.rlsHelper.applyRlsFilter(query, 'tabla_ejemplo', rlsContext);
        }

        const { data, error } = await query.single();

        if (error || !data) {
            throw new NotFoundException(`Registro con ID ${id} no encontrado o sin acceso`);
        }

        return data;
    }

    /**
     * ✅ PATRÓN 3: Crear un registro (sin RLS, todos pueden crear)
     */
    async create(createDto: any) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('tabla_ejemplo')
            .insert(createDto)
            .select()
            .single();

        if (error) {
            this.logger.error(`Error al crear: ${error.message}`);
            throw error;
        }

        return data;
    }

    /**
     * ✅ PATRÓN 4: Actualizar un registro con validación RLS
     */
    async update(id: number, updateDto: any, rlsContext?: RlsContext) {
        // Primero verificar que el usuario tiene acceso al registro
        if (rlsContext) {
            await this.findOne(id, rlsContext);
        }

        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('tabla_ejemplo')
            .update(updateDto)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Registro con ID ${id} no encontrado`);
        }

        return data;
    }

    /**
     * ✅ PATRÓN 5: Eliminar un registro con validación RLS
     */
    async remove(id: number, rlsContext?: RlsContext) {
        // Primero verificar que el usuario tiene acceso al registro
        if (rlsContext) {
            await this.findOne(id, rlsContext);
        }

        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('tabla_ejemplo')
            .update({ activo: false }) // Soft delete
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Registro con ID ${id} no encontrado`);
        }

        return { message: 'Registro eliminado exitosamente', data };
    }

    /**
     * ✅ PATRÓN 6: Query compleja con filtros RLS manuales
     * 
     * Para casos donde getRlsFilter() retorna null (ej: minutas, puestos),
     * debes aplicar los filtros manualmente en el servicio.
     */
    async findByComplexCriteria(rlsContext?: RlsContext) {
        const db = this.supabase.getClient();

        let query = db
            .from('tabla_ejemplo')
            .select('*, relacion(*)')
            .order('created_at', { ascending: false });

        // Aplicar filtros RLS manuales según el rol
        if (rlsContext) {
            if (rlsContext.rol === 'vigilante') {
                // Vigilante solo ve registros donde está asignado
                query = query.eq('empleado_id', rlsContext.empleadoId);
            } else if (rlsContext.rol === 'cliente') {
                // Cliente solo ve registros de sus contratos
                // Primero obtener IDs de contratos del cliente
                const { data: contratos } = await db
                    .from('contratos')
                    .select('id')
                    .eq('cliente_id', rlsContext.clienteId);

                const contratoIds = contratos?.map(c => c.id) || [];
                query = query.in('contrato_id', contratoIds);
            }
            // Otros roles ven todo
        }

        const { data, error } = await query;

        if (error) {
            this.logger.error(`Error en query compleja: ${error.message}`);
            throw error;
        }

        return data;
    }
}

/**
 * 📋 PATRÓN PARA CONTROLADORES
 * 
 * Los controladores deben:
 * 1. Inyectar RlsHelperService
 * 2. Usar @CurrentUser() para obtener el usuario autenticado
 * 3. Crear RlsContext con rlsHelper.createRlsContext(user)
 * 4. Pasar el contexto a los métodos del servicio
 */

/*
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RlsHelperService } from '../../common/services/rls-helper.service';

@Controller('example')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExampleController {
  constructor(
    private readonly exampleService: ExampleServiceWithRLS,
    private readonly rlsHelper: RlsHelperService,
  ) {}

  @Get()
  @RequirePermissions('example.read')
  async findAll(@CurrentUser() user: any) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.exampleService.findAll(rlsContext);
  }

  @Get(':id')
  @RequirePermissions('example.read')
  async findOne(@Param('id') id: number, @CurrentUser() user: any) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.exampleService.findOne(id, rlsContext);
  }

  @Post()
  @RequirePermissions('example.write')
  async create(@Body() createDto: any) {
    return this.exampleService.create(createDto);
  }

  @Put(':id')
  @RequirePermissions('example.write')
  async update(
    @Param('id') id: number,
    @Body() updateDto: any,
    @CurrentUser() user: any,
  ) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.exampleService.update(id, updateDto, rlsContext);
  }

  @Delete(':id')
  @RequirePermissions('example.delete')
  async remove(@Param('id') id: number, @CurrentUser() user: any) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.exampleService.remove(id, rlsContext);
  }
}
*/

/**
 * 📋 PATRÓN PARA MÓDULOS
 * 
 * Los módulos deben incluir RlsHelperService en providers
 */

/*
import { Module } from '@nestjs/common';
import { ExampleController } from './example.controller';
import { ExampleServiceWithRLS } from './example.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { RlsHelperService } from '../../common/services/rls-helper.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ExampleController],
  providers: [ExampleServiceWithRLS, RlsHelperService],
  exports: [ExampleServiceWithRLS],
})
export class ExampleModule {}
*/
