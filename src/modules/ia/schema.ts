// WARNING: This schema is for context only and is not meant to be run.
// Table order and constraints may not be valid for execution.

export const schema = `
CREATE TABLE public.archivos (
  id integer PRIMARY KEY,
  nombre_original varchar NOT NULL,
  nombre_archivo varchar NOT NULL,
  ruta_completa text NOT NULL,
  tipo_mime varchar,
  tamaño_bytes bigint,
  relacionado_con varchar,
  relacionado_id integer,
  subido_por integer,
  es_publico boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE TABLE public.arl (
  id integer PRIMARY KEY,
  nombre varchar UNIQUE NOT NULL,
  codigo varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE public.asignacion_guardas_puesto (
  id integer PRIMARY KEY,
  puesto_id integer REFERENCES public.puestos_trabajo(id),
  empleado_id integer REFERENCES public.empleados(id),
  fecha_asignacion date DEFAULT CURRENT_DATE,
  activo boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE public.asistencias (
  id integer PRIMARY KEY,
  turno_id integer REFERENCES public.turnos(id),
  tipo_marca varchar CHECK (tipo_marca IN ('entrada', 'salida')),
  timestamp timestamp NOT NULL,
  latitud numeric,
  longitud numeric,
  registrada_por integer REFERENCES public.usuarios_externos(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE public.auditoria (
  id integer PRIMARY KEY,
  tabla_afectada varchar NOT NULL,
  registro_id integer NOT NULL,
  accion varchar CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  usuario_id integer REFERENCES public.usuarios_externos(id),
  ip_address inet,
  user_agent text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE public.capacitaciones (
  id integer PRIMARY KEY,
  nombre varchar NOT NULL,
  descripcion text,
  duracion_horas integer,
  obligatoria boolean DEFAULT false,
  vigencia_meses integer,
  activa boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE public.clientes (
  id integer PRIMARY KEY,
  usuario_id integer REFERENCES public.usuarios_externos(id),
  nombre_empresa varchar NOT NULL,
  nit varchar UNIQUE,
  direccion text,
  telefono varchar,
  contacto varchar,
  activo boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE public.contratos (
  id integer PRIMARY KEY,
  cliente_id integer REFERENCES public.clientes(id),
  tipo_contrato varchar,
  valor numeric,
  numero_guardas integer,
  fecha_inicio date,
  fecha_fin date,
  estado boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE public.empleados (
  id integer PRIMARY KEY,
  usuario_id integer REFERENCES public.usuarios_externos(id),
  nombre_completo varchar NOT NULL,
  cedula varchar UNIQUE NOT NULL,
  fecha_expedicion date,
  fecha_nacimiento date,
  telefono varchar,
  correo varchar,
  direccion text,
  departamento varchar,
  ciudad varchar,
  estado_civil varchar,
  genero varchar,
  tipo_empleado_id integer,
  tipo_contrato varchar,
  fecha_ingreso date NOT NULL,
  fecha_salida date,
  motivo_salida text,
  puesto_id integer REFERENCES public.puestos_trabajo(id),
  eps_id integer REFERENCES public.eps(id),
  arl_id integer REFERENCES public.arl(id),
  fondo_pension_id integer REFERENCES public.fondos_pension(id),
  fecha_afiliacion_eps date,
  fecha_fin_eps date,
  fecha_afiliacion_arl date,
  fecha_fin_arl date,
  fecha_afiliacion_pension date,
  fecha_fin_pension date,
  horas_trabajadas_semana integer DEFAULT 0,
  hoja_de_vida_url text,
  activo boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  foto_perfil_url text DEFAULT '/images/empleados/default-avatar.png',
  verificado_documentos boolean DEFAULT false
);

CREATE TABLE public.incidentes (
  id integer PRIMARY KEY,
  puesto_id integer REFERENCES public.puestos_trabajo(id),
  empleado_reporta integer REFERENCES public.empleados(id),
  tipo_incidente varchar NOT NULL,
  descripcion text NOT NULL,
  nivel_gravedad varchar CHECK (nivel_gravedad IN ('bajo', 'medio', 'alto', 'critico')),
  fecha_incidente timestamp NOT NULL,
  estado varchar DEFAULT 'abierto',
  acciones_tomadas text
);

CREATE TABLE public.minutas (
  id integer PRIMARY KEY,
  turno_id integer REFERENCES public.turnos(id),
  puesto_id integer REFERENCES public.puestos_trabajo(id),
  contenido text NOT NULL,
  creada_por integer REFERENCES public.usuarios_externos(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE public.novedades (
  id integer PRIMARY KEY,
  creada_por integer REFERENCES public.usuarios_externos(id),
  turno_id integer REFERENCES public.turnos(id),
  tipo varchar,
  descripcion text,
  nivel_alerta varchar CHECK (nivel_alerta IN ('bajo', 'medio', 'alto')),
  created_at timestamp DEFAULT now()
);

CREATE TABLE public.puestos_trabajo (
  id integer PRIMARY KEY,
  contrato_id integer REFERENCES public.contratos(id),
  nombre varchar NOT NULL,
  direccion text,
  ciudad varchar,
  latitud numeric,
  longitud numeric,
  activo boolean DEFAULT true
);

CREATE TABLE public.roles (
  id integer PRIMARY KEY,
  nombre varchar UNIQUE NOT NULL,
  descripcion text,
  nivel_jerarquia integer DEFAULT 0,
  activo boolean DEFAULT true
);

CREATE TABLE public.turnos (
  id integer PRIMARY KEY,
  empleado_id integer REFERENCES public.empleados(id),
  puesto_id integer REFERENCES public.puestos_trabajo(id),
  fecha date NOT NULL,
  hora_inicio time,
  hora_fin time,
  tipo_turno varchar,
  asignado_por integer REFERENCES public.usuarios_externos(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE public.usuarios_externos (
  id integer PRIMARY KEY,
  user_id uuid UNIQUE NOT NULL,
  nombre_completo varchar NOT NULL,
  cedula varchar UNIQUE NOT NULL,
  correo varchar,
  telefono varchar,
  rol varchar NOT NULL REFERENCES public.roles(nombre),
  estado boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
`;
