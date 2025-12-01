-- ============================================================================
-- FIX: Corrección de columna usuario_externo_id -> usuario_id
-- ============================================================================
-- Este script corrige el error de columna "usuario_externo_id" que no existe
-- La columna correcta es "usuario_id" según el esquema de la base de datos
-- 
-- Archivos afectados:
-- 1. Función RPC: asignar_modulos_usuario()
-- 2. Trigger Function: asignar_modulos_por_rol()
-- ============================================================================

-- ============================================================================
-- 1. FUNCIÓN RPC: asignar_modulos_usuario
-- ============================================================================

DROP FUNCTION IF EXISTS asignar_modulos_usuario(integer);

CREATE OR REPLACE FUNCTION asignar_modulos_usuario(p_usuario_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_rol_nombre VARCHAR;
  v_modulo RECORD;
BEGIN
  -- 1. Obtener el rol del usuario
  SELECT rol INTO v_rol_nombre
  FROM usuarios_externos
  WHERE id = p_usuario_id;

  IF v_rol_nombre IS NULL THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_usuario_id;
  END IF;

  -- 2. Obtener todos los módulos asignados a ese rol
  FOR v_modulo IN
    SELECT rm.modulo_id
    FROM roles_modulos rm
    INNER JOIN roles r ON r.id = rm.rol_id
    WHERE r.nombre = v_rol_nombre
  LOOP
    -- 3. Insertar en roles_modulos_usuarios_externos usando usuario_id (corregido)
    INSERT INTO roles_modulos_usuarios_externos (usuario_id, modulo_id, concedido, created_at)
    VALUES (p_usuario_id, v_modulo.modulo_id, true, NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Módulos asignados correctamente al usuario %', p_usuario_id;
END;
$$;

COMMENT ON FUNCTION asignar_modulos_usuario(integer) IS 
'Asigna automáticamente todos los módulos del rol de un usuario a la tabla roles_modulos_usuarios_externos';

-- ============================================================================
-- 2. TRIGGER FUNCTION: asignar_modulos_por_rol
-- ============================================================================

CREATE OR REPLACE FUNCTION asignar_modulos_por_rol()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- LIMPIA asignaciones previas por si acaso (opcional)
  -- DELETE FROM public.roles_modulos_usuarios_externos WHERE usuario_id = NEW.id;

  -- 1) SUPERUSUARIO -> TODOS los módulos
  IF NEW.rol = 'superusuario' THEN
    INSERT INTO public.roles_modulos_usuarios_externos (usuario_id, modulo_id, created_at)
    SELECT NEW.id, m.id, NOW()
    FROM public.modulos m
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

  -- 2) GERENCIA -> TODO MENOS: gestión de usuarios/roles y configuración y 'salarios'
  ELSIF NEW.rol = 'gerencia' THEN
    INSERT INTO public.roles_modulos_usuarios_externos (usuario_id, modulo_id, created_at)
    SELECT NEW.id, m.id, NOW()
    FROM public.modulos m
    WHERE m.nombre NOT IN (
      'configuracion', 'configuracion.read', 'configuracion.write', 'usuarios.manage', 'roles.manage', 'seguridad_sistema',
      'salarios'
    )
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

  -- 3) COORDINADOR -> TODO MENOS usuarios/roles/configuración y CPS (ARL/EPS/FONDOS)
  ELSIF NEW.rol = 'coordinador' THEN
    INSERT INTO public.roles_modulos_usuarios_externos (usuario_id, modulo_id, created_at)
    SELECT NEW.id, m.id, NOW()
    FROM public.modulos m
    WHERE m.nombre NOT IN (
      'configuracion', 'configuracion.read', 'configuracion.write', 'usuarios.manage', 'roles.manage', 'seguridad_sistema',
      'arl', 'eps', 'fondos-pension'
    )
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

  -- 4) SUPERVISOR -> Acceso operativo y lectura de empleados, SIN permisos para crear/editar/eliminar/exportar empleados,
  --    SIN administración, SIN usuarios/roles, SIN auditoría avanzada ni exportaciones críticas.
  ELSIF NEW.rol = 'supervisor' THEN
    INSERT INTO public.roles_modulos_usuarios_externos (usuario_id, modulo_id, created_at)
    SELECT NEW.id, m.id, NOW()
    FROM public.modulos m
    WHERE
      (
        -- Módulos operativos y de supervisión
        m.categoria IN ('operaciones','operativo','movil','seguridad','novedades','asistencias','auditoria','empleados')
        OR
        m.nombre IN ('turnos','turnos.read','turnos.read_all','horarios','horarios.read','asistencias.read','puestos_trabajo.read',
                     'recorridos','recorridos.read','novedades.read','incidentes.read','minutas.read','rutas','servicios','servicios.read',
                     'reportes.read')
      )
      -- excluimos permisos de escritura/borrado/export en empleados y exportaciones/auditoría avanzada
      AND m.nombre NOT IN (
        'empleados.write','empleados.delete','empleados.export','empleados',
        'reportes.advanced','reportes.export','auditoria.logs','auditoria.sesiones',
        'usuarios.manage','roles.manage','configuracion','configuracion.write','configuracion.read','seguridad_sistema'
      )
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

  -- 5) VIGILANTE -> SÓLO SU APP / su horario / sus asistencias / minutas (visión personal)
  ELSIF NEW.rol = 'vigilante' THEN
    INSERT INTO public.roles_modulos_usuarios_externos (usuario_id, modulo_id, created_at)
    SELECT NEW.id, m.id, NOW()
    FROM public.modulos m
    WHERE m.nombre IN (
      'app_movil_vigilante',
      'horarios.read', 'horarios',
      'asistencias.read', 'asistencias',
      'minutas.read', 'minutas',
      'empleados.read',
      'recorridos.read'
    )
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

  -- 6) CLIENTE -> Sólo lo relacionado con SU empresa: contratos, puestos, minutas, sus reportes y clientes
  ELSIF NEW.rol = 'cliente' THEN
    INSERT INTO public.roles_modulos_usuarios_externos (usuario_id, modulo_id, created_at)
    SELECT NEW.id, m.id, NOW()
    FROM public.modulos m
    WHERE m.nombre IN (
      'clientes', 'clientes.read', 'clientes.contracts',
      'contratos', 'contratos.read',
      'puestos', 'puestos_trabajo.read', 'puestos_trabajo.write',
      'minutas.read', 'minutas', 'novedades.read', 'reportes.read'
    )
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

  ELSE
    -- Si llega un rol no previsto, asignar nada
    RAISE NOTICE 'Rol % no contemplado en trigger asignar_modulos_por_rol(); no se asignaron módulos', NEW.rol;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION asignar_modulos_por_rol() IS 
'Trigger function que asigna módulos automáticamente según el rol del usuario al momento de su creación';

-- ============================================================================
-- 3. VERIFICAR QUE EL TRIGGER ESTÉ ACTIVO
-- ============================================================================
-- Si el trigger no existe, créalo:

DROP TRIGGER IF EXISTS trigger_asignar_modulos_por_rol ON usuarios_externos;

CREATE TRIGGER trigger_asignar_modulos_por_rol
  AFTER INSERT ON usuarios_externos
  FOR EACH ROW
  EXECUTE FUNCTION asignar_modulos_por_rol();

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

SELECT 'Script ejecutado exitosamente. Funciones y trigger corregidos.' AS resultado;
