-- ============================================
-- MIGRACIÓN: Sistema de Asignación Automática de Supervisores a Rutas
-- Fecha: 2026-01-12
-- Descripción: Agrega tipo_turno a rutas_supervision y crea triggers automáticos
-- ============================================

-- PASO 1: Agregar columna tipo_turno a rutas_supervision
ALTER TABLE rutas_supervision 
ADD COLUMN tipo_turno character varying;

-- PASO 2: Actualizar rutas existentes según convención de nombres
UPDATE rutas_supervision 
SET tipo_turno = 'diurno' 
WHERE nombre ILIKE '%dia%' OR nombre ILIKE '%diurn%';

UPDATE rutas_supervision 
SET tipo_turno = 'nocturno' 
WHERE nombre ILIKE '%noche%' OR nombre ILIKE '%nocturn%';

-- PASO 3: Crear índice para mejorar rendimiento
CREATE INDEX idx_rutas_supervision_tipo_turno ON rutas_supervision(tipo_turno);
CREATE INDEX idx_rutas_supervision_activa ON rutas_supervision(activa);

-- ============================================
-- FUNCIÓN: Asignar supervisor a ruta automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION asignar_supervisor_a_ruta()
RETURNS TRIGGER AS $$
DECLARE
  v_ruta_id INTEGER;
  v_vehiculo_id INTEGER;
  v_es_supervisor BOOLEAN;
  v_rol_empleado VARCHAR;
  v_asignacion_existente INTEGER;
BEGIN
  -- 1. Verificar si el empleado es supervisor
  SELECT rol INTO v_rol_empleado
  FROM empleados
  WHERE id = NEW.empleado_id;
  
  v_es_supervisor := (v_rol_empleado = 'supervisor');
  
  -- Si no es supervisor, no hacer nada
  IF NOT v_es_supervisor THEN
    RAISE NOTICE 'Empleado % no es supervisor (rol: %), no se asigna ruta', NEW.empleado_id, v_rol_empleado;
    RETURN NEW;
  END IF;
  
  -- 2. Verificar si ya existe una asignación para este turno
  SELECT id INTO v_asignacion_existente
  FROM rutas_supervision_asignacion
  WHERE turno_id = NEW.id
    AND activo = true
  LIMIT 1;
  
  IF v_asignacion_existente IS NOT NULL THEN
    RAISE NOTICE 'El turno % ya tiene una asignación activa (ID: %)', NEW.id, v_asignacion_existente;
    RETURN NEW;
  END IF;
  
  -- 3. Buscar ruta según tipo de turno
  SELECT id INTO v_ruta_id
  FROM rutas_supervision
  WHERE tipo_turno = NEW.tipo_turno
    AND activa = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Si no encuentra ruta, registrar warning
  IF v_ruta_id IS NULL THEN
    RAISE WARNING 'No se encontró ruta activa para tipo_turno: % (empleado: %, turno: %)', 
                  NEW.tipo_turno, NEW.empleado_id, NEW.id;
    RETURN NEW;
  END IF;
  
  -- 4. Buscar vehículo asignado al supervisor
  SELECT vehiculo_id INTO v_vehiculo_id
  FROM supervisor_vehiculos
  WHERE supervisor_id = NEW.empleado_id
    AND activo = true
  ORDER BY fecha_asignacion DESC
  LIMIT 1;
  
  IF v_vehiculo_id IS NULL THEN
    RAISE NOTICE 'Supervisor % no tiene vehículo asignado, se asignará ruta sin vehículo', NEW.empleado_id;
  END IF;
  
  -- 5. Crear asignación de ruta
  INSERT INTO rutas_supervision_asignacion (
    ruta_id,
    turno_id,
    supervisor_id,
    vehiculo_id,
    activo,
    created_at
  ) VALUES (
    v_ruta_id,
    NEW.id,
    NEW.empleado_id,
    v_vehiculo_id,
    true,
    NOW()
  );
  
  RAISE NOTICE 'Asignación creada: Ruta % -> Supervisor % (Turno: %, Vehículo: %)', 
               v_ruta_id, NEW.empleado_id, NEW.id, COALESCE(v_vehiculo_id::text, 'N/A');
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error al asignar ruta para turno %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Ejecutar asignación automática al insertar turno
-- ============================================
DROP TRIGGER IF EXISTS trigger_asignar_supervisor_ruta ON turnos;

CREATE TRIGGER trigger_asignar_supervisor_ruta
AFTER INSERT ON turnos
FOR EACH ROW
EXECUTE FUNCTION asignar_supervisor_a_ruta();

-- ============================================
-- FUNCIÓN: Desactivar asignación al eliminar/finalizar turno
-- ============================================
CREATE OR REPLACE FUNCTION desactivar_asignacion_ruta()
RETURNS TRIGGER AS $$
BEGIN
  -- Desactivar asignaciones asociadas al turno eliminado
  UPDATE rutas_supervision_asignacion
  SET activo = false
  WHERE turno_id = OLD.id;
  
  RAISE NOTICE 'Asignaciones desactivadas para turno %', OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Desactivar asignación al eliminar turno
-- ============================================
DROP TRIGGER IF EXISTS trigger_desactivar_asignacion_ruta ON turnos;

CREATE TRIGGER trigger_desactivar_asignacion_ruta
BEFORE DELETE ON turnos
FOR EACH ROW
EXECUTE FUNCTION desactivar_asignacion_ruta();

-- ============================================
-- VALIDACIÓN: Consulta de verificación
-- ============================================
-- Ejecutar después de la migración para verificar:
-- SELECT * FROM rutas_supervision;
-- SELECT * FROM rutas_supervision_asignacion ORDER BY created_at DESC LIMIT 10;

COMMENT ON COLUMN rutas_supervision.tipo_turno IS 'Tipo de turno asociado a la ruta: diurno, nocturno, etc.';
COMMENT ON FUNCTION asignar_supervisor_a_ruta() IS 'Asigna automáticamente un supervisor a una ruta cuando se crea su turno';
COMMENT ON FUNCTION desactivar_asignacion_ruta() IS 'Desactiva las asignaciones de ruta cuando se elimina un turno';
