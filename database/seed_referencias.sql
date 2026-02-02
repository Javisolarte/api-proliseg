-- Plantilla para Verificación de Referencias
INSERT INTO public.plantillas_documentos (nombre, tipo, contenido_html, variables_requeridas, version, activa)
VALUES 
(
    'Verificación de Referencias Laborales y Personales',
    'referencia',
    '<div style="font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto;">
        <!-- Encabezado -->
        <table style="width: 100%; border: 2px solid #000; margin-bottom: 20px;">
            <tr>
                <td style="padding: 10px; border-right: 1px solid #000; width: 50%;"><strong>FECHA:</strong> {{fecha}}</td>
                <td style="padding: 10px;"><strong>CARGO A OCUPAR:</strong> {{cargo_ocupar}}</td>
            </tr>
            <tr>
                <td colspan="2" style="padding: 10px; border-top: 1px solid #000;"><strong>NOMBRE DEL CANDIDATO:</strong> {{nombre_candidato}}</td>
            </tr>
        </table>

        <!-- Referencias Laborales -->
        <div style="background-color: #d3d3d3; padding: 8px; text-align: center; margin: 20px 0;">
            <strong>REFERENCIAS LABORALES:</strong>
        </div>

        {{#referencias_laborales}}
        <table style="width: 100%; border: 1px solid #000; margin-bottom: 15px;">
            <tr>
                <td style="padding: 5px; border: 1px solid #000;"><strong>EMPRESA:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{empresa}}</td>
            </tr>
            <tr>
                <td style="padding: 5px; border: 1px solid #000;"><strong>JEFE INMEDIATO:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{jefe_inmediato}}</td>
            </tr>
            <tr>
                <td style="padding: 5px; border: 1px solid #000;"><strong>CARGO:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{cargo}}</td>
            </tr>
            <tr>
                <td style="padding: 5px; border: 1px solid #000;"><strong>TIEMPO LABORADO:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{tiempo_laborado}}</td>
            </tr>
            <tr>
                <td style="padding: 5px; border: 1px solid #000;"><strong>MOTIVO DE RETIRO:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{motivo_retiro}}</td>
            </tr>
            <tr>
                <td style="padding: 5px; border: 1px solid #000;"><strong>CONCEPTO:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{concepto}}</td>
            </tr>
        </table>
        {{/referencias_laborales}}

        <!-- Referencias Personales -->
        <div style="background-color: #d3d3d3; padding: 8px; text-align: center; margin: 20px 0;">
            <strong>REFERENCIAS PERSONALES:</strong>
        </div>

        {{#referencias_personales}}
        <table style="width: 100%; border: 1px solid #000; margin-bottom: 15px;">
            <tr>
                <td style="padding: 5px; border: 1px solid #000; width: 30%;"><strong>NOMBRE:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{nombre}}</td>
            </tr>
            <tr>
                <td style="padding: 5px; border: 1px solid #000;"><strong>TIPO DE RELACIÓN:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{tipo_relacion}}</td>
            </tr>
            <tr>
                <td style="padding: 5px; border: 1px solid #000;"><strong>TELÉFONO:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{telefono}}</td>
            </tr>
            <tr>
                <td style="padding: 5px; border: 1px solid #000;"><strong>CONCEPTO:</strong></td>
                <td style="padding: 5px; border: 1px solid #000;">{{concepto}}</td>
            </tr>
        </table>
        {{/referencias_personales}}

        <!-- Hallazgos Relevantes -->
        <div style="background-color: #d3d3d3; padding: 8px; text-align: center; margin: 20px 0;">
            <strong>HALLAZGOS RELEVANTES</strong>
        </div>
        <table style="width: 100%; border: 1px solid #000; margin-bottom: 20px;">
            <tr>
                <td style="padding: 10px; min-height: 80px;">{{hallazgos}}</td>
            </tr>
            <tr>
                <td style="padding: 10px; min-height: 60px;">{{conclusiones}}</td>
            </tr>
        </table>

        <!-- Firma -->
        <div style="margin-top: 50px; text-align: center;">
            <div style="border-top: 2px solid #000; width: 300px; margin: 0 auto; padding-top: 10px;">
                <p style="margin: 5px 0;"><strong>Responsable Verificación:</strong> {{responsable_nombre}}</p>
                <p style="margin: 5px 0;">Firma: _______________________</p>
            </div>
        </div>
    </div>',
    '["fecha", "cargo_ocupar", "nombre_candidato", "referencias_laborales", "referencias_personales", "hallazgos", "conclusiones", "responsable_nombre"]'::jsonb,
    1,
    true
);
