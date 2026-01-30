import { Injectable, NotFoundException, Logger, BadRequestException, ConflictException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateResidenteDto, UpdateResidenteDto, CreateResidenteVehiculoDto } from "./dto/residente.dto";

@Injectable()
export class ResidentesService {
    private readonly logger = new Logger(ResidentesService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createDto: CreateResidenteDto) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Validación de Duplicados (Documento + Unidad + Cliente)
            const { data: existing } = await supabase
                .from("residentes")
                .select("id")
                .eq("cliente_id", createDto.cliente_id)
                .eq("documento", createDto.documento)
                .eq("torre_bloque", createDto.torre_bloque)
                .eq("apto_casa", createDto.apto_casa)
                .single();

            if (existing) {
                throw new ConflictException("Este residente ya existe en esa unidad inmobiliaria");
            }

            // 2. Regla: Solo un Propietario/Principal por unidad (si aplica)
            // Asumiremos que 'propietario' es el principal.
            if (createDto.tipo_habitante === 'propietario') {
                // Verificar si ya hay propietario en esa unidad
                /* Nota: Un apto puede tener múltiples propietarios, pero si la regla es 
                   "Solo uno principal", necesitaríamos un flag "es_principal". 
                   Usaremos 'tipo_habitante' = 'propietario' con precaución. 
                   Si se quiere estricto único: */
                /*
                const { count } = await supabase.from("residentes")
                  .select("*", { count: "exact", head: true })
                  .eq("cliente_id", createDto.cliente_id)
                  .eq("torre_bloque", createDto.torre_bloque)
                  .eq("apto_casa", createDto.apto_casa)
                  .eq("tipo_habitante", 'propietario');
                
                if (count > 0) throw new ConflictException("Ya existe un propietario registrado para esta unidad");
                */
            }

            const { data, error } = await supabase
                .from("residentes")
                .insert({
                    ...createDto,
                    activo: true // Por defecto activo
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error crear residente");
            return data;
        } catch (error) {
            this.logger.error("Error create:", error);
            throw error;
        }
    }

    async update(id: number, updateDto: UpdateResidenteDto) {
        try {
            const supabase = this.supabaseService.getClient();

            // Si se desactiva residente, verificar implicaciones
            if (updateDto.activo === false) {
                // Regla: Si activo = false -> NO autoriza visitas (esto se valida en modulo visitas)
                this.logger.log(`Residente ${id} desactivado. Se bloquearán sus autorizaciones.`);
            }

            const { data, error } = await supabase
                .from("residentes")
                .update({ ...updateDto, updated_at: new Date().toISOString() })
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException();
            return data;
        } catch (e) { throw e; }
    }

    // ... métodos find (findAll, findOne, getVehiculos, createVehiculo) se mantienen 
    // pero asegurando que createVehiculo valide si el residente existe y está activo.

    async createVehiculo(dto: CreateResidenteVehiculoDto) {
        const supabase = this.supabaseService.getClient();
        // Validar residente activo
        const { data: res } = await supabase.from("residentes").select("activo").eq("id", dto.residente_id).single();
        if (!res || !res.activo) throw new BadRequestException("No se puede registrar vehiculo a residente inactivo");

        const { data, error } = await supabase.from("residentes_vehiculos").insert(dto).select().single();
        if (error) throw new BadRequestException();
        return data;
    }

    async findAll(filters?: any) { /* ... */
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("residentes").select("*");
        if (filters?.puesto_id) query = query.eq("puesto_id", filters.puesto_id);
        const { data } = await query; return data || [];
    }
    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("residentes").select("*").eq("id", id).single();
        if (error) throw new NotFoundException();
        return data;
    }
    async getVehiculos(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase.from("residentes_vehiculos").select("*").eq("residente_id", id);
        return data || [];
    }
}
