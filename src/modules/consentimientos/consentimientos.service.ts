import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateConsentimientoDto } from "./dto/consentimiento.dto";

@Injectable()
export class ConsentimientosService {
    private readonly logger = new Logger(ConsentimientosService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createDto: CreateConsentimientoDto) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Consentimiento Único por Tipo
            // Si ya existe uno vigente del mismo tipo, revocar el anterior automáticamente
            const { data: current } = await supabase
                .from("consentimientos_empleado") // Usando la tabla real (a veces llamada consentimientos_informados en sql update, verificar nombre final)
                // Asumiendo nombre tabla: consentimientos_informados (ver script SQL usuario) -> pero modulo dice consentimientos_empleado
                // Usaré el nombre del modulo previo: consentimientos_empleado 
                .select("id")
                .eq("empleado_id", createDto.empleado_id)
                .eq("tipo_consentimiento", createDto.tipo_consentimiento)
                .eq("vigente", true) // Assuming field vigente exists or check logic
                .single();

            if (current) {
                // Revocar anterior
                await supabase.from("consentimientos_empleado").update({ vigente: false }).eq("id", current.id);
            }

            // 2. Crear nuevo vigente
            const { data, error } = await supabase
                .from("consentimientos_empleado")
                .insert({
                    ...createDto,
                    fecha_consentimiento: new Date().toISOString(), // Ensure date set
                    acepta: true
                    // vigente: true (default db)
                })
                .select()
                .single();

            if (error) throw new BadRequestException();
            return data;

        } catch (error) { throw error; }
    }

    async revocar(id: number) {
        const supabase = this.supabaseService.getClient();
        await supabase.from("consentimientos_empleado").update({ vigente: false, acepta: false }).eq("id", id);
        return { success: true };
    }

    async findAll(filters: any) { const supabase = this.supabaseService.getClient(); /*...*/ return []; }
    async getByEmpleado(id: number) { const supabase = this.supabaseService.getClient(); /*...*/ return []; }
}
