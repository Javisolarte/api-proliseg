-- Semilla para plantilla especializada de Búsqueda de Antecedentes (FIXED JSONB)
-- Incluye placeholders para firmas de Empleado y Jefe de Gestión Humana

INSERT INTO public.plantillas_documentos (nombre, tipo, contenido_html, variables_requeridas, version, activa)
VALUES 
(
    'AUTORIZACION PERSONAL PARA BUSQUEDAS EN LAS DIFERENTES BASES DE DATOS, PUBLICA',
    'autorizacion_busqueda',
    '<div style="font-family: ''Times New Roman'', Times, serif; padding: 40px; line-height: 1.6; text-align: justify; color: #000;">
        <h3 style="text-align: center; text-decoration: underline; font-weight: bold; margin-bottom: 30px;">
            CERTIFICACION DE AUTORIZACION PERSONAL PARA BUSQUEDAS EN LAS DIFERENTES BASES DE DATOS, PUBLICA, SEMIPRIVADA Y PRIVADA, COMO REQUISITO DE PROCEDIBILIDAD EN EL PROCESO DE ADMISION PARA ASIGNACION DE UN CARGO LABORAL PARA DESEMPEÑAR EN LA EMPRESA PROLISEG LTDA 2026
        </h3>

        <p>
            En la ciudad de <strong>{{ciudad_pasto}}</strong> a los <strong>{{dia}}</strong> días del mes de <strong>{{mes}}</strong> de 2026, al momento de la presentación formal de la hoja de vida, con el objeto de iniciar proceso de admisión ante la empresa Proliseg LTDA con el objeto de postularme para el desempeño de un cargo laboral en la empresa de razón social Profesionales y lideres de la seguridad, yo <strong>{{nombre_empleado}}</strong> Identificado con la cedula de ciudadanía número <strong>{{cedula_empleado}}</strong> expedida en <strong>{{expedida_en}}</strong>, autorizo de manera personal mediante la firma en la presente certificación de autorización para la búsqueda de mi información que reposa en las diferentes bases de datos publica, semiprivada y privada a fin de efectuar la verificación por parte de su empresa con el propósito de la admisión de personal calificado.
        </p>

        <p>
            Es menester hacer alusión que por parte de la empresa de razón social PROFESIONALES Y LIDERES DE LA SEGURIDAD, se dará el uso y procedimiento establecido al dato o información que resulte de la presente búsqueda en las diferentes bases de datos, con el objeto de no vulnerar Derechos Fundamentales al Titular de la información como lo establece la Norma Superior en sus artículos 15 y 20, los cuales son regulados a través de la leyes 1266 de 2008, 1581 de 2012, decreto 1377 de 2013 y 1712 de 2014, de igual manera se tendrá presente las jurisprudencias emitidas por la Honorable corte Constitucional que versan sobre el presente tema de las cuales se citan algunas de ellas; Sentencia C - 1011 de 2008, Sentencia T- 284 de 2008, Sentencia T- 129 de 2010, Sentencia T- 277 de 2015.
        </p>

        <p>
            Por lo anterior nuestra empresa PROLISEG LTDA dará aplicabilidad al uso y manejo del dato y la información de la persona aquí relacionada quien da expresa autorización para efectuar las verificaciones y consulta de la información que aporta a través de los documentos anexos a la hoja de vida dejando constancia que el presente procedimiento se ajusta a las políticas de la empresa para ser aplicado a los procesos de admisión.
        </p>

        <br><br><br>

        <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div style="width: 45%; text-align: center;">
                <div style="min-height: 100px; border-bottom: 1px solid #000; margin-bottom: 10px;">
                    {{firma_1}}
                </div>
                <strong>__________________________</strong><br>
                <strong>Quien autoriza</strong><br>
                <span>C.C. {{cedula_empleado}}</span>
            </div>
            <div style="width: 45%; text-align: center;">
                <div style="min-height: 100px; border-bottom: 1px solid #000; margin-bottom: 10px;">
                    {{firma_2}}
                </div>
                <strong>____________________________</strong><br>
                <strong>Jefe gestión humana</strong><br>
                <span>PROLISEG LTDA</span>
            </div>
        </div>
    </div>',
    '["ciudad_pasto", "dia", "mes", "nombre_empleado", "cedula_empleado", "expedida_en"]'::jsonb,
    1,
    true
);
