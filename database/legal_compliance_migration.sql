-- ========================================
-- MODULO CUMPLIMIENTO LEGAL (HABEAS DATA)
-- Ley 1581 Colombia - Protección de Datos
-- ========================================

-- 1. TABLA DE POLÍTICAS (VERSIONAMIENTO)
CREATE TABLE public.politicas (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo varchar(50) NOT NULL, -- ej: 'HABEAS_DATA', 'TERMINOS_USO'
  nombre varchar(255) NOT NULL,
  version varchar(20) NOT NULL, -- ej: '1.0', '2024-v2'
  contenido text NOT NULL, -- HTML o Markdown con el texto legal
  vigente boolean DEFAULT true,
  fecha_vigencia timestamp without time zone DEFAULT now(),
  created_at timestamp without time zone DEFAULT now(),
  UNIQUE(codigo, version)
);

-- 2. TABLA DE CONSENTIMIENTOS (AUDITORÍA DE ACEPTACIÓN)
CREATE TABLE public.consentimientos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer REFERENCES public.usuarios_externos(id),
  empleado_id integer REFERENCES public.empleados(id),
  politica_id integer NOT NULL REFERENCES public.politicas(id),
  aceptado boolean NOT NULL DEFAULT true,
  ip_address varchar(45), -- IPv4 o IPv6
  user_agent text, -- Navegador/Dispositivo
  firmado_hash varchar(255), -- Hash SHA256 (contenido_politica + timestamp + user_id) para integridad
  metadatos jsonb, -- Info extra del dispositivo
  revocado boolean DEFAULT false, -- Si el usuario retira el consentimiento después
  fecha_revocacion timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  CHECK (usuario_id IS NOT NULL OR empleado_id IS NOT NULL)
);

-- ÍNDICES
CREATE INDEX idx_politicas_codigo_vigente ON public.politicas(codigo) WHERE vigente = true;
CREATE INDEX idx_consentimientos_usuario_politica ON public.consentimientos(usuario_id, politica_id);
CREATE INDEX idx_consentimientos_empleado_politica ON public.consentimientos(empleado_id, politica_id);

-- DATOS SEMILLA (Política Base de Ejemplo)
INSERT INTO public.politicas (codigo, nombre, version, contenido, vigente) 
VALUES (
  'HABEAS_DATA', 
  'Política de Tratamiento de Datos Personales', 
  '1.0', 
  '<h1>AUTORIZACIÓN TRATAMIENTO DE DATOS PERSONALES</h1><p>De conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013, autorizo de manera libre, expresa e inequívoca a PROLISEG para tratar mis datos personales...</p>', 
  true
);
