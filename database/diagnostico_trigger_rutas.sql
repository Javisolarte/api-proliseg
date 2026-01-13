-- ============================================
-- DIAGNÓSTICO: Sistema de Asignación Automática
-- ============================================

-- PASO 1: Verificar que el trigger existe y está habilitado
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgisinternal as is_internal
FROM pg_trigger 
WHERE tgname = 'trigger_asignar_supervisor_ruta';
-- Resultado esperado: 1 fila, tgenabled = 'O' (enabled)

-- PASO 2: Verificar que la función existe
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'asignar_supervisor_a_ruta';
-- Resultado esperado: 1 fila

-- PASO 3: Verificar columna tipo_turno en rutas_supervision
SELECT id, nombre, tipo_turno, activa 
FROM rutas_supervision;
-- Verificar que las rutas tienen tipo_turno configurado (diurno/nocturno)

-- PASO 4: Ver el último turno creado
SELECT 
    t.id,
    t.empleado_id,
    t.fecha,
    t.tipo_turno,
    e.nombre_completo,
    e.rol,
    t.created_at
FROM turnos t
JOIN empleados e ON t.empleado_id = e.id
ORDER BY t.created_at DESC
LIMIT 5;
-- Verificar: el empleado debe tener rol = 'supervisor'

-- PASO 5: Verificar si existe asignación para el turno
SELECT 
    rsa.id,
    rsa.turno_id,
    rsa.supervisor_id,
    rsa.ruta_id,
    rsa.vehiculo_id,
    rsa.activo,
    rs.nombre as nombre_ruta,
    e.nombre_completo as supervisor
FROM rutas_supervision_asignacion rsa
JOIN rutas_supervision rs ON rsa.ruta_id = rs.id
JOIN empleados e ON rsa.supervisor_id = e.id
ORDER BY rsa.created_at DESC
LIMIT 10;

-- PASO 6: Buscar supervisores con vehículos
SELECT 
    e.id,
    e.nombre_completo,
    e.rol,
    sv.vehiculo_id,
    v.placa
FROM empleados e
LEFT JOIN supervisor_vehiculos sv ON e.id = sv.supervisor_id AND sv.activo = true
LEFT JOIN vehiculos v ON sv.vehiculo_id = v.id
WHERE e.rol = 'supervisor' AND e.activo = true;

-- PASO 7: Verificar si hay rutas activas con tipo_turno
SELECT 
    id,
    nombre,
    tipo_turno,
    activa,
    CASE 
        WHEN tipo_turno IS NULL THEN '❌ SIN TIPO_TURNO'
        WHEN activa = false THEN '⚠️ INACTIVA'
        ELSE '✅ OK'
    END as estado
FROM rutas_supervision;

-- PASO 8: Test manual del trigger (EJECUTAR SOLO SI QUIERES PROBAR)
-- Descomentar las siguientes líneas para probar manualmente
/*
-- Crear un turno de prueba para un supervisor
INSERT INTO turnos (empleado_id, fecha, tipo_turno, hora_inicio, hora_fin)
SELECT 
    e.id,
    CURRENT_DATE + 1, -- Mañana
    'diurno',
    '06:00:00',
    '18:00:00'
FROM empleados e
WHERE e.rol = 'supervisor' 
  AND e.activo = true
LIMIT 1
RETURNING id, empleado_id, tipo_turno;

-- Luego verificar si se creó la asignación
SELECT * FROM rutas_supervision_asignacion 
WHERE turno_id = (SELECT MAX(id) FROM turnos)
ORDER BY created_at DESC;
*/

-- ============================================
-- CHECKLIST DE VERIFICACIÓN
-- ============================================
-- [ ] Trigger existe y está habilitado (Paso 1)
-- [ ] Función existe (Paso 2)
-- [ ] Rutas tienen tipo_turno configurado (Paso 3 y 7)
-- [ ] Empleado del turno es supervisor (Paso 4)
-- [ ] Existe ruta activa que coincida con tipo_turno del turno
-- [ ] Supervisor tiene vehículo asignado (Paso 6) [OPCIONAL]
