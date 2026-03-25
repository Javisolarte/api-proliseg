-- ============================================================
-- SQL MIGRATION: FIX NOMINA_EMPLEADO SCHEMA
-- Run this in Supabase SQL Editor to add missing columns
-- ============================================================

-- 1. Count Columns (Informational)
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_hora numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS ajuste_salarial numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS ibc numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS generado boolean DEFAULT false;

-- 2. Ensure all other calculated columns exist
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS turnos_diurnos integer DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS turnos_nocturnos integer DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS turnos_descanso integer DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS turnos_pnr integer DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS turnos_licencia integer DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS turnos_vacaciones integer DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS turnos_incapacidad integer DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS turnos_sancion integer DEFAULT 0;

ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_ordinarias_diurnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_ordinarias_nocturnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_dominical_diurnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_dominical_nocturnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_festiva_diurnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_festiva_nocturnas numeric DEFAULT 0;

ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_extra_diurnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_extra_nocturnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_extra_dominical_diurnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_extra_dominical_nocturnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_extra_festiva_diurnas numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS horas_extra_festiva_nocturnas numeric DEFAULT 0;

ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS salario_base_valor numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS salario_devengado numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS descuento_pnr numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS descuento_sancion numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_licencia numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_vacaciones numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_incapacidad numeric DEFAULT 0;

ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS recargo_nocturno_valor numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS recargo_dominical_valor numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS recargo_festivo_valor numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS recargo_nocturno_dominical_valor numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS recargo_nocturno_festivo_valor numeric DEFAULT 0;

ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_he_diurna numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_he_nocturna numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_he_dominical_diurna numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_he_dominical_nocturna numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_he_festiva_diurna numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS valor_he_festiva_nocturna numeric DEFAULT 0;

ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS auxilio_transporte_valor numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS total_recargos numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS total_horas_extra numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS total_devengado numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS total_deducciones numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS deduccion_salud numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS deduccion_pension numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS deducciones_otras numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS total_pagar numeric DEFAULT 0;

-- Costo Empresa
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_prima numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_cesantias numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_intereses_cesantias numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_vacaciones numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_pension_empleador numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS costo_total_empresa numeric DEFAULT 0;

-- 3. CRITICAL: RELOAD SCHEMA CACHE
NOTIFY pgrst, reload schema;
