-- 🔹 1. memorandos
CREATE TABLE IF NOT EXISTS public.memorandos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR UNIQUE,
  titulo VARCHAR NOT NULL,
  tipo VARCHAR NOT NULL CHECK (
    tipo IN ('informativo', 'preventivo', 'disciplinario', 'llamado_atencion')
  ),
  descripcion TEXT NOT NULL,
  nivel_gravedad VARCHAR CHECK (
    nivel_gravedad IN ('bajo', 'medio', 'alto', 'critico')
  ),
  estado VARCHAR NOT NULL DEFAULT 'borrador' CHECK (
    estado IN ('borrador', 'enviado', 'leido', 'firmado', 'cerrado', 'anulado')
  ),
  fecha_emision TIMESTAMP DEFAULT now(),
  fecha_limite_firma TIMESTAMP,
  requiere_firma BOOLEAN DEFAULT false,
  creado_por INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT fk_memorando_creado_por
    FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);

-- 🔹 2. memorandos_empleados
CREATE TABLE IF NOT EXISTS public.memorandos_empleados (
  id SERIAL PRIMARY KEY,
  memorando_id INTEGER NOT NULL,
  empleado_id INTEGER NOT NULL,
  estado VARCHAR NOT NULL DEFAULT 'pendiente' CHECK (
    estado IN ('pendiente', 'leido', 'firmado', 'rechazado')
  ),
  fecha_leido TIMESTAMP,
  fecha_firma TIMESTAMP,
  ip_firma INET,
  observacion_empleado TEXT,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT fk_mem_emp_memorando
    FOREIGN KEY (memorando_id) REFERENCES public.memorandos(id),
  CONSTRAINT fk_mem_emp_empleado
    FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  UNIQUE (memorando_id, empleado_id)
);

-- 🔹 3. memorandos_adjuntos
CREATE TABLE IF NOT EXISTS public.memorandos_adjuntos (
  id SERIAL PRIMARY KEY,
  memorando_id INTEGER NOT NULL,
  tipo VARCHAR CHECK (
    tipo IN ('imagen', 'pdf', 'audio', 'video', 'otro')
  ),
  url TEXT NOT NULL,
  descripcion TEXT,
  creado_por INTEGER,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT fk_mem_adj_memorando
    FOREIGN KEY (memorando_id) REFERENCES public.memorandos(id),
  CONSTRAINT fk_mem_adj_usuario
    FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);

-- 🔹 4. memorandos_firmas
CREATE TABLE IF NOT EXISTS public.memorandos_firmas (
  id SERIAL PRIMARY KEY,
  memorando_empleado_id INTEGER NOT NULL,
  metodo_firma VARCHAR DEFAULT 'digital' CHECK (
    metodo_firma IN ('digital', 'biometrica', 'token', 'manual')
  ),
  firma_base64 TEXT,
  dispositivo VARCHAR,
  user_agent TEXT,
  ip_address INET,
  fecha_firma TIMESTAMP DEFAULT now(),
  CONSTRAINT fk_mem_firma_mem_emp
    FOREIGN KEY (memorando_empleado_id)
    REFERENCES public.memorandos_empleados(id)
);

-- 🔹 5. memorandos_historial
CREATE TABLE IF NOT EXISTS public.memorandos_historial (
  id SERIAL PRIMARY KEY,
  memorando_id INTEGER NOT NULL,
  accion VARCHAR NOT NULL CHECK (
    accion IN ('creado', 'enviado', 'leido', 'firmado', 'rechazado', 'cerrado', 'anulado')
  ),
  realizado_por INTEGER,
  observacion TEXT,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT fk_mem_hist_memorando
    FOREIGN KEY (memorando_id) REFERENCES public.memorandos(id),
  CONSTRAINT fk_mem_hist_usuario
    FOREIGN KEY (realizado_por) REFERENCES public.usuarios_externos(id)
);
