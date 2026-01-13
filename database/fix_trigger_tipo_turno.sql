-- ============================================
-- FIX: Trigger con mapeo flexible de tipo_turno
-- ============================================
-- Este trigger entiende: DIA/dia/DIURNO/diurno → NOCHE/noche/NOCTURNO/nocturno

CREATE OR REPLACE FUNCTION asignar_supervisor_a_ruta()
RETURNS TRIGGER AS $$
DECLARE
  v_ruta_id INTEGER;
  v_vehiculo_id INTEGER;
  v_es_supervisor BOOLEAN;
  v_rol_empleado VARCHAR;
  v_asignacion_existente INTEGER;
  v_tipo_turno_normalizado VARCHAR;
BEGIN
  -- 1. Verificar si el empleado es supervisor
  SELECT rol INTO v_rol_empleado
  FROM empleados
  WHERE id = NEW.empleado_id;
  
  v_es_supervisor := (v_rol_empleado = 'supervisor');
  
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
  
  -- 3. Normalizar tipo_turno (DIA/dia/DIURNO → diurno, NOCHE/noche/NOCTURNO → nocturno)
  v_tipo_turno_normalizado := CASE 
    WHEN LOWER(NEW.tipo_turno) IN ('dia', 'diurno') THEN 'diurno'
    WHEN LOWER(NEW.tipo_turno) IN ('noche', 'nocturno') THEN 'nocturno'
    ELSE LOWER(NEW.tipo_turno)
  END;
  
  -- 4. Buscar ruta según tipo de turno normalizado
  SELECT id INTO v_ruta_id
  FROM rutas_supervision
  WHERE LOWER(tipo_turno) = v_tipo_turno_normalizado
    AND activa = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_ruta_id IS NULL THEN
    RAISE WARNING 'No se encontró ruta activa para tipo_turno: % (normalizado: %, empleado: %, turno: %)', 
                  NEW.tipo_turno, v_tipo_turno_normalizado, NEW.empleado_id, NEW.id;
    RETURN NEW;
  END IF;
  
  -- 5. Buscar vehículo asignado al supervisor
  SELECT vehiculo_id INTO v_vehiculo_id
  FROM supervisor_vehiculos
  WHERE supervisor_id = NEW.empleado_id
    AND activo = true
  ORDER BY fecha_asignacion DESC
  LIMIT 1;
  
  IF v_vehiculo_id IS NULL THEN
    RAISE NOTICE 'Supervisor % no tiene vehículo asignado, se asignará ruta sin vehículo', NEW.empleado_id;
  END IF;
  
  -- 6. Crear asignación de ruta
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
  
  RAISE NOTICE 'Asignación creada: Ruta % -> Supervisor % (Turno: %, Tipo: % -> %, Vehículo: %)', 
               v_ruta_id, NEW.empleado_id, NEW.id, NEW.tipo_turno, v_tipo_turno_normalizado, COALESCE(v_vehiculo_id::text, 'N/A');
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error al asignar ruta para turno %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PASO 2: Crear asignaciones para turnos existentes
-- ============================================
-- Ejecutar SOLO si quieres asignar rutas a los turnos que ya creaste

DO $$
DECLARE
  v_turno RECORD;
  v_ruta_id INTEGER;
  v_vehiculo_id INTEGER;
  v_tipo_normalizado VARCHAR;
BEGIN
  -- Procesar cada turno de supervisor sin asignación
  FOR v_turno IN 
    SELECT t.id, t.empleado_id, t.tipo_turno
    FROM turnos t
    JOIN empleados e ON t.empleado_id = e.id
    LEFT JOIN rutas_supervision_asignacion rsa ON rsa.turno_id = t.id AND rsa.activo = true
    WHERE e.rol = 'supervisor'
      AND rsa.id IS NULL
      AND t.tipo_turno IS NOT NULL
  LOOP
    -- Normalizar tipo_turno
    v_tipo_normalizado := CASE 
      WHEN LOWER(v_turno.tipo_turno) IN ('dia', 'diurno') THEN 'diurno'
      WHEN LOWER(v_turno.tipo_turno) IN ('noche', 'nocturno') THEN 'nocturno'
      ELSE LOWER(v_turno.tipo_turno)
    END;
    
    -- Buscar ruta
    SELECT id INTO v_ruta_id
    FROM rutas_supervision
    WHERE LOWER(tipo_turno) = v_tipo_normalizado
      AND activa = true
    LIMIT 1;
    
    IF v_ruta_id IS NOT NULL THEN
      -- Buscar vehículo
      SELECT vehiculo_id INTO v_vehiculo_id
      FROM supervisor_vehiculos
      WHERE supervisor_id = v_turno.empleado_id
        AND activo = true
      ORDER BY fecha_asignacion DESC
      LIMIT 1;
      
      -- Crear asignación
      INSERT INTO rutas_supervision_asignacion (
        ruta_id, turno_id, supervisor_id, vehiculo_id, activo, created_at
      ) VALUES (
        v_ruta_id, v_turno.id, v_turno.empleado_id, v_vehiculo_id, true, NOW()
      );
      
      RAISE NOTICE 'Asignación creada para turno existente %: Ruta % -> Supervisor %', 
                   v_turno.id, v_ruta_id, v_turno.empleado_id;
    ELSE
      RAISE WARNING 'No se encontró ruta para turno % (tipo: % -> %)', 
                    v_turno.id, v_turno.tipo_turno, v_tipo_normalizado;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Ver asignaciones creadas
SELECT 
    rsa.id,
    t.id as turno_id,
    t.tipo_turno as turno_tipo,
    rs.nombre as ruta_nombre,
    rs.tipo_turno as ruta_tipo,
    e.nombre_completo as supervisor,
    v.placa as vehiculo,
    rsa.created_at
FROM rutas_supervision_asignacion rsa
JOIN turnos t ON rsa.turno_id = t.id
JOIN rutas_supervision rs ON rsa.ruta_id = rs.id
JOIN empleados e ON rsa.supervisor_id = e.id
LEFT JOIN vehiculos v ON rsa.vehiculo_id = v.id
WHERE rsa.activo = true
ORDER BY rsa.created_at DESC
LIMIT 20;
