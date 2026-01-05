import { Injectable, NotFoundException } from "@nestjs/common"
import { SupabaseService } from "../supabase/supabase.service"
import type { CreateMinutaDto, UpdateMinutaDto } from "./dto/minuta.dto"

@Injectable()
export class MinutasService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async findAll() {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("minutas")
      .select(`
        *,
        turnos(
          id,
          fecha,
          empleados(id, nombre_completo)
        ),
        puestos_trabajo(id, nombre, direccion),
        usuario_entrante:usuarios_externos!minutas_turno_entrante_fkey(id, nombre_completo),
        usuario_saliente:usuarios_externos!minutas_turno_saliente_fkey(id, nombre_completo)
      `)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("minutas")
      .select(`
        *,
        turnos(
          id,
          fecha,
          hora_inicio,
          hora_fin,
          empleados(id, nombre_completo, cedula)
        ),
        puestos_trabajo(id, nombre, direccion, ciudad),
        usuarios_externos!minutas_creada_por_fkey(id, nombre_completo),
        validado_por_usuario:usuarios_externos!minutas_validado_por_fkey(id, nombre_completo),
        usuario_entrante:usuarios_externos!minutas_turno_entrante_fkey(id, nombre_completo),
        usuario_saliente:usuarios_externos!minutas_turno_saliente_fkey(id, nombre_completo)
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      throw new NotFoundException(`Minuta con ID ${id} no encontrada`)
    }

    return data
  }

  async create(createMinutaDto: CreateMinutaDto, creadaPor: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("minutas")
      .insert({
        ...createMinutaDto,
        creada_por: creadaPor,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: number, updateMinutaDto: UpdateMinutaDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("minutas")
      .update({
        ...updateMinutaDto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Minuta con ID ${id} no encontrada`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("minutas").delete().eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Minuta con ID ${id} no encontrada`)
    }

    return { message: "Minuta eliminada exitosamente", data }
  }

  // =================================================================================================
  // 📸 GESTIÓN DE ARCHIVOS (FOTOS, VIDEOS, ADJUNTOS) - Múltiples archivos
  // =================================================================================================
  async addAdjuntos(id: number, files: Array<{ buffer: Buffer, originalname: string, mimetype: string }>) {
    if (!files || files.length === 0) {
      throw new NotFoundException('No se han subido archivos.');
    }

    const db = this.supabaseService.getClient();

    // 1. Obtener Minuta y Nombre del Puesto para la carpeta
    const { data: minuta } = await db
      .from('minutas')
      .select(`
            *,
            puesto:puesto_id ( nombre )
        `)
      .eq('id', id)
      .single();

    if (!minuta) throw new NotFoundException(`Minuta ${id} no encontrada`);

    const puestoNombre = minuta.puesto?.nombre || 'General';
    // Sanitizar nombre de carpeta (reemplazar espacios y caracteres especiales)
    const carpetaPuesto = puestoNombre.replace(/[^a-zA-Z0-9]/g, '_');
    const fechaCarpeta = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Explicitly type arrays as string[] to avoid 'never' inference
    const nuevasFotos: string[] = [];
    const nuevosVideos: string[] = [];
    const nuevosAdjuntos: string[] = [];
    const resultados: { nombre: string; url: string }[] = [];

    // 2. Procesar cada archivo
    for (const file of files) {
      const timestamp = Date.now();
      // const extension = file.originalname.split('.').pop();
      const nombreArchivo = `${timestamp}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const path = `minutas/${carpetaPuesto}/${fechaCarpeta}/${nombreArchivo}`;

      // Subir a Supabase
      const { error: uploadError } = await db.storage
        .from('minutas') // Bucket
        .upload(path, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error('Error subiendo archivo:', uploadError);
        continue; // Saltar archivo fallido
      }

      // Obtener URL Pública
      const { data: { publicUrl } } = db.storage
        .from('minutas')
        .getPublicUrl(path);

      resultados.push({ nombre: file.originalname, url: publicUrl });

      // Clasificar por tipo MIME
      if (file.mimetype.startsWith('image/')) {
        nuevasFotos.push(publicUrl);
      } else if (file.mimetype.startsWith('video/')) {
        nuevosVideos.push(publicUrl);
      } else {
        // PDF u otros
        nuevosAdjuntos.push(publicUrl);
      }
    }

    // 3. Actualizar Minuta (append a listas existentes)
    const updates: any = {};
    if (nuevasFotos.length > 0) {
      const fotosActuales = Array.isArray(minuta.fotos) ? minuta.fotos : [];
      updates.fotos = [...fotosActuales, ...nuevasFotos];
    }
    if (nuevosVideos.length > 0) {
      const videosActuales = Array.isArray(minuta.videos) ? minuta.videos : [];
      updates.videos = [...nuevosVideos, ...videosActuales]; // Prepend or Append? Append usually.
    }
    if (nuevosAdjuntos.length > 0) {
      const adjuntosActuales = Array.isArray(minuta.adjuntos) ? minuta.adjuntos : [];
      updates.adjuntos = [...adjuntosActuales, ...nuevosAdjuntos];
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await db
        .from('minutas')
        .update(updates)
        .eq('id', id);

      if (updateError) throw new NotFoundException('Error actualizando minuta con adjuntos: ' + updateError.message);
    }

    return {
      message: 'Archivos subidos correctamente',
      archivos: resultados,
      minuta_id: id
    };
  }
}
