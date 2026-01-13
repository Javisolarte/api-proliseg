-- ============================================
-- MEJORA: Trigger para desactivar asignaciones cuando cambia el turno
-- ============================================
-- Este trigger maneja tanto DELETE (hard delete) como UPDATE (soft delete)

-- OPCIÓN 1: Si usas columna 'activo' o 'estado' en turnos para soft delete
CREATE OR REPLACE FUNCTION desactivar_asignacion_en_cambio_turno()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el turno se marca como inactivo/eliminado
  IF TG_OP = 'UPDATE' THEN
    -- Ajusta esto según tu lógica de soft delete
    -- Ejemplo 1: Si tienes columna 'activo' en turnos
    IF OLD.activo = true AND NEW.activo = false THEN
      UPDATE rutas_supervision_asignacion
      SET activo = false
      WHERE turno_id = NEW.id;
      
      RAISE NOTICE 'Asignaciones desactivadas para turno % (soft delete)', NEW.id;
    END IF;
    
    -- Ejemplo 2: Si tienes columna 'estado' en turnos
    -- IF OLD.estado != 'cancelado' AND NEW.estado = 'cancelado' THEN
    --   UPDATE rutas_supervision_asignacion
    --   SET activo = false
    --   WHERE turno_id = NEW.id;
    -- END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger en UPDATE
DROP TRIGGER IF EXISTS trigger_desactivar_asignacion_en_update ON turnos;

CREATE TRIGGER trigger_desactivar_asignacion_en_update
AFTER UPDATE ON turnos
FOR EACH ROW
EXECUTE FUNCTION desactivar_asignacion_en_cambio_turno();

-- ============================================
-- OPCIONAL: Trigger para cuando se cambia el empleado del turno
-- ============================================
CREATE OR REPLACE FUNCTION reasignar_ruta_en_cambio_empleado()
RETURNS TRIGGER AS $$
DECLARE
  v_nuevo_rol VARCHAR;
  v_viejo_rol VARCHAR;
BEGIN
  -- Solo si cambió el empleado_id
  IF OLD.empleado_id != NEW.empleado_id THEN
    -- Obtener roles
    SELECT rol INTO v_viejo_rol FROM empleados WHERE id = OLD.empleado_id;
    SELECT rol INTO v_nuevo_rol FROM empleados WHERE id = NEW.empleado_id;
    
    -- Si el turno cambió de un supervisor a otro empleado (no supervisor)
    IF v_viejo_rol = 'supervisor' AND v_nuevo_rol != 'supervisor' THEN
      -- Desactivar asignación anterior
      UPDATE rutas_supervision_asignacion
      SET activo = false
      WHERE turno_id = NEW.id;
      
      RAISE NOTICE 'Turno % cambió de supervisor a no-supervisor, asignación desactivada', NEW.id;
    END IF;
    
    -- Si cambió de empleado no-supervisor a supervisor
    IF v_viejo_rol != 'supervisor' AND v_nuevo_rol = 'supervisor' THEN
      -- Crear nueva asignación (reutilizar función existente)
      -- El trigger de INSERT se encargará si es necesario
      RAISE NOTICE 'Turno % cambió a supervisor, crear asignación manualmente si es necesario', NEW.id;
    END IF;
    
    -- Si cambió de supervisor a otro supervisor
    IF v_viejo_rol = 'supervisor' AND v_nuevo_rol = 'supervisor' THEN
      -- Actualizar la asignación con el nuevo supervisor
      UPDATE rutas_supervision_asignacion
      SET supervisor_id = NEW.empleado_id
      WHERE turno_id = NEW.id AND activo = true;
      
      RAISE NOTICE 'Turno % cambió de supervisor, asignación actualizada', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para cambio de empleado
DROP TRIGGER IF EXISTS trigger_reasignar_en_cambio_empleado ON turnos;

CREATE TRIGGER trigger_reasignar_en_cambio_empleado
AFTER UPDATE ON turnos
FOR EACH ROW
WHEN (OLD.empleado_id != NEW.empleado_id)
EXECUTE FUNCTION reasignar_ruta_en_cambio_empleado();

-- ============================================
-- PRUEBA: Verificar que funciona
-- ============================================
/*
-- Desactivar un turno (soft delete)
UPDATE turnos SET activo = false WHERE id = 10645;

-- Verificar que la asignación se desactivó
SELECT * FROM rutas_supervision_asignacion WHERE turno_id = 10645;
-- Debería mostrar activo = false

-- Reactivar
UPDATE turnos SET activo = true WHERE id = 10645;
*/

-- ============================================
-- CONSULTA: Ver estructura actual de tabla turnos
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'turnos' 
  AND column_name IN ('activo', 'estado', 'deleted_at')
ORDER BY column_name;
-- Esto te ayudará a saber qué columna usas para soft delete
