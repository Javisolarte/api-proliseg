-- ========================================
-- SISTEMA DE NOTIFICACIONES ULTRA-MODERNO
-- Para PROLISEG API - Enterprise Level
-- ========================================

-- 1. TIPOS DE CANALES Y PRIORIDADES
CREATE TYPE notificacion_canal AS ENUM ('email', 'sms', 'whatsapp', 'push', 'in_app', 'webhook');
CREATE TYPE notificacion_prioridad AS ENUM ('baja', 'media', 'alta', 'critica');
CREATE TYPE notificacion_estado AS ENUM ('pendiente', 'procesando', 'enviado', 'entregado', 'leido', 'fallido', 'cancelado');

-- 2. CATÁLOGO DE EVENTOS (El corazón del sistema)
-- Define qué cosas pueden pasar en el sistema
CREATE TABLE public.notificaciones_eventos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo character varying NOT NULL UNIQUE, -- ej: 'PANICO_ACTIVADO', 'TURNO_ASIGNADO'
  nombre character varying NOT NULL,
  descripcion text,
  prioridad_por_defecto notificacion_prioridad DEFAULT 'media',
  canales_obligatorios notificacion_canal[] DEFAULT '{}', -- Canales que el usuario NO puede desactivar
  agrupar_notificaciones boolean DEFAULT false, -- Si true, espera X minutos para enviar resumen
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now()
);

-- 3. PLANTILLAS (TEMPLATES) CON SOPORTE MULTIDIOMA Y MULTICANAL
CREATE TABLE public.notificaciones_plantillas (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evento_id integer NOT NULL REFERENCES public.notificaciones_eventos(id) ON DELETE CASCADE,
  canal notificacion_canal NOT NULL,
  asunto_template text, -- Para Email o Título Push
  cuerpo_template text NOT NULL, -- Soporta variables {{nombre_usuario}}, {{fecha}}, etc.
  metadata_template jsonb, -- Para botones de acción (Action Buttons) en Push o WhatsApp
  idioma character varying(5) DEFAULT 'es',
  version integer DEFAULT 1,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  UNIQUE(evento_id, canal, idioma)
);

-- 4. PREFERENCIAS DE USUARIO (El toque "Enterprise")
CREATE TABLE public.notificaciones_preferencias (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer REFERENCES public.usuarios_externos(id) ON DELETE CASCADE,
  empleado_id integer REFERENCES public.empleados(id) ON DELETE CASCADE,
  evento_id integer NOT NULL REFERENCES public.notificaciones_eventos(id) ON DELETE CASCADE,
  canal notificacion_canal NOT NULL,
  habilitado boolean DEFAULT true,
  horario_silencio_inicio time without time zone, -- "No molestar" desde
  horario_silencio_fin time without time zone,   -- "No molestar" hasta
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  UNIQUE(usuario_id, empleado_id, evento_id, canal),
  CHECK (usuario_id IS NOT NULL OR empleado_id IS NOT NULL)
);

-- 5. DISPOSITIVOS DE USUARIO (Tokens para Push)
CREATE TABLE public.notificaciones_dispositivos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer REFERENCES public.usuarios_externos(id) ON DELETE CASCADE,
  empleado_id integer REFERENCES public.empleados(id) ON DELETE CASCADE,
  token_dispositivo text NOT NULL, -- FCM Token / APNS Token
  plataforma character varying CHECK (plataforma IN ('android', 'ios', 'web')),
  modelo_dispositivo character varying,
  app_version character varying,
  activo boolean DEFAULT true,
  ultimo_uso timestamp without time zone DEFAULT now(),
  created_at timestamp without time zone DEFAULT now(),
  UNIQUE(token_dispositivo),
  CHECK (usuario_id IS NOT NULL OR empleado_id IS NOT NULL)
);

