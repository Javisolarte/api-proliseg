-- ============================================================
-- ACTUALIZACIÓN NÓMINA: APROVISIONAMIENTO / COSTO EMPRESA
-- Ejecutar este script para agregar las columnas de provisiones
-- ============================================================

ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_prima numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_cesantias numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_intereses_cesantias numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_vacaciones numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS provision_pension_empleador numeric DEFAULT 0;
ALTER TABLE public.nomina_empleado ADD COLUMN IF NOT EXISTS costo_total_empresa numeric DEFAULT 0;
