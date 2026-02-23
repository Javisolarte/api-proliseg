import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateContratoPersonalDto } from './dto/create-contrato-personal.dto';
import { TerminateContratoPersonalDto } from './dto/terminate-contrato-personal.dto';
import { RenovarContratoDto } from './dto/renovar-contrato.dto';
import { UpdateContratoPersonalDto } from './dto/update-contrato-personal.dto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { DocumentosGeneradosService } from '../documentos-generados/documentos-generados.service';
import { EntidadTipo } from '../documentos-generados/dto/documento-generado.dto';

@Injectable()
export class ContratosPersonalService {
    private readonly logger = new Logger(ContratosPersonalService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly auditoriaService: AuditoriaService,
        private readonly documentosService: DocumentosGeneradosService,
    ) { }

    // 🔹 Crear contrato
    async create(createDto: CreateContratoPersonalDto, user: any, file?: any) {
        const supabase = this.supabaseService.getClient();
        const userId = user.id;

        // 1. Validar si el empleado ya tiene contrato activo
        const { data: activeContract } = await supabase
            .from('contratos_personal')
            .select('id')
            .eq('empleado_id', createDto.empleado_id)
            .eq('estado', 'activo')
            .single();

        if (activeContract) {
            throw new BadRequestException('El empleado ya tiene un contrato activo. Debe terminarlo o renovarlo.');
        }

        let contratoPdfUrl: string | null = null;
        let documentoGeneradoId: number | null = null;

        // 2. Obtener datos del empleado para ruta de archivo o variables de plantilla
        const { data: empleado } = await supabase
            .from('empleados')
            .select('*')
            .eq('id', createDto.empleado_id)
            .single();

        if (!empleado) throw new NotFoundException('Empleado no encontrado');

        // 2.1 Obtener datos del salario por separado para la plantilla (si aplica)
        let salarioValor = 0;
        if (createDto.plantilla_id || createDto.salario_id) {
            const { data: salario } = await supabase
                .from('salarios')
                .select('valor')
                .eq('id', createDto.salario_id)
                .single();
            if (salario) salarioValor = salario.valor;
        }

        // 3. FLUJO A: Subida manual de PDF
        if (file) {
            const path = `contratos_empleados/${empleado.cedula}.pdf`;
            contratoPdfUrl = await this.uploadFile(file, 'empleados', path);
        }

        // 4. FLUJO B: Generación automática por plantilla
        if (createDto.plantilla_id) {
            const today = new Date();
            const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

            const datos = {
                nombre_trabajador: empleado.nombre_completo.toUpperCase(),
                cedula_trabajador: empleado.cedula,
                direccion_trabajador: (empleado.direccion || 'Corregimiento la laguna PASTO-NARIÑO').toUpperCase(),
                expedida_en: (empleado.lugar_expedicion_cedula || 'PASTO (N)').toUpperCase(),
                lugar_nacimiento: (empleado.lugar_nacimiento || 'PASTO').toUpperCase(),
                fecha_nacimiento: empleado.fecha_nacimiento || '29/08/1983',
                nacionalidad: (empleado.nacionalidad || 'COLOMBIANO').toUpperCase(),
                cargo: (empleado.cargo_oficial || 'GUARDA DE SEGURIDAD').toUpperCase(),
                salario_texto: (createDto.salario_texto || `(01) SALARIO MÍNIMO MENSUAL LEGAL VIGENTE MAS AUXILIO DE TRANSPORTE MAS RECARGOS DE LEY`).toUpperCase(),
                duracion_contrato: (createDto.duracion_texto || '').toUpperCase(),
                periodos_pago: (createDto.periodos_pago || '5-10 DIAS DE CADA MES').toUpperCase(),
                fecha_inicio: createDto.fecha_inicio,
                fecha_fin: createDto.fecha_fin || '',
                lugar_prestacion: (createDto.lugar_prestacion || '').toUpperCase(),
                dia_firma: today.getDate(),
                mes_firma: meses[today.getMonth()],
                anio_firma: today.getFullYear(),
                ...(typeof createDto.datos_json === 'string' ? JSON.parse(createDto.datos_json) : createDto.datos_json)
            };

            this.logger.debug(`Datos para plantilla: ${JSON.stringify(datos, null, 2)}`);

            const docGenerado = await this.documentosService.create({
                plantilla_id: createDto.plantilla_id,
                entidad_tipo: EntidadTipo.CONTRATO_PERSONAL,
                entidad_id: createDto.empleado_id,
                datos_json: datos
            }, user);

            documentoGeneradoId = docGenerado.id;

            // Generar PDF inicial
            const docConPdf = await this.documentosService.generarPdf(docGenerado.id);
            contratoPdfUrl = docConPdf.url_pdf;
        }

        // 5. Insertar registro en contratos_personal
        const { data: newContract, error } = await supabase
            .from('contratos_personal')
            .insert({
                empleado_id: createDto.empleado_id,
                tipo_contrato: createDto.tipo_contrato,
                fecha_inicio: createDto.fecha_inicio,
                fecha_fin: createDto.fecha_fin || null,
                fecha_fin_prueba: createDto.fecha_fin_prueba || null,
                salario_id: createDto.salario_id,
                contrato_pdf_url: contratoPdfUrl,
                documento_generado_id: documentoGeneradoId,
                creado_por: userId,
                estado: 'activo',
                modalidad_trabajo: createDto.modalidad_trabajo || 'tiempo_completo',
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`Error creando contrato: ${error.message}`);
            throw new InternalServerErrorException('Error al crear el contrato');
        }

        // 6. Actualizar empleado (vinculación)
        await supabase
            .from('empleados')
            .update({
                contrato_personal_id: newContract.id,
            })
            .eq('id', createDto.empleado_id);

        // 7. Auditar
        await this.auditoriaService.create({
            tabla_afectada: 'contratos_personal',
            registro_id: newContract.id,
            accion: 'INSERT',
            datos_nuevos: newContract,
            usuario_id: userId,
        });

        return newContract;
    }

