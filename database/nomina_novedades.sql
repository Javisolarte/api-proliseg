-- TABLA DE NOVEDADES DE NOMINA
-- Esta tabla almacena registro de Novedades (Incapacidades, Licencias, Sanciones, Bonificaciones, Etc.)
-- Solicitada en requerimiento "2. Novedades (Horas Extras, Incapacidades, etc.) - REQUERIDO"

CREATE TABLE IF NOT EXISTS public.nomina_novedades (
    id integer GENERATED ALWAYS AS IDENTITY NOT NULL PRIMARY KEY,
    empleado_id integer NOT NULL REFERENCES public.empleados(id),
    periodo_id integer NOT NULL REFERENCES public.nomina_periodos(id),
    tipo character varying NOT NULL CHECK (tipo IN ('incapacidad_general', 'incapacidad_laboral', 'licencia_maternidad', 'licencia_paternidad', 'licencia_no_remunerada', 'licencia_remunerada', 'sancion', 'bonificacion', 'otro')), 
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    dias integer NOT NULL CHECK (dias >= 0),
    observacion text,
    created_at timestamp DEFAULT now(),
    creado_por integer REFERENCES public.usuarios_externos(id)
);

-- Indices para busqueda rapida
CREATE INDEX IF NOT EXISTS idx_nomina_novedades_periodo ON public.nomina_novedades(periodo_id);
CREATE INDEX IF NOT EXISTS idx_nomina_novedades_empleado ON public.nomina_novedades(empleado_id);
