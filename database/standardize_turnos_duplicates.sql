-- 1. Estandarizar tipo_turno basado en el concepto_id asignado previamente
UPDATE public.turnos t
SET tipo_turno = c.nombre
FROM public.conceptos_turno c
WHERE t.concepto_id = c.id;

-- 2. Eliminar turnos duplicados exactos (misma persona, mismo puesto, misma fecha y misma hora)
-- Se mantiene el registro más reciente según updated_at
DELETE FROM public.turnos
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY empleado_id, puesto_id, subpuesto_id, fecha, COALESCE(hora_inicio, '00:00:00')
             ORDER BY updated_at DESC, id DESC
           ) as row_num
    FROM public.turnos
  ) t
  WHERE t.row_num > 1
);

-- 3. Crear índice único restrictivo para evitar futuros duplicados
-- Garantiza que una persona no pueda tener dos turnos en el mismo subpuesto, el mismo día a la misma hora
DROP INDEX IF EXISTS idx_turnos_unico_empleado_fecha_hora;
CREATE UNIQUE INDEX idx_turnos_unico_empleado_fecha_hora 
ON public.turnos (empleado_id, subpuesto_id, fecha, COALESCE(hora_inicio, '00:00:00'));
