import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RegistrarUbicacionDto, FilterUbicacionDto, MapaUbicacionDto } from './dto/ubicaciones.dto';

@Injectable()
export class UbicacionesService {
    private readonly logger = new Logger(UbicacionesService.name);

    constructor(private readonly supabase: SupabaseService) { }

    /**
     * 📍 1. Registrar Ubicación
     */
    async registrar(dto: RegistrarUbicacionDto) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('empleado_ubicaciones')
            .insert(dto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * 🕒 2. Última Ubicación
     */
    async getUltima(empleado_id: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('empleado_ubicaciones')
            .select('*')
            .eq('empleado_id', empleado_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (!data) throw new NotFoundException('No hay ubicaciones registradas para este empleado');

        return data;
    }

    /**
     * 📜 3. Historial (Replay)
     */
    async getHistorial(empleado_id: number, filters: FilterUbicacionDto) {
        const db = this.supabase.getClient();
        let query = db
            .from('empleado_ubicaciones')
            .select('*')
            .eq('empleado_id', empleado_id);

        if (filters.desde) query = query.gte('created_at', filters.desde);
        if (filters.hasta) query = query.lte('created_at', filters.hasta);

        const { data, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    }

    /**
     * 🔑 4. Ubicaciones por Sesión
     */
    async getBySesion(sesion_id: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('empleado_ubicaciones')
            .select('*')
            .eq('sesion_id', sesion_id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    }

    /**
     * 🗺️ 5. Ubicaciones en Rango (Mapa)
     */
    async getMapa(dto: MapaUbicacionDto) {
        const db = this.supabase.getClient();

        // Bounding box approximation (assuming 111km per degree)
        const radioDegrees = dto.radio / 111000;
        const latMin = dto.lat - radioDegrees;
        const latMax = dto.lat + radioDegrees;
        const lngMin = dto.lng - radioDegrees;
        const lngMax = dto.lng + radioDegrees;

        const { data, error } = await db
            .from('empleado_ubicaciones')
            .select(`
        *,
        empleado:empleado_id(nombre_completo, rol)
      `)
            .gte('latitud', latMin)
            .lte('latitud', latMax)
            .gte('longitud', lngMin)
            .lte('longitud', lngMax)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // De-duplicate by employee to show only latest position of each
        const latestPositions = new Map();
        for (const pos of data) {
            if (!latestPositions.has(pos.empleado_id)) {
                latestPositions.set(pos.empleado_id, pos);
            }
        }

        return Array.from(latestPositions.values());
    }

    /**
     * 🚨 6. Vincular a Botón de Pánico (Interno)
     */
    async vincularPanico(dto: any) {
        return this.registrar({
            ...dto,
            evento: 'boton_panico'
        });
    }
}