-- 6. COLA DE ENVÍOS (LOG CENTRALIZADO Y ULTRA ROBUSTO)
CREATE TABLE public.notificaciones_envios (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  
  -- Polimorfismo para el destinatario
  destinatario_tipo character varying NOT NULL CHECK (destinatario_tipo IN ('usuario', 'empleado', 'cliente', 'sistema')),
  destinatario_id integer NOT NULL,
  
  evento_id integer REFERENCES public.notificaciones_eventos(id) ON DELETE SET NULL,
  canal notificacion_canal NOT NULL,
  
  -- Contenido generado (Snapshot del momento de envío)
  titulo character varying,
  mensaje text NOT NULL,
  datos_extra jsonb, -- Payload para redirigir en la app (ej: { "ruta_id": 50 })
  accion_url text, -- Link mágico
  
  estado notificacion_estado DEFAULT 'pendiente',
  prioridad notificacion_prioridad DEFAULT 'media',
  
  -- Control de ejecución
  intentos_realizados integer DEFAULT 0,
  max_intentos integer DEFAULT 3,
  fecha_programada timestamp without time zone DEFAULT now(), -- Para envíos diferidos
  fecha_envio timestamp without time zone,
  fecha_lectura timestamp without time zone,
  
  -- Diagnóstico
  error_log text, -- Si falla Twilio/Firebase, guardar el error aquí
  proveedor_id_externo text, -- ID del mensaje en SendGrid/Twilio (MessageSID)
  
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- ========================================
-- ÍNDICES PARA VELOCIDAD
-- ========================================
CREATE INDEX idx_notif_envios_estado ON public.notificaciones_envios(estado);
CREATE INDEX idx_notif_envios_destinatario ON public.notificaciones_envios(destinatario_tipo, destinatario_id);
CREATE INDEX idx_notif_envios_fecha_prog ON public.notificaciones_envios(fecha_programada) WHERE estado = 'pendiente';
CREATE INDEX idx_notif_disp_token ON public.notificaciones_dispositivos(token_dispositivo);
CREATE INDEX idx_notif_disp_usuario ON public.notificaciones_dispositivos(usuario_id) WHERE activo = true;
CREATE INDEX idx_notif_disp_empleado ON public.notificaciones_dispositivos(empleado_id) WHERE activo = true;
CREATE INDEX idx_notif_eventos_codigo ON public.notificaciones_eventos(codigo);

-- ========================================
-- TRIGGERS PARA AUTO-UPDATE
-- ========================================
CREATE OR REPLACE FUNCTION update_notif_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notif_plantillas_updated
  BEFORE UPDATE ON public.notificaciones_plantillas
  FOR EACH ROW EXECUTE FUNCTION update_notif_timestamp();

CREATE TRIGGER trigger_notif_preferencias_updated
  BEFORE UPDATE ON public.notificaciones_preferencias
  FOR EACH ROW EXECUTE FUNCTION update_notif_timestamp();

CREATE TRIGGER trigger_notif_envios_updated
  BEFORE UPDATE ON public.notificaciones_envios
  FOR EACH ROW EXECUTE FUNCTION update_notif_timestamp();

-- ========================================
-- DATOS SEMILLA - EVENTOS CRÍTICOS
-- ========================================

-- Eventos de seguridad y emergencias
INSERT INTO public.notificaciones_eventos (codigo, nombre, descripcion, prioridad_por_defecto, canales_obligatorios, agrupar_notificaciones) VALUES
('PANICO_ACTIVADO', 'Botón de Pánico Activado', 'Se ha activado un botón de pánico en un puesto', 'critica', '{push,whatsapp,sms}', false),
('INCIDENTE_CRITICO', 'Incidente Crítico Reportado', 'Se ha reportado un incidente de alta gravedad', 'critica', '{push,whatsapp}', false),
('ALERTA_RONDA', 'Alerta en Ronda', 'No se ha completado una ronda en el tiempo esperado', 'alta', '{push,in_app}', false),
('TURNO_ASIGNADO', 'Turno Asignado', 'Se ha asignado un nuevo turno', 'media', '{in_app}', false),
('TURNO_CANCELADO', 'Turno Cancelado', 'Se ha cancelado un turno asignado', 'alta', '{push,whatsapp}', false),
('VISITA_AUTORIZADA', 'Visita Autorizada', 'Nueva visita autorizada en el sistema', 'baja', '{in_app}', true),
('DOCUMENTO_FIRMADO', 'Documento Firmado', 'Un documento ha sido firmado electrónicamente', 'media', '{email,in_app}', false),
('COTIZACION_ENVIADA', 'Cotización Enviada', 'Se ha enviado una cotización al cliente', 'media', '{email}', false),
('GUARDIA_AUSENTE', 'Guardia Ausente', 'Un guardia no se ha presentado a su turno', 'alta', '{push,whatsapp}', false),
('MANTENIMIENTO_VENCE', 'Mantenimiento por Vencer', 'Un equipo requiere mantenimiento pronto', 'media', '{in_app,email}', true);

-- Plantillas para Botón de Pánico (Multi-canal)
INSERT INTO public.notificaciones_plantillas (evento_id, canal, asunto_template, cuerpo_template, metadata_template) VALUES
(
  (SELECT id FROM notificaciones_eventos WHERE codigo = 'PANICO_ACTIVADO'),
  'push',
  '🚨 ALERTA DE PÁNICO',
  'EMERGENCIA en {{nombre_puesto}}. Guardia: {{nombre_guardia}}. Ubicación: {{latitud}},{{longitud}}',
  '{"sound": "emergency.wav", "priority": "high", "vibrate": true, "actions": [{"action": "ver_ubicacion", "title": "Ver en Mapa"}]}'::jsonb
),
(
  (SELECT id FROM notificaciones_eventos WHERE codigo = 'PANICO_ACTIVADO'),
  'whatsapp',
  NULL,
  '🚨 *ALERTA DE PÁNICO*\n\nPuesto: *{{nombre_puesto}}*\nGuardia: {{nombre_guardia}}\nHora: {{fecha_hora}}\n\nUbicación: https://maps.google.com/?q={{latitud}},{{longitud}}',
  NULL
),
(
  (SELECT id FROM notificaciones_eventos WHERE codigo = 'PANICO_ACTIVADO'),
  'sms',
  NULL,
  'EMERGENCIA: Panico en {{nombre_puesto}}. Guardia: {{nombre_guardia}}. Ver ubicacion en app.',
  NULL
),
(
  (SELECT id FROM notificaciones_eventos WHERE codigo = 'PANICO_ACTIVADO'),
  'email',
  '🚨 ALERTA CRÍTICA: Botón de Pánico Activado',
  '<html><body style="font-family:Arial;"><h2 style="color:#d32f2f;">⚠️ EMERGENCIA - BOTÓN DE PÁNICO</h2><p><strong>Puesto:</strong> {{nombre_puesto}}</p><p><strong>Guardia:</strong> {{nombre_guardia}}</p><p><strong>Fecha/Hora:</strong> {{fecha_hora}}</p><p><a href="https://maps.google.com/?q={{latitud}},{{longitud}}" style="background:#d32f2f;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Ver Ubicación en Mapa</a></p></body></html>',
  NULL
);

-- Plantillas para Turno Asignado
INSERT INTO public.notificaciones_plantillas (evento_id, canal, asunto_template, cuerpo_template) VALUES
(
  (SELECT id FROM notificaciones_eventos WHERE codigo = 'TURNO_ASIGNADO'),
  'push',
  'Nuevo Turno Asignado',
  'Tienes un turno en {{nombre_puesto}} el {{fecha_turno}} de {{hora_inicio}} a {{hora_fin}}'
),
(
  (SELECT id FROM notificaciones_eventos WHERE codigo = 'TURNO_ASIGNADO'),
  'in_app',
  'Turno Asignado',
  'Se te ha asignado un turno para el {{fecha_turno}} en {{nombre_puesto}}'
),
(
  (SELECT id FROM notificaciones_eventos WHERE codigo = 'TURNO_ASIGNADO'),
  'whatsapp',
  NULL,
  '📅 *Nuevo Turno Asignado*\n\nPuesto: {{nombre_puesto}}\nFecha: {{fecha_turno}}\nHorario: {{hora_inicio}} - {{hora_fin}}\n\n¡Confirma tu asistencia!'
);

-- ========================================
-- COMENTARIOS PARA DESARROLLADORES
-- ========================================
COMMENT ON TABLE notificaciones_eventos IS 'Catálogo de eventos que pueden generar notificaciones';
COMMENT ON TABLE notificaciones_plantillas IS 'Plantillas de mensajes por canal y evento';
COMMENT ON TABLE notificaciones_preferencias IS 'Preferencias de usuario para notificaciones';
COMMENT ON TABLE notificaciones_dispositivos IS 'Tokens FCM/APNS de dispositivos móviles';
COMMENT ON TABLE notificaciones_envios IS 'Cola y log de envíos de notificaciones';

COMMENT ON COLUMN notificaciones_envios.datos_extra IS 'Payload JSON para deep linking en la app';
COMMENT ON COLUMN notificaciones_plantillas.metadata_template IS 'Configuración específica del canal (botones, sonidos, etc)';
