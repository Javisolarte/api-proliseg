-- Migration: Add Fixed Salary to Positions
-- Description: Adds a column to store the target monthly salary for a specific position.
-- Author: Antigravity

ALTER TABLE public.puestos_trabajo 
ADD COLUMN IF NOT EXISTS salario_fijo NUMERIC(15, 2) DEFAULT 0;

ALTER TABLE public.nomina_empleado
ADD COLUMN IF NOT EXISTS ajuste_salarial NUMERIC(15, 2) DEFAULT 0;

COMMENT ON COLUMN public.puestos_trabajo.salario_fijo IS 'Target monthly gross salary for employees assigned to this position.';
COMMENT ON COLUMN public.nomina_empleado.ajuste_salarial IS 'Adjustment to reach the fixed salary target of the position.';
