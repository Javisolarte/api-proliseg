-- ============================================================
-- MIGRACIÓN NÓMINA COLOMBIA 2026
-- Parámetros legales, festivos, tablas de nómina
-- ============================================================

-- 1. TABLA DE PERIODOS
CREATE TABLE IF NOT EXISTS public.nomina_periodos (
  id SERIAL PRIMARY KEY,
  anio integer NOT NULL,
  mes integer NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  cerrado boolean DEFAULT false,
  total_devengado numeric DEFAULT 0,
  total_deducciones numeric DEFAULT 0,
  total_pagar numeric DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT nomina_periodos_unique UNIQUE (anio, mes)
);

-- 2. TABLA DE VALORES/PARÁMETROS POR AÑO
CREATE TABLE IF NOT EXISTS public.nomina_valores_hora (
  id SERIAL PRIMARY KEY,
  anio integer NOT NULL,
  tipo character varying NOT NULL,
  multiplicador numeric NOT NULL DEFAULT 0,
  descripcion text,
  activo boolean DEFAULT true,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- 3. TABLA DE DEDUCCIONES CONFIGURABLES
CREATE TABLE IF NOT EXISTS public.nomina_deducciones (
  id SERIAL PRIMARY KEY,
  nombre character varying NOT NULL,
  tipo character varying NOT NULL DEFAULT 'porcentaje',
  valor numeric NOT NULL DEFAULT 0,
  aplica_a character varying DEFAULT 'ibc',
  activo boolean DEFAULT true,
  es_obligatoria boolean DEFAULT false,
  porcentaje_empleado numeric DEFAULT 0,
  porcentaje_empleador numeric DEFAULT 0,
  descripcion text,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- 4. TABLA DE NÓMINA POR EMPLEADO
CREATE TABLE IF NOT EXISTS public.nomina_empleado (
  id SERIAL PRIMARY KEY,
  empleado_id integer NOT NULL,
  periodo_id integer NOT NULL,
  contrato_id integer,
  salario_id integer,
  -- Conteo de turnos
  turnos_diurnos integer DEFAULT 0,
  turnos_nocturnos integer DEFAULT 0,
  turnos_descanso integer DEFAULT 0,
  turnos_pnr integer DEFAULT 0,
  turnos_licencia integer DEFAULT 0,
  turnos_vacaciones integer DEFAULT 0,
  turnos_incapacidad integer DEFAULT 0,
  turnos_sancion integer DEFAULT 0,
  -- Horas ordinarias
  horas_ordinarias_diurnas numeric DEFAULT 0,
  horas_ordinarias_nocturnas numeric DEFAULT 0,
  horas_dominical_diurnas numeric DEFAULT 0,
  horas_dominical_nocturnas numeric DEFAULT 0,
  horas_festiva_diurnas numeric DEFAULT 0,
  horas_festiva_nocturnas numeric DEFAULT 0,
  -- Horas extras
  horas_extra_diurnas numeric DEFAULT 0,
  horas_extra_nocturnas numeric DEFAULT 0,
  horas_extra_dominical_diurnas numeric DEFAULT 0,
  horas_extra_dominical_nocturnas numeric DEFAULT 0,
  horas_extra_festiva_diurnas numeric DEFAULT 0,
  horas_extra_festiva_nocturnas numeric DEFAULT 0,
  -- Valores
  salario_base_valor numeric DEFAULT 0,
  salario_devengado numeric DEFAULT 0,
  descuento_pnr numeric DEFAULT 0,
  descuento_sancion numeric DEFAULT 0,
  valor_licencia numeric DEFAULT 0,
  valor_vacaciones numeric DEFAULT 0,
  valor_incapacidad numeric DEFAULT 0,
  -- Recargos
  recargo_nocturno_valor numeric DEFAULT 0,
  recargo_dominical_valor numeric DEFAULT 0,
  recargo_festivo_valor numeric DEFAULT 0,
  recargo_nocturno_dominical_valor numeric DEFAULT 0,
  recargo_nocturno_festivo_valor numeric DEFAULT 0,
  -- Extras
  valor_he_diurna numeric DEFAULT 0,
  valor_he_nocturna numeric DEFAULT 0,
  valor_he_dominical_diurna numeric DEFAULT 0,
  valor_he_dominical_nocturna numeric DEFAULT 0,
  valor_he_festiva_diurna numeric DEFAULT 0,
  valor_he_festiva_nocturna numeric DEFAULT 0,
  -- Auxilio
  auxilio_transporte_valor numeric DEFAULT 0,
  -- Totales
  total_recargos numeric DEFAULT 0,
  total_horas_extra numeric DEFAULT 0,
  total_devengado numeric DEFAULT 0,
  ibc numeric DEFAULT 0,
  total_deducciones numeric DEFAULT 0,
  deduccion_salud numeric DEFAULT 0,
  deduccion_pension numeric DEFAULT 0,
  deducciones_otras numeric DEFAULT 0,
  total_pagar numeric DEFAULT 0,
  -- Meta
  horas_normales numeric DEFAULT 0,
  horas_dominicales numeric DEFAULT 0,
  generado boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT nomina_empleado_pkey PRIMARY KEY (id),
  CONSTRAINT nomina_empleado_empleado_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT nomina_empleado_periodo_fkey FOREIGN KEY (periodo_id) REFERENCES public.nomina_periodos(id)
);

-- 5. DETALLE DEDUCCIONES POR EMPLEADO
CREATE TABLE IF NOT EXISTS public.nomina_empleado_deducciones (
  id SERIAL PRIMARY KEY,
  nomina_empleado_id integer NOT NULL,
  deduccion_id integer NOT NULL,
  valor_calculado numeric DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT ned_nomina_fkey FOREIGN KEY (nomina_empleado_id) REFERENCES public.nomina_empleado(id) ON DELETE CASCADE,
  CONSTRAINT ned_deduccion_fkey FOREIGN KEY (deduccion_id) REFERENCES public.nomina_deducciones(id)
);

-- 6. NOVEDADES DE NÓMINA
CREATE TABLE IF NOT EXISTS public.nomina_novedades (
  id SERIAL PRIMARY KEY,
  empleado_id integer NOT NULL,
  periodo_id integer NOT NULL,
  tipo character varying NOT NULL,
  fecha_inicio date,
  fecha_fin date,
  dias integer DEFAULT 0,
  valor numeric DEFAULT 0,
  observacion text,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT nn_empleado_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT nn_periodo_fkey FOREIGN KEY (periodo_id) REFERENCES public.nomina_periodos(id)
);

-- 7. FESTIVOS COLOMBIA
CREATE TABLE IF NOT EXISTS public.nomina_festivos_colombia (
  id SERIAL PRIMARY KEY,
  fecha date NOT NULL,
  nombre character varying NOT NULL,
  anio integer NOT NULL,
  tipo character varying DEFAULT 'fijo',
  CONSTRAINT nfc_unique UNIQUE (fecha)
);

-- ============================================================
-- INSERTAR FESTIVOS COLOMBIA 2026
-- ============================================================
DELETE FROM public.nomina_festivos_colombia WHERE anio = 2026;

INSERT INTO public.nomina_festivos_colombia (fecha, nombre, anio, tipo) VALUES
  ('2026-01-01', 'Año Nuevo', 2026, 'fijo'),
  ('2026-01-12', 'Día de los Reyes Magos', 2026, 'emiliani'),
  ('2026-03-23', 'Día de San José', 2026, 'emiliani'),
  ('2026-04-02', 'Jueves Santo', 2026, 'religioso'),
  ('2026-04-03', 'Viernes Santo', 2026, 'religioso'),
  ('2026-05-01', 'Día del Trabajo', 2026, 'fijo'),
  ('2026-05-18', 'Ascensión del Señor', 2026, 'emiliani'),
  ('2026-06-08', 'Corpus Christi', 2026, 'emiliani'),
  ('2026-06-15', 'Sagrado Corazón de Jesús', 2026, 'emiliani'),
  ('2026-06-29', 'San Pedro y San Pablo', 2026, 'emiliani'),
  ('2026-07-20', 'Día de la Independencia', 2026, 'fijo'),
  ('2026-08-07', 'Batalla de Boyacá', 2026, 'fijo'),
  ('2026-08-17', 'Asunción de la Virgen', 2026, 'emiliani'),
  ('2026-10-12', 'Día de la Raza', 2026, 'emiliani'),
  ('2026-11-02', 'Día de Todos los Santos', 2026, 'emiliani'),
  ('2026-11-16', 'Independencia de Cartagena', 2026, 'emiliani'),
  ('2026-12-08', 'Inmaculada Concepción', 2026, 'fijo'),
  ('2026-12-25', 'Navidad', 2026, 'fijo');

-- ============================================================
-- INSERTAR PARÁMETROS LEGALES COLOMBIA 2026
-- ============================================================

-- Eliminar restricción de CHECK en tipo (la tabla existente tiene valores limitados)
ALTER TABLE public.nomina_valores_hora DROP CONSTRAINT IF EXISTS nomina_valores_hora_tipo_check;

-- Agregar columnas que pueden faltar en la tabla existente
ALTER TABLE public.nomina_valores_hora ADD COLUMN IF NOT EXISTS creado_por integer;

DELETE FROM public.nomina_valores_hora WHERE anio = 2026;


INSERT INTO public.nomina_valores_hora (anio, tipo, multiplicador, descripcion, activo) VALUES
  -- Base salarial
  (2026, 'salario_minimo', 1750905, 'Salario Mínimo Legal Mensual Vigente 2026', true),
  (2026, 'auxilio_transporte', 249095, 'Auxilio de Transporte 2026', true),
  (2026, 'tope_auxilio_transporte_smlmv', 2, 'Tope en SMLMV para auxilio de transporte', true),
  (2026, 'jornada_maxima_semanal', 44, 'Jornada máxima legal semanal (horas)', true),
  -- Recargos (sobre hora ordinaria - % adicional)
  (2026, 'recargo_nocturno', 0.35, 'Recargo nocturno 35% (Art 168 CST)', true),
  (2026, 'recargo_dominical_festivo', 0.80, 'Recargo dominical/festivo 80% (Ene-Jun 2026)', true),
  (2026, 'recargo_nocturno_dominical', 1.15, 'Recargo nocturno en dominical/festivo 115%', true),
  -- Horas extras (factor total sobre hora ordinaria)
  (2026, 'hora_extra_diurna', 1.25, 'Hora extra diurna 25% recargo', true),
  (2026, 'hora_extra_nocturna', 1.80, 'Hora extra nocturna 80% recargo', true),
  (2026, 'hora_extra_dominical_diurna', 2.05, 'Hora extra diurna dominical/festivo 105% recargo', true),
  (2026, 'hora_extra_dominical_nocturna', 2.55, 'Hora extra nocturna dominical/festivo 155% recargo', true),
  -- Seguridad Social - Salud
  (2026, 'salud_total', 12.5, 'Salud total 12.5%', true),
  (2026, 'salud_empleador', 8.5, 'Salud empleador 8.5%', true),
  (2026, 'salud_empleado', 4.0, 'Salud empleado 4%', true),
  -- Seguridad Social - Pensión
  (2026, 'pension_total', 16, 'Pensión total 16%', true),
  (2026, 'pension_empleador', 12, 'Pensión empleador 12%', true),
  (2026, 'pension_empleado', 4.0, 'Pensión empleado 4%', true),
  -- Parafiscales (cargo del empleador)
  (2026, 'parafiscal_sena', 2, 'SENA 2% (Exonerado Art 114-1 ET)', false),
  (2026, 'parafiscal_icbf', 3, 'ICBF 3% (Exonerado Art 114-1 ET)', false),
  (2026, 'parafiscal_caja', 4, 'Cajas de Compensación 4%', true),
  -- Prestaciones sociales
  (2026, 'cesantias', 8.33, 'Cesantías 8.33%', true),
  (2026, 'prima_servicios', 8.33, 'Prima de servicios 8.33%', true),
  (2026, 'vacaciones', 4.17, 'Vacaciones 4.17%', true),
  (2026, 'intereses_cesantias', 12, 'Intereses sobre cesantías 12% anual', true),
  -- Horarios legales (en horas, 24h format)
  (2026, 'hora_diurna_inicio', 6, 'Inicio jornada diurna 6:00', true),
  (2026, 'hora_diurna_fin', 19, 'Fin jornada diurna 19:00 (Ley 2101/2021)', true);

-- ============================================================
-- INSERTAR DEDUCCIONES OBLIGATORIAS
-- ============================================================

-- Eliminar restricción de CHECK en aplica_a
ALTER TABLE public.nomina_deducciones DROP CONSTRAINT IF EXISTS nomina_deducciones_aplica_a_check;
ALTER TABLE public.nomina_deducciones DROP CONSTRAINT IF EXISTS nomina_deducciones_tipo_check;

-- Agregar columnas nuevas a nomina_deducciones si no existen
ALTER TABLE public.nomina_deducciones ADD COLUMN IF NOT EXISTS es_obligatoria boolean DEFAULT false;
ALTER TABLE public.nomina_deducciones ADD COLUMN IF NOT EXISTS porcentaje_empleado numeric DEFAULT 0;
ALTER TABLE public.nomina_deducciones ADD COLUMN IF NOT EXISTS porcentaje_empleador numeric DEFAULT 0;
ALTER TABLE public.nomina_deducciones ADD COLUMN IF NOT EXISTS descripcion text;
ALTER TABLE public.nomina_deducciones ADD COLUMN IF NOT EXISTS creado_por integer;

DELETE FROM public.nomina_deducciones WHERE es_obligatoria = true;


INSERT INTO public.nomina_deducciones (nombre, tipo, valor, aplica_a, activo, es_obligatoria, porcentaje_empleado, porcentaje_empleador, descripcion) VALUES
  ('Salud', 'porcentaje', 12.5, 'ibc', true, true, 4.0, 8.5, 'EPS - Se descuenta 4% al empleado'),
  ('Pensión', 'porcentaje', 16, 'ibc', true, true, 4.0, 12.0, 'Pensión AFP - Se descuenta 4% al empleado');
