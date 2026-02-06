-- Mejora de esquema para módulo de Visitas
-- Agregando soporte para origen de solicitud y reporte vinculado

ALTER TABLE public.visitas_tecnicas_puesto 
ADD COLUMN IF NOT EXISTS solicitado_por_tipo text DEFAULT 'usuario', -- 'usuario' | 'cliente'
ADD COLUMN IF NOT EXISTS solicitado_por_id integer,
ADD COLUMN IF NOT EXISTS documento_generado_id integer REFERENCES public.documentos_generados(id);

-- Semilla para la plantilla del Acta de Visita
INSERT INTO public.plantillas_documentos (nombre, tipo, contenido_html, variables_requeridas, version, activa)
VALUES (
    'ACTA DE VISITA Y SUPERVISIÓN',
    'acta_visita',
    '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.5; color: #333;">
        <div style="text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #4f46e5;">PROLISEG LTDA</h2>
            <h3 style="margin: 5px 0; color: #666;">ACTA DE VISITA Y SUPERVISIÓN DE PUESTO</h3>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
            <div><strong>CIUDAD:</strong> {{ciudad}}</div>
            <div><strong>FECHA:</strong> {{fecha}}</div>
        </div>

        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4f46e5;">
            <h4 style="margin: 0 0 10px 0;">INFORMACIÓN GENERAL</h4>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="width: 30%; font-weight: bold;">PUESTO:</td><td>{{puesto}}</td></tr>
                <tr><td style="font-weight: bold;">SUPERVISOR:</td><td>{{supervisor}}</td></tr>
                <tr><td style="font-weight: bold;">SOLICITADO POR:</td><td>{{solicitado_por}}</td></tr>
            </table>
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">RESULTADOS Y OBSERVACIONES</h4>
            <div style="min-height: 150px; padding: 10px; border: 1px solid #eee; border-radius: 4px; background: #fff;">
                {{observaciones}}
            </div>
        </div>

        <div style="margin-top: 50px; display: flex; justify-content: space-between;">
            <div style="width: 45%; text-align: center;">
                <div style="min-height: 80px; border-bottom: 1px solid #000;">{{firma_1}}</div>
                <p style="margin-top: 5px;"><strong>Firma Supervisor/Visitante</strong><br>{{nombre_supervisor}}</p>
            </div>
            <div style="width: 45%; text-align: center;">
                <div style="min-height: 80px; border-bottom: 1px solid #000;">{{firma_2}}</div>
                <p style="margin-top: 5px;"><strong>Quien Recibe la Visita</strong><br>{{nombre_recibe}}</p>
            </div>
        </div>

        <div style="margin-top: 30px; font-size: 10px; text-align: center; color: #999;">
            Documento generado electrónicamente por PROLISEG PLATAFORMA - {{fecha}}
        </div>
    </div>',
    '["ciudad", "fecha", "puesto", "supervisor", "solicitado_por", "observaciones", "nombre_supervisor", "nombre_recibe"]'::jsonb,
    1,
    true
);
