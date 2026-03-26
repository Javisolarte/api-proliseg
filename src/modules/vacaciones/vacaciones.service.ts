import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateVacacionDto, UpdateVacacionDto } from './dto/vacaciones.dto';

@Injectable()
export class VacacionesService {
  private readonly logger = new Logger(VacacionesService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('vacaciones')
      .select('*, empleado:empleado_id(nombre_completo, cedula)')
      .order('fecha_inicio', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findByEmpleado(empleadoId: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('vacaciones')
      .select('*')
      .eq('empleado_id', empleadoId)
      .order('fecha_inicio', { ascending: false });

    if (error) throw error;
    return data;
  }

  async create(dto: CreateVacacionDto, userId?: number) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    const payload = { ...dto, creado_por: userId };
    
    const { data, error } = await supabase
      .from('vacaciones')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: number, dto: UpdateVacacionDto) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('vacaciones')
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
      .from('vacaciones')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }

  /**
   * 📅 Calcula las próximas vacaciones sugeridas basadas en la fecha de ingreso
   * (Aproximadamente cada 12 meses de trabajo)
   */
  async getProximasVacacionesSugeridas() {
    const supabase = this.supabaseService.getClient();
    
    // Obtenemos empleados con su fecha de ingreso (desde contratos_personal)
    const { data: empleados, error } = await supabase
      .from('empleados')
      .select(`
        id, 
        nombre_completo,
        contratos_personal!inner(fecha_inicio)
      `)
      .eq('activo', true);

    if (error) throw error;

    const hoy = new Date();
    const sugerencias = empleados.map(emp => {
      const fechaIngreso = new Date((emp as any).contratos_personal.fecha_inicio);
      const mesesTrabajados = (hoy.getFullYear() - fechaIngreso.getFullYear()) * 12 + (hoy.getMonth() - fechaIngreso.getMonth());
      const periodosCumplidos = Math.floor(mesesTrabajados / 12);
      
      // La próxima fecha aniversario
      const proximoAniversario = new Date(fechaIngreso);
      proximoAniversario.setFullYear(fechaIngreso.getFullYear() + periodosCumplidos + 1);

      return {
        empleado_id: emp.id,
        nombre_completo: emp.nombre_completo,
        fecha_ingreso: (emp as any).contratos_personal.fecha_inicio,
        periodos_cumplidos: periodosCumplidos,
        proximo_aniversario: proximoAniversario.toISOString().split('T')[0],
        dias_para_aniversario: Math.ceil((proximoAniversario.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
      };
    }).filter(s => s.dias_para_aniversario <= 60); // Sugerir las que faltan 60 días o menos

    return sugerencias.sort((a, b) => a.dias_para_aniversario - b.dias_para_aniversario);
  }
}
