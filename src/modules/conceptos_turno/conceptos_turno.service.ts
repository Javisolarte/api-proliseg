import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateConceptoTurnoDto, UpdateConceptoTurnoDto } from './dto/conceptos_turno.dto';

@Injectable()
export class ConceptosTurnoService {
  private readonly logger = new Logger(ConceptosTurnoService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('conceptos_turno')
      .select('*')
      .order('codigo', { ascending: true });

    if (error) throw error;
    return data;
  }

  async findByCodigo(codigo: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('conceptos_turno')
      .select('*')
      .eq('codigo', codigo)
      .single();

    if (error) throw error;
    return data;
  }

  async create(dto: CreateConceptoTurnoDto) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('conceptos_turno')
      .insert(dto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: number, dto: UpdateConceptoTurnoDto) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('conceptos_turno')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    const { error } = await supabase
      .from('conceptos_turno')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }
}