    // 🔹 Terminar contrato
    async terminate(terminateDto: TerminateContratoPersonalDto, userId: number, file?: any) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener contrato actual
        const { data: contract } = await supabase
            .from('contratos_personal')
            .select('*')
            .eq('id', terminateDto.contrato_id)
            .single();

        if (!contract) throw new NotFoundException('Contrato no encontrado');
        if (contract.estado !== 'activo') throw new BadRequestException('El contrato no está activo');

        let terminacionPdfUrl: string | null = null;

        // 2. Subir PDF si existe
        if (file) {
            const { data: empleado } = await supabase.from('empleados').select('cedula').eq('id', contract.empleado_id).single();
            if (!empleado) throw new NotFoundException('Empleado no encontrado para subir archivo');
            const path = `contratos_empleados/${empleado.cedula}_terminacion_${contract.id}.pdf`;
            terminacionPdfUrl = await this.uploadFile(file, 'empleados', path);
        }

        // 3. Actualizar contrato
        const { data: updatedContract, error } = await supabase
            .from('contratos_personal')
            .update({
                estado: 'terminado', // O 'finalizado'
                fecha_fin: terminateDto.fecha_terminacion, // Actualizamos la fecha fin real
                terminacion_pdf_url: terminacionPdfUrl,
                // motivo? No hay campo 'motivo' en la tabla contratos_personal según schema, 
                // pero podemos guardar en auditoría o si se agrega el campo.
                // Asumiendo que NO hay campo motivo en la tabla por ahora, lo dejamos solo en auditoría o log.
                // WAIT: Schema check: "motivo text" NO EXISTE en contratos_personal. Solo "terminacion_pdf_url".
            })
            .eq('id', terminateDto.contrato_id)
            .select()
            .single();

