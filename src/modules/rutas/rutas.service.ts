import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateRutaGpsDto, CreateRecorridoSupervisorDto, CreateRondaRonderoDto } from "./dto/ruta.dto";

@Injectable()
export class RutasService {
    constructor(private readonly supabaseService: SupabaseService) { }

    // --- Rutas GPS ---
    async createRutaGps(createDto: CreateRutaGpsDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("rutas_gps").insert(createDto).select().single();
        if (error) throw error;
        return data;
    }

    async getRutasGps(empleadoId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("rutas_gps").select("*");
        if (empleadoId) query = query.eq("empleado_id", empleadoId);
        const { data, error } = await query.order("timestamp", { ascending: false });
        if (error) throw error;
        return data;
    }

    // --- Recorridos Supervisor ---
    async createRecorrido(createDto: CreateRecorridoSupervisorDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("recorridos_supervisor").insert(createDto).select().single();
        if (error) throw error;
        return data;
    }

    async getRecorridos(supervisorId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("recorridos_supervisor").select("*");
        if (supervisorId) query = query.eq("supervisor_id", supervisorId);
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }

    // --- Rondas Ronderos ---
    async createRonda(createDto: CreateRondaRonderoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("rondas_ronderos").insert(createDto).select().single();
        if (error) throw error;
        return data;
    }

    async getRondas(ronderoId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("rondas_ronderos").select("*");
        if (ronderoId) query = query.eq("rondero_id", ronderoId);
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }
}
