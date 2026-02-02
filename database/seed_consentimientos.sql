-- Semilla para plantillas de consentimientos (FIXED JSONB)
-- Ejecutar en la base de datos para tener opciones en el dropdown

INSERT INTO public.plantillas_documentos (nombre, tipo, contenido_html, variables_requeridas, version, activa)
VALUES 
(
    'Consentimiento Informado General',
    'consentimiento',
    '<div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center;">CONSENTIMIENTO INFORMADO</h2>
        <p>Yo, <strong>{{nombre_empleado}}</strong>, identificado con cédula de ciudadanía número <strong>{{cedula_empleado}}</strong>, declaro que he sido informado sobre las condiciones laborales y acepto los términos del presente acuerdo.</p>
        <p>Fecha: {{fecha}}</p>
        <br><br>
        <div style="margin-top: 50px;">
            <p>__________________________</p>
            <p>Firma del Empleado</p>
        </div>
    </div>',
    '["nombre_empleado", "cedula_empleado", "fecha"]'::jsonb,
    1,
    true
),
(
    'Autorización Búsqueda Antecedentes',
    'autorizacion_busqueda',
    '<div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center;">AUTORIZACIÓN BÚSQUEDA DE ANTECEDENTES</h2>
        <p>Por medio del presente documento, autorizo a <strong>PROLISEG</strong> a realizar las consultas pertinentes en bases de datos de antecedentes judiciales, disciplinarios y fiscales.</p>
        <p>Nombre: {{nombre_empleado}}</p>
        <p>Cédula: {{cedula_empleado}}</p>
        <p>Fecha: {{fecha}}</p>
        <br><br>
        <div style="margin-top: 50px;">
            <p>__________________________</p>
            <p>Firma y Huella</p>
            {{huella_1}}
        </div>
    </div>',
    '["nombre_empleado", "cedula_empleado", "fecha"]'::jsonb,
    1,
    true
),
(
    'Autorización Tratamiento de Datos',
    'autorizacion_datos',
    '<div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center;">AUTORIZACIÓN TRATAMIENTO DE DATOS PERSONALES</h2>
        <p>Autorizo de manera voluntaria, previa, explícita, informada e inequívoca a <strong>PROLISEG</strong> para tratar mis datos personales de acuerdo con la Política de Tratamiento de Datos Personales de la compañía.</p>
        <p>Titular: {{nombre_empleado}}</p>
        <p>ID: {{cedula_empleado}}</p>
        <br><br>
        <div style="margin-top: 50px;">
            <p>__________________________</p>
            <p>Firma</p>
        </div>
    </div>',
    '["nombre_empleado", "cedula_empleado"]'::jsonb,
    1,
    true
);
