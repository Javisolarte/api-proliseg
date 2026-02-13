import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateReporteDto, UpdateReporteDto } from "./dto/reporte.dto";
import * as puppeteer from 'puppeteer';
import { Response } from 'express';

@Injectable()
export class ReportesService {
    private readonly logger = new Logger(ReportesService.name);
    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createReporteDto: CreateReporteDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("reportes").insert(createReporteDto).select().single();
        if (error) throw error;
        return data;
    }

    async generarReporteOperativo(puesto_id: number, fecha_inicio: string, fecha_fin: string) {
        const db = this.supabaseService.getClient();

        // 1. Obtener información del Puesto
        const { data: puesto } = await db.from('puestos_trabajo').select('nombre, cliente:cliente_id(nombre_comercial)').eq('id', puesto_id).single();

        // 2. Asistencias (Entry/Exit)
        // Link via Turnos -> Subpuestos -> Puesto
        // Or using historic table 'asistencias' if it has 'puesto_id' (legacy) or join
        // Let's use 'turnos_asistencia' joined with 'turnos' filtered by date and puesto
        const { data: asistencias } = await db
            .from('turnos_asistencia')
            .select(`
                *,
                empleado:empleado_id(nombre_completo),
                turno:turno_id!inner(
                    subpuesto:subpuesto_id!inner(puesto_id)
                )
            `)
            .eq('turno.subpuesto.puesto_id', puesto_id)
            .gte('hora_entrada', fecha_inicio)
            .lte('hora_entrada', fecha_fin);

        // 3. Rondas (Minutas tipo 'ronda')
        // Minutas table has puesto_id directly
        const { data: rondas } = await db
            .from('minutas')
            .select('*')
            .eq('puesto_id', puesto_id)
            .eq('tipo', 'ronda')
            .gte('created_at', fecha_inicio)
            .lte('created_at', fecha_fin);

        // 4. Novedades (Incidentes)
        // Novedades usually link to turno or directly puesto?
        // Let's assume linkage via turno or direct if schema evolved.
        // Assuming direct puesto link or join
        const { data: novedades } = await db
            .from('novedades')
            .select('*, turnos!inner( subpuesto:subpuesto_id!inner(puesto_id) )')
            .eq('turnos.subpuesto.puesto_id', puesto_id)
            .gte('fecha_hora', fecha_inicio)
            .lte('fecha_hora', fecha_fin);

        // 5. Visitantes (Access Log)
        // 'visitas_registro' table
        const { data: visitas } = await db
            .from('visitas_registro')
            .select('*, visitante:visitante_id(nombre_completo)')
            .eq('puesto_id', puesto_id)
            .gte('fecha_entrada', fecha_inicio)
            .lte('fecha_entrada', fecha_fin);

        // Aggregation
        return {
            meta: {
                puesto: puesto?.nombre,
                cliente: (puesto?.cliente as any)?.nombre_comercial,
                rango: { inicio: fecha_inicio, fin: fecha_fin },
                generado_el: new Date().toISOString()
            },
            resumen: {
                total_asistencias: asistencias?.length || 0,
                total_rondas: rondas?.length || 0,
                total_novedades: novedades?.length || 0,
                total_visitas: visitas?.length || 0
            },
            detalle: {
                asistencias: asistencias?.map(a => ({
                    empleado: (a.empleado as any)?.nombre_completo,
                    entrada: a.hora_entrada,
                    salida: a.hora_salida,
                    estado: a.estado_asistencia
                })),
                rondas: rondas?.map(r => ({
                    titulo: r.titulo,
                    hora: r.hora,
                    contenido: r.contenido,
                    guardia: r.creada_por // id
                })),
                novedades: novedades?.map(n => ({
                    tipo: n.tipo_novedad,
                    descripcion: n.descripcion,
                    fecha: n.fecha_hora
                }))
            }
        };
    }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("reportes")
            .select(`
        *,
        usuarios_externos(id, nombre_completo)
      `)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("reportes").select("*").eq("id", id).single();
        if (error || !data) throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
        return data;
    }

    async update(id: number, updateReporteDto: UpdateReporteDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("reportes")
            .update(updateReporteDto)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("reportes").delete().eq("id", id).select().single();
        if (error) throw error;
        return { message: "Reporte eliminado", data };
    }

    async exportEmpleadosPDF(res: Response) {
        try {
            const db = this.supabaseService.getClient();

            // 1. Obtener datos de empleados con joins necesarios
            const sql = `
                SELECT e.nombre_completo, e.cedula, e.direccion, e.telefono,
                       e.formacion_academica, e.experiencia, e.rol,
                       cp.tipo_contrato,
                       s.valor as sueldo,
                       p.nombre as puesto_nombre
                FROM empleados e
                LEFT JOIN contratos_personal cp ON e.contrato_personal_id = cp.id
                LEFT JOIN salarios s ON cp.salario_id = s.id
                LEFT JOIN asignacion_guardas_puesto agp ON e.id = agp.empleado_id AND agp.activo = true
                LEFT JOIN puestos_trabajo p ON agp.puesto_id = p.id
                WHERE e.activo = true
                ORDER BY e.nombre_completo ASC
            `;

            const { data: empleados, error } = await db.rpc("exec_sql", { query: sql });
            if (error) throw error;

            // 2. Construir HTML
            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Helvetica', sans-serif; color: #333; margin: 0; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #1a237e; padding-bottom: 10px; margin-bottom: 20px; }
                    .header h1 { color: #1a237e; margin: 0; font-size: 24px; }
                    .header p { margin: 5px 0; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
                    th { background-color: #1a237e; color: white; padding: 10px; text-align: left; }
                    td { border-bottom: 1px solid #ddd; padding: 8px; vertical-align: top; }
                    tr:nth-child(even) { background-color: #f5f5f5; }
                    .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #eee; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>PROLISEG LTDA</h1>
                    <p>Reporte General de Empleados Activos</p>
                    <p>Fecha de generación: ${new Date().toLocaleDateString('es-CO')}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Nombre Completo</th>
                            <th>Identificación</th>
                            <th>Contacto / Dirección</th>
                            <th>Formación / Experiencia</th>
                            <th>Puesto / Cargo</th>
                            <th>Contrato / Sueldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(empleados as any[]).map(emp => `
                            <tr>
                                <td><strong>${emp.nombre_completo}</strong></td>
                                <td>${emp.cedula}</td>
                                <td>
                                    ${emp.telefono || 'N/A'}<br>
                                    <small>${emp.direccion || 'N/A'}</small>
                                </td>
                                <td>
                                    <strong>Formación:</strong> ${emp.formacion_academica || 'N/A'}<br>
                                    <strong>Exp:</strong> ${emp.experiencia || 'N/A'}
                                </td>
                                <td>
                                    <strong>${emp.rol || 'N/A'}</strong><br>
                                    Puesto: ${emp.puesto_nombre || 'Sin asignar'}
                                </td>
                                <td>
                                    Tipo: ${emp.tipo_contrato || 'N/A'}<br>
                                    Sueldo: $${emp.sueldo ? Number(emp.sueldo).toLocaleString('es-CO') : '0'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    PROLISEG LTDA - Sistema de Gestión de Personal
                </div>
            </body>
            </html>
            `;

            // 3. Renderizar con Puppeteer
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'Letter',
                landscape: true,
                printBackground: true,
                margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' }
            });

            await browser.close();

            // 4. Enviar respuesta
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=reporte_empleados.pdf');
            res.send(Buffer.from(pdfBuffer));

        } catch (error) {
            this.logger.error('Error generando reporte de empleados:', error);
            res.status(500).json({ message: 'Error al generar el reporte PDF', error: error.message });
        }
    }
}