        if (error) throw new InternalServerErrorException('Error al terminar contrato');

        // 4. Desvincular empleado
        await supabase
            .from('empleados')
            .update({
                contrato_personal_id: null,
                activo: false, // Opcional: desactivar empleado al terminar contrato
                fecha_salida: terminateDto.fecha_terminacion // Si existiera en empleado, pero lo borramos.
                // Como borramos fecha_salida del empleado, no actualizamos nada más que el contrato_id
            })
            .eq('id', contract.empleado_id);

        // 5. Auditar
        await this.auditoriaService.create({
            tabla_afectada: 'contratos_personal',
            registro_id: contract.id,
            accion: 'UPDATE',
            datos_anteriores: contract,
            datos_nuevos: { ...updatedContract, motivo_terminacion: terminateDto.motivo_terminacion },
            usuario_id: userId,
        });

        return updatedContract;
    }

    // 🔹 Helper Subida
    private async uploadFile(file: any, bucket: string, path: string): Promise<string> {
        const supabase = this.supabaseService.getSupabaseAdminClient();
        const { error } = await supabase.storage
            .from(bucket)
            .upload(path, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
            });

        if (error) {
            this.logger.error(`Error uploading file: ${error.message}`);
            throw new InternalServerErrorException('Error subiendo archivo');
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    }

    // 🔹 Historial por empleado
    async getByEmpleado(empleadoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('contratos_personal')
            .select(`
              *,
              salario:salarios (nombre_salario, valor)
          `)
            .eq('empleado_id', empleadoId)
            .order('fecha_inicio', { ascending: false });

        if (error) throw error;
        return data;
    }

    // 🔹 Obtener Contrato por ID
    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('contratos_personal')
            .select(`
                *,
                salario:salarios(nombre_salario, valor),
                empleados!fk_contrato_empleado(nombre_completo, cedula)
            `)
            .eq('id', id)
            .single();

        if (error || !data) throw new NotFoundException('Contrato no encontrado');
        return data;
    }

    // 🔹 Actualizar Contrato (Datos no sensibles/legales estrictos)
    async update(id: number, dto: UpdateContratoPersonalDto, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: oldData } = await supabase.from('contratos_personal').select('*').eq('id', id).single();
        if (!oldData) throw new NotFoundException('Contrato no encontrado');

        const { data, error } = await supabase
            .from('contratos_personal')
            .update(dto)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'contratos_personal',
            registro_id: id,
            accion: 'UPDATE',
            datos_anteriores: oldData,
            datos_nuevos: data,
            usuario_id: userId
        });

        return data;
    }

    // 🔹 Renovar Contrato
    async renew(dto: RenovarContratoDto, userId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Validar contrato anterior
        const { data: oldContract } = await supabase.from('contratos_personal').select('*').eq('id', dto.contrato_anterior_id).single();
        if (!oldContract) throw new NotFoundException('Contrato anterior no encontrado');

        // 2. Terminar/Marcar como renovado el anterior
        await supabase
            .from('contratos_personal')
            .update({ estado: 'renovado', fecha_fin: dto.fecha_inicio })
            .eq('id', dto.contrato_anterior_id);

        // 3. Crear Nuevo Contrato
        const { data: newContract, error } = await supabase
            .from('contratos_personal')
            .insert({
                empleado_id: oldContract.empleado_id,
                tipo_contrato: dto.tipo_contrato,
                fecha_inicio: dto.fecha_inicio,
                fecha_fin: dto.fecha_fin,
                salario_id: dto.salario_id,
                contrato_anterior_id: oldContract.id,
                creado_por: userId,
                estado: 'activo'
            })
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);

        // 4. Actualizar Empleado
        await supabase
            .from('empleados')
            .update({ contrato_personal_id: newContract.id })
            .eq('id', oldContract.empleado_id);

        // 5. Auditar renovación
        await this.auditoriaService.create({
            tabla_afectada: 'contratos_personal',
            registro_id: newContract.id,
            accion: 'INSERT', // Renovacion
            datos_nuevos: newContract,
            usuario_id: userId
        });

        return newContract;
    }

    // 🔹 Contratos Activos
    async findActive() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('contratos_personal')
            .select(`
                *,
                empleados!fk_contrato_empleado(nombre_completo, cedula),
                salario:salarios(nombre_salario, valor)
            `)
            .eq('estado', 'activo');

        if (error) throw error;
        return data;
    }

    // 🔹 Contratos Inactivos/Vencidos
    async findInactive() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('contratos_personal')
            .select(`
                *,
                empleados!fk_contrato_empleado(nombre_completo, cedula),
                salario:salarios(nombre_salario, valor)
            `)
            .neq('estado', 'activo');

        if (error) throw error;
        return data;
    }

    // 🔹 Vencimientos Próximos (30 dias)
    async findExpiring(days: number = 30) {
        const supabase = this.supabaseService.getClient();
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        const { data, error } = await supabase
            .from('contratos_personal')
            .select(`
                *,
                empleados!fk_contrato_empleado(nombre_completo, cedula)
            `)
            .eq('estado', 'activo')
            .not('fecha_fin', 'is', null)
            .lte('fecha_fin', futureDate.toISOString().split('T')[0])
            .gte('fecha_fin', today.toISOString().split('T')[0]);

        if (error) throw error;
        return data;
    }

    // 🔹 Validar Vencidos (Job/Manual)
    async validateExpired(userId: number) {
        const supabase = this.supabaseService.getClient();
        const today = new Date().toISOString().split('T')[0];

        const { data: expired } = await supabase
            .from('contratos_personal')
            .select('id, fecha_fin')
            .eq('estado', 'activo')
            .lt('fecha_fin', today);

        if (!expired || expired.length === 0) return { message: 'No hay contratos vencidos por actualizar' };

        const ids = expired.map(c => c.id);

        const { error } = await supabase
            .from('contratos_personal')
            .update({ estado: 'finalizado' })
            .in('id', ids);

        if (error) throw new InternalServerErrorException('Error actualizando contratos vencidos');

        await this.auditoriaService.create({
            tabla_afectada: 'contratos_personal',
            registro_id: 0,
            accion: 'UPDATE', // Expired check
            datos_nuevos: { action: 'AUTO_EXPIRE', count: ids.length, ids },
            usuario_id: userId
        });

        return { message: `Se actualizaron ${ids.length} contratos a estado finalizado`, contratos: ids };
    }

    // 🔹 Eliminar Contrato
    async remove(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Verificar existencia
        const { data: contract } = await supabase.from('contratos_personal').select('*').eq('id', id).single();
        if (!contract) throw new NotFoundException('Contrato no encontrado');

        // 2. Verificar si está asignado a un empleado como activo
        const { data: empleado } = await supabase
            .from('empleados')
            .select('id, contrato_personal_id')
            .eq('contrato_personal_id', id)
            .single();

        // 3. Si está asignado, desvincular
        if (empleado) {
            await supabase
                .from('empleados')
                .update({ contrato_personal_id: null })
                .eq('id', empleado.id);
        }

        // 4. Eliminar
        const { error } = await supabase
            .from('contratos_personal')
            .delete()
            .eq('id', id);

        if (error) throw new InternalServerErrorException('Error al eliminar el contrato');

        // 5. Auditoría
        await this.auditoriaService.create({
            tabla_afectada: 'contratos_personal',
            registro_id: id,
            accion: 'DELETE',
            datos_anteriores: contract,
            usuario_id: userId
        });

        return { message: 'Contrato eliminado correctamente' };
    }

    // 🔹 Auditoria de Contrato
    async getAudit(contratoId: number) {
        return this.auditoriaService.getByRegistro('contratos_personal', contratoId);
    }
}
