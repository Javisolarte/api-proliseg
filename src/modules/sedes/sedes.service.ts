import { Injectable, NotFoundException, InternalServerErrorException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateSedeDto, UpdateSedeDto } from "./dto/sede.dto";

@Injectable()
export class SedesService {
    private readonly logger = new Logger(SedesService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("sedes").select("*").order("created_at", { ascending: false });

        if (error) {
            this.logger.error(`Error al obtener sedes: ${JSON.stringify(error)}`);
            throw new InternalServerErrorException("Error al obtener sedes de la base de datos");
        }
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("sedes").select("*").eq("id", id).single();

        if (error || !data) {
            if (error) this.logger.error(`Error al obtener sede ${id}: ${JSON.stringify(error)}`);
            throw new NotFoundException(`Sede con ID ${id} no encontrada`);
        }
        return data;
    }

    async create(createSedeDto: CreateSedeDto) {
        const supabase = this.supabaseService.getClient();
        this.logger.log(`Intentando crear sede: ${JSON.stringify(createSedeDto)}`);

        const { data, error } = await supabase.from("sedes").insert(createSedeDto).select().single();

        if (error) {
            this.logger.error(`Error al crear sede: ${JSON.stringify(error)}`);
            throw new InternalServerErrorException({
                message: "Error al crear la sede en la base de datos",
                error: error.message,
                detail: error.details,
                code: error.code
            });
        }
        return data;
    }

    async update(id: number, updateSedeDto: UpdateSedeDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("sedes").update(updateSedeDto).eq("id", id).select().single();

        if (error || !data) {
            if (error) this.logger.error(`Error al actualizar sede ${id}: ${JSON.stringify(error)}`);
            throw new NotFoundException(`Sede con ID ${id} no encontrada o error al actualizar`);
        }
        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("sedes").delete().eq("id", id).select().single();

        if (error || !data) {
            if (error) this.logger.error(`Error al eliminar sede ${id}: ${JSON.stringify(error)}`);
            throw new NotFoundException(`Sede con ID ${id} no encontrada o error al eliminar`);
        }
        return { message: "Sede eliminada exitosamente", data };
    }
}
