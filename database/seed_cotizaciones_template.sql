-- ========================================
-- PLANTILLA DE COTIZACIÓN PROLISEG (CORREGIDO)
-- ========================================
-- Tabla: plantillas_documentos

INSERT INTO plantillas_documentos (
    nombre,
    tipo,
    contenido_html,
    variables_requeridas,
    version,
    activa,
    creado_por,
    created_at,
    updated_at
) VALUES (
    'Propuesta Económica - Servicio de Vigilancia',
    'COTIZACION',
    '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Propuesta Económica - PROLISEG LTDA</title>
    <style>
        @page { margin: 2cm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: right;
            margin-bottom: 20px;
            font-size: 10pt;
        }
        .header .ciudad { font-weight: normal; }
        .destinatario {
            margin: 30px 0 20px 0;
        }
        .destinatario .empresa {
            font-weight: bold;
            font-size: 12pt;
            margin-bottom: 5px;
        }
        .referencia {
            margin: 15px 0;
            font-weight: 500;
        }
        .saludo {
            margin: 20px 0;
            text-align: justify;
        }
        .intro-text {
            margin: 15px 0;
            text-align: justify;
        }
        .propuesta-numero {
            text-align: center;
            font-weight: bold;
            margin: 25px 0;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 5px;
        }
        .servicios-table {
            width: 100%;
            margin: 25px 0;
            border-collapse: collapse;
            page-break-inside: avoid;
        }
        .servicios-table th {
            background: #2c3e50;
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 11pt;
            font-weight: 600;
        }
        .servicios-table td {
            padding: 15px 12px;
            border: 1px solid #ddd;
            vertical-align: top;
        }
        .servicios-table .servicio-desc {
            font-size: 10pt;
            line-height: 1.5;
        }
        .servicios-table .valor-col {
            text-align: right;
            font-weight: bold;
            font-size: 12pt;
            color: #2c3e50;
            white-space: nowrap;
        }
        .total-general {
            margin: 20px 0;
            padding: 15px;
            background: #e3f2fd;
            border-left: 4px solid #1976d2;
            text-align: right;
            font-size: 14pt;
            font-weight: bold;
            color: #1976d2;
        }
        .beneficios {
            margin: 30px 0;
            page-break-inside: avoid;
        }
        .beneficios-title {
            font-weight: bold;
            margin-bottom: 15px;
            font-size: 11pt;
            color: #2c3e50;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 5px;
        }
        .beneficios ul {
            list-style-type: none;
            padding-left: 0;
        }
        .beneficios li {
            padding: 6px 0 6px 20px;
            position: relative;
            font-size: 10pt;
        }
        .beneficios li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #27ae60;
            font-weight: bold;
            font-size: 12pt;
        }
        .asesor {
            margin-top: 50px;
            text-align: center;
        }
        .asesor .nombre {
            font-weight: bold;
            font-size: 11pt;
            margin-bottom: 3px;
        }
        .asesor .cargo {
            font-size: 10pt;
            color: #555;
            margin-bottom: 2px;
        }
        .asesor .telefono {
            font-size: 10pt;
            color: #1976d2;
            font-weight: 500;
        }
        .observaciones {
            margin: 25px 0;
            padding: 15px;
            background: #fff9e6;
            border-left: 4px solid #f39c12;
            font-size: 10pt;
            page-break-inside: avoid;
        }
        .observaciones strong {
            display: block;
            margin-bottom: 8px;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="ciudad">{{ciudad}}, {{fecha_formato}}</div>
    </div>

    <div class="destinatario">
        <div>Señores:</div>
        <div class="empresa">{{cliente_empresa}}</div>
        <div class="referencia"><strong>REF:</strong> Propuesta económica</div>
    </div>

    <div class="saludo">
        Cordial saludo.
    </div>

    <div class="intro-text">
        Es un gusto para nosotros poner a su consideración la presente propuesta para la seguridad privada:
    </div>

    <div class="propuesta-numero">
        PROPUESTA N.<br>
        {{numero_propuesta}}
    </div>

    <table class="servicios-table">
        <thead>
            <tr>
                <th>SERVICIO</th>
                <th style="width: 180px; text-align: right;">VALOR TOTAL MENSUAL DEL SERVICIO</th>
            </tr>
        </thead>
        <tbody>
            {{#each items}}
            <tr>
                <td>
                    <div class="servicio-desc">
                        <strong>{{this.descripcion}}</strong>
                        {{#if this.detalle}}
                        <br><span style="color: #666;">{{this.detalle}}</span>
                        {{/if}}
                    </div>
                </td>
                <td class="valor-col">$ {{this.total_formateado}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>

    {{#if mostrar_total}}
    <div class="total-general">
        TOTAL: $ {{total_formateado}}
    </div>
    {{/if}}

    <div class="beneficios">
        <div class="beneficios-title">El servicio contará con:</div>
        <ul>
            <li>Licencia de Funcionamiento expedida por la Superintendencia de Vigilancia y Seguridad Privada por 10 años, Resolución N.° 20224100058647 del 5 de septiembre de 2022.</li>
            <li>Estudio de seguridad</li>
            <li>Revisión y prevención de cámara de seguridad - cuando aplique</li>
            <li>Empresa 100 % nariñense.</li>
            <li>Con medios de comunicación y supervisión permanente</li>
            <li>Se cuenta con el diseño e implementación del SGSST.</li>
            <li>Empresa vinculada a la Red de Apoyo.</li>
            <li>Empresa afiliada al Frente de Seguridad Empresarial – SIJIN</li>
            <li>PROLISEG LTDA cuenta con personal altamente capacitado e idóneo para la prestación del servicio</li>
            <li>Acreditación del personal ante la Supervigilancia</li>
            <li>Seguimiento a través del sistema de Monitoreo 24/7 - cuando aplique</li>
            <li>Licencia de Comunicaciones con cuadro de frecuencias expedida por el MinTIC.</li>
            <li>Resolución de Horas Extras del Ministerio de Trabajo</li>
            <li>Paz y Salvo de la Superintendencia de Vigilancia y seguridad</li>
            <li>Paz y Salvo del Ministerio de Trabajo</li>
            <li>Medio de comunicación especializado para la prestación del servicio de seguridad ARMOR X10 PRO.</li>
        </ul>
    </div>

    {{#if observaciones}}
    <div class="observaciones">
        <strong>Observaciones:</strong>
        {{observaciones}}
    </div>
    {{/if}}

    <div class="asesor">
        <div class="nombre">{{asesor_nombre}}</div>
        <div class="cargo">ASESOR COMERCIAL</div>
        <div class="telefono">{{asesor_telefono}}</div>
    </div>
</body>
</html>',
    '["ciudad", "fecha_formato", "cliente_empresa", "numero_propuesta", "items", "mostrar_total", "total_formateado", "observaciones", "asesor_nombre", "asesor_telefono"]',
    1,
    TRUE,
    1,
    NOW(),
    NOW()
);

-- Plantilla Simplificada
INSERT INTO plantillas_documentos (
    nombre,
    tipo,
    contenido_html,
    variables_requeridas,
    version,
    activa,
    creado_por,
    created_at,
    updated_at
) VALUES (
    'Cotización Simple - Servicios Múltiples',
    'COTIZACION',
    '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; }
        .content { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #34495e; color: white; }
        .total { text-align: right; font-weight: bold; font-size: 14pt; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h2>PROLISEG LTDA</h2>
        <p>{{ciudad}} - {{fecha_formato}}</p>
    </div>
    <div class="content">
        <p><strong>Cliente:</strong> {{cliente_empresa}}</p>
        <p><strong>Propuesta:</strong> {{numero_propuesta}}</p>
        <h3>Servicios Cotizados</h3>
        <table>
            <thead>
                <tr>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th>Valor Unitario</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {{#each items}}
                <tr>
                    <td>{{this.descripcion}}</td>
                    <td>{{this.cantidad}}</td>
                    <td>$ {{this.valor_unitario_formateado}}</td>
                    <td>$ {{this.total_formateado}}</td>
                </tr>
                {{/each}}
            </tbody>
        </table>
        <div class="total">
            <p>Subtotal: $ {{subtotal_formateado}}</p>
            <p>IVA (19%): $ {{impuestos_formateado}}</p>
            <p><strong>TOTAL: $ {{total_formateado}}</strong></p>
        </div>
        {{#if observaciones}}
        <p><strong>Observaciones:</strong><br>{{observaciones}}</p>
        {{/if}}
        <p style="margin-top: 40px; text-align: center;">
            <strong>{{asesor_nombre}}</strong><br>
            Asesor Comercial<br>
            {{asesor_telefono}}
        </p>
    </div>
</body>
</html>',
    '["ciudad", "fecha_formato", "cliente_empresa", "numero_propuesta", "items", "subtotal_formateado", "impuestos_formateado", "total_formateado", "observaciones", "asesor_nombre", "asesor_telefono"]',
    1,
    TRUE,
    1,
    NOW(),
    NOW()
);

