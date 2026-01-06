import { Injectable, NotFoundException, Logger, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateGeocercaDto, UpdateGeocercaDto, EvaluarGPSDto, TipoGeocerca, CreateGeocercaVerticesDto } from "./dto/geocercas.dto";

@Injectable()
export class GeocercasService {
    private readonly logger = new Logger(GeocercasService.name);

    constructor(private readonly supabase: SupabaseService) { }

    /**
     * 🔹 1. CRUD de Geocercas
     */
    async create(dto: CreateGeocercaDto) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas")
            .insert({
                ...dto,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async findAll() {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) throw new NotFoundException(`Geocerca ID ${id} no encontrada`);
        return data;
    }

    async update(id: number, dto: UpdateGeocercaDto) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas")
            .update(dto)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async remove(id: number) {
        const db = this.supabase.getClient();
        const { error } = await db.from("geocercas").delete().eq("id", id);
        if (error) throw error;
        return { message: "Geocerca eliminada exitosamente" };
    }

    /**
     * 🔹 1.1 Detalle de Geocerca (Geometría Completa)
     */
    async getDetalle(id: number) {
        const db = this.supabase.getClient();
        const { data: geocerca, error } = await db
            .from("geocercas")
            .select("*, vertices:geocercas_vertices(*)")
            .eq("id", id)
            .order("orden", { foreignTable: "geocercas_vertices", ascending: true })
            .single();

        if (error || !geocerca) throw new NotFoundException(`Geocerca ID ${id} no encontrada`);

        const esPoligonal = geocerca.vertices && geocerca.vertices.length > 0;

        return {
            id: geocerca.id,
            nombre: geocerca.nombre,
            tipo: geocerca.tipo,
            forma: esPoligonal ? "poligono" : "circulo",
            radio_metros: esPoligonal ? null : geocerca.radio_metros,
            centro: esPoligonal ? null : { latitud: geocerca.latitud, longitud: geocerca.longitud },
            vertices: esPoligonal ? geocerca.vertices.map(v => ({ orden: v.orden, latitud: v.latitud, longitud: v.longitud })) : []
        };
    }

    /**
     * 🔹 2. Asociaciones
     */
    async asociarPuesto(geocercaId: number, puestoId: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas_puestos")
            .insert({ geocerca_id: geocercaId, puesto_id: puestoId })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async desasociarPuesto(geocercaId: number, puestoId: number) {
        const db = this.supabase.getClient();
        const { error } = await db
            .from("geocercas_puestos")
            .delete()
            .eq("geocerca_id", geocercaId)
            .eq("puesto_id", puestoId);
        if (error) throw error;
        return { message: "Asociación con puesto eliminada" };
    }

    async asociarRutaPunto(geocercaId: number, rutaPuntoId: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas_ruta_puntos")
            .insert({ geocerca_id: geocercaId, ruta_punto_id: rutaPuntoId })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async desasociarRutaPunto(geocercaId: number, rutaPuntoId: number) {
        const db = this.supabase.getClient();
        const { error } = await db
            .from("geocercas_ruta_puntos")
            .delete()
            .eq("geocerca_id", geocercaId)
            .eq("ruta_punto_id", rutaPuntoId);
        if (error) throw error;
        return { message: "Asociación con punto de ruta eliminada" };
    }

    /**
     * 🔹 3. Evaluación GPS (Clave para App Móvil)
     */
    async evaluar(dto: EvaluarGPSDto) {
        const db = this.supabase.getClient();

        // 1. Obtener todas las geocercas activas
        const { data: geocercas, error: geoError } = await db
            .from("geocercas")
            .select("*")
            .eq("activo", true);

        if (geoError) throw geoError;

        if (!geocercas || geocercas.length === 0) return { eventos: [] };

        // 1.1 Obtener todos los vértices de las geocercas activas
        const { data: todosVertices } = await db
            .from("geocercas_vertices")
            .select("*")
            .in("geocerca_id", geocercas!.map(g => g.id))
            .order("orden", { ascending: true });

        // Agrupar vértices por geocerca
        const verticesMap = new Map<number, any[]>();
        todosVertices?.forEach(v => {
            if (!verticesMap.has(v.geocerca_id)) verticesMap.set(v.geocerca_id, []);
            verticesMap.get(v.geocerca_id)!.push(v);
        });

        const eventosDisparados: { geocerca_id: number; evento: string }[] = [];

        // 2. Para cada geocerca, evaluar distancia o polígono
        for (const geo of geocercas) {
            const vertices = verticesMap.get(geo.id) || [];
            const esPoligonal = vertices.length >= 3;

            let estaDentroActualmente = false;

            if (esPoligonal) {
                estaDentroActualmente = this.isInsidePolygon(
                    { lat: dto.latitud, lng: dto.longitud },
                    vertices.map(v => ({ lat: v.latitud, lng: v.longitud }))
                );
            } else {
                const distancia = this.getDistanciaMetros(
                    dto.latitud,
                    dto.longitud,
                    geo.latitud,
                    geo.longitud
                );
                estaDentroActualmente = distancia <= (geo.radio_metros || 0);
            }

            // 3. Ver último evento de este empleado para esta geocerca
            const { data: ultimoEvento } = await db
                .from("geocercas_eventos")
                .select("evento")
                .eq("geocerca_id", geo.id)
                .eq("empleado_id", dto.empleado_id)
                .order("fecha", { ascending: false })
                .limit(1)
                .single();

            const ultimoEstado = ultimoEvento?.evento; // 'entrada' o 'salida'

            // 4. Lógica de entrada/salida
            if (estaDentroActualmente && ultimoEstado !== "entrada") {
                // ENTRADA detectada
                const evento = await this.registrarEvento(geo.id, dto.empleado_id, "entrada", dto.latitud, dto.longitud);
                eventosDisparados.push({ geocerca_id: geo.id, evento: "entrada" });
            } else if (!estaDentroActualmente && ultimoEstado === "entrada") {
                // SALIDA detectada
                const evento = await this.registrarEvento(geo.id, dto.empleado_id, "salida", dto.latitud, dto.longitud);
                eventosDisparados.push({ geocerca_id: geo.id, evento: "salida" });
            }
        }

        return { eventos: eventosDisparados };
    }

    /**
     * 🔹 Helpers privados
     */
    private async registrarEvento(geocercaId: number, empleadoId: number, tipo: "entrada" | "salida", lat: number, lng: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas_eventos")
            .insert({
                geocerca_id: geocercaId,
                empleado_id: empleadoId,
                evento: tipo,
                fecha: new Date().toISOString(),
                latitud: lat,
                longitud: lng
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`❌ Error registrando evento geocerca: ${error.message}`);
        }
        return data;
    }

    private getDistanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
        if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
        const R = 6371e3; // Radio de la tierra en metros
        const phi1 = lat1 * (Math.PI / 180);
        const phi2 = lat2 * (Math.PI / 180);
        const deltaPhi = (lat2 - lat1) * (Math.PI / 180);
        const deltaLambda = (lon2 - lon1) * (Math.PI / 180);

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    private isInsidePolygon(point: { lat: number; lng: number }, vs: { lat: number; lng: number }[]): boolean {
        const x = point.lat, y = point.lng;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].lat, yi = vs[i].lng;
            const xj = vs[j].lat, yj = vs[j].lng;
            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * 🔹 5. Gestión de Vértices
     */
    async addVertices(geocercaId: number, dto: CreateGeocercaVerticesDto) {
        const db = this.supabase.getClient();

        // Validar mínimo 3 vértices para polígono
        if (dto.vertices.length < 3) {
            throw new BadRequestException("Un polígono requiere al menos 3 vértices");
        }

        const vertices = dto.vertices.map(v => ({
            geocerca_id: geocercaId,
            ...v,
            created_at: new Date().toISOString()
        }));

        const { data, error } = await db
            .from("geocercas_vertices")
            .insert(vertices)
            .select();

        if (error) throw error;
        return data;
    }

    async replaceVertices(geocercaId: number, dto: CreateGeocercaVerticesDto) {
        const db = this.supabase.getClient();

        // 1. Eliminar anteriores
        await db.from("geocercas_vertices").delete().eq("geocerca_id", geocercaId);

        // 2. Insertar nuevos
        return this.addVertices(geocercaId, dto);
    }

    async getVertices(geocercaId: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas_vertices")
            .select("*")
            .eq("geocerca_id", geocercaId)
            .order("orden", { ascending: true });

        if (error) throw error;
        return data;
    }

    async removeVertice(verticeId: number) {
        const db = this.supabase.getClient();
        const { error } = await db.from("geocercas_vertices").delete().eq("id", verticeId);
        if (error) throw error;
        return { message: "Vértice eliminado" };
    }

    /**
     * 🔹 4. Consultas de Eventos
     */
    async getEventosGeocerca(geocercaId: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas_eventos")
            .select(`
        *,
        empleado:empleado_id(nombre_completo, cedula)
      `)
            .eq("geocerca_id", geocercaId)
            .order("fecha", { ascending: false });
        if (error) throw error;
        return data;
    }

    async getEventosEmpleado(empleadoId: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from("geocercas_eventos")
            .select(`
        *,
        geocerca:geocerca_id(nombre, tipo)
      `)
            .eq("empleado_id", empleadoId)
            .order("fecha", { ascending: false });
        if (error) throw error;
        return data;
    }
}
