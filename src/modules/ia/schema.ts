// WARNING: This schema is for context only and is not meant to be run.
// Table order and constraints may not be valid for execution.

export const schema = `-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.archivos (
  id integer NOT NULL DEFAULT nextval('archivos_id_seq'::regclass),
  nombre_original character varying NOT NULL,
  nombre_archivo character varying NOT NULL,
  ruta_completa text NOT NULL,
  tipo_mime character varying,
  tamaño_bytes bigint,
  relacionado_con character varying,
  relacionado_id integer,
  subido_por integer,
  es_publico boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT archivos_pkey PRIMARY KEY (id),
  CONSTRAINT archivos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.arl (
  id integer NOT NULL DEFAULT nextval('arl_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  codigo character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT arl_pkey PRIMARY KEY (id)
);
CREATE TABLE public.asignacion_guardas_puesto (
  id integer NOT NULL DEFAULT nextval('asignacion_guardas_puesto_id_seq'::regclass),
  empleado_id integer NOT NULL,
  puesto_id integer,
  subpuesto_id integer,
  fecha_asignacion date DEFAULT CURRENT_DATE,
  hora_asignacion time without time zone DEFAULT CURRENT_TIME,
  asignado_por integer,
  observaciones text,
  activo boolean DEFAULT true,
  fecha_fin date,
  hora_fin time without time zone,
  motivo_finalizacion text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT asignacion_guardas_puesto_pkey PRIMARY KEY (id),
  CONSTRAINT asignacion_guardas_puesto_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT asignacion_guardas_puesto_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT asignacion_guardas_puesto_subpuesto_id_fkey FOREIGN KEY (subpuesto_id) REFERENCES public.subpuestos_trabajo(id),
  CONSTRAINT asignacion_guardas_puesto_asignado_por_fkey FOREIGN KEY (asignado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.asistencias (
  id integer NOT NULL DEFAULT nextval('asistencias_id_seq'::regclass),
  turno_id integer,
  tipo_marca character varying CHECK (tipo_marca::text = ANY (ARRAY['entrada'::character varying, 'salida'::character varying]::text[])),
  timestamp timestamp without time zone NOT NULL,
  latitud numeric,
  longitud numeric,
  registrada_por integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT asistencias_pkey PRIMARY KEY (id),
  CONSTRAINT asistencias_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id),
  CONSTRAINT asistencias_registrada_por_fkey FOREIGN KEY (registrada_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.auditoria (
  id integer NOT NULL DEFAULT nextval('auditoria_id_seq'::regclass),
  tabla_afectada character varying NOT NULL,
  registro_id integer NOT NULL,
  accion character varying CHECK (accion::text = ANY (ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying]::text[])),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  usuario_id integer,
  ip_address inet,
  user_agent text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT auditoria_pkey PRIMARY KEY (id),
  CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.capacitaciones (
  id integer NOT NULL DEFAULT nextval('capacitaciones_id_seq'::regclass),
  nombre character varying NOT NULL,
  descripcion text,
  duracion_horas integer,
  obligatoria boolean DEFAULT false,
  vigencia_meses integer,
  activa boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT capacitaciones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clientes (
  id integer NOT NULL DEFAULT nextval('clientes_id_seq'::regclass),
  usuario_id integer,
  nombre_empresa character varying NOT NULL,
  nit character varying UNIQUE,
  direccion text,
  telefono character varying,
  contacto character varying,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT clientes_pkey PRIMARY KEY (id),
  CONSTRAINT clientes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.configuraciones (
  id integer NOT NULL DEFAULT nextval('configuraciones_id_seq'::regclass),
  clave character varying NOT NULL UNIQUE,
  valor text,
  descripcion text,
  tipo character varying CHECK (tipo::text = ANY (ARRAY['string'::character varying, 'number'::character varying, 'boolean'::character varying, 'json'::character varying]::text[])),
  categoria character varying DEFAULT 'general'::character varying,
  modificable_por_usuario boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT configuraciones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contratos (
  id integer NOT NULL DEFAULT nextval('contratos_id_seq'::regclass),
  cliente_id integer,
  tipo_servicio_id integer,
  valor numeric,
  numero_guardas integer,
  fecha_inicio date,
  fecha_fin date,
  estado boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT contratos_pkey PRIMARY KEY (id),
  CONSTRAINT contratos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT contratos_tipo_servicio_id_fkey FOREIGN KEY (tipo_servicio_id) REFERENCES public.tipo_servicio(id)
);
CREATE TABLE public.empleado_capacitaciones (
  id integer NOT NULL DEFAULT nextval('empleado_capacitaciones_id_seq'::regclass),
  empleado_id integer,
  capacitacion_id integer,
  fecha_realizacion date,
  fecha_vencimiento date,
  certificado_url text,
  aprobado boolean DEFAULT false,
  puntuacion numeric,
  instructor character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT empleado_capacitaciones_pkey PRIMARY KEY (id),
  CONSTRAINT empleado_capacitaciones_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT empleado_capacitaciones_capacitacion_id_fkey FOREIGN KEY (capacitacion_id) REFERENCES public.capacitaciones(id)
);
CREATE TABLE public.empleados (
  id integer NOT NULL DEFAULT nextval('empleados_id_seq'::regclass),
  usuario_id integer,
  nombre_completo character varying NOT NULL,
  cedula character varying NOT NULL UNIQUE,
  fecha_expedicion date,
  fecha_nacimiento date,
  telefono character varying,
  correo character varying,
  direccion text,
  departamento character varying,
  ciudad character varying,
  estado_civil character varying,
  genero character varying,
  tipo_empleado_id integer,
  tipo_contrato character varying,
  fecha_ingreso date NOT NULL,
  fecha_salida date,
  motivo_salida text,
  puesto_id integer,
  eps_id integer,
  arl_id integer,
  fondo_pension_id integer,
  fecha_afiliacion_eps date,
  fecha_fin_eps date,
  fecha_afiliacion_arl date,
  fecha_fin_arl date,
  fecha_afiliacion_pension date,
  fecha_fin_pension date,
  horas_trabajadas_semana integer DEFAULT 0,
  hoja_de_vida_url text,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  foto_perfil_url text DEFAULT '/empleados/fotos_perfil/default-avatar.png'::text,
  cedula_pdfurl text,
  certificados_urls jsonb DEFAULT '[]'::jsonb,
  documentos_adicionales_urls jsonb DEFAULT '[]'::jsonb,
  fecha_ultima_actualizacion_foto timestamp without time zone DEFAULT now(),
  verificado_documentos boolean DEFAULT false,
  verificado_por integer,
  fecha_verificacion timestamp without time zone,
  rol character varying NOT NULL DEFAULT 'empleado'::character varying,
  creado_por integer,
  actualizado_por integer,
  CONSTRAINT empleados_pkey PRIMARY KEY (id),
  CONSTRAINT empleados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT empleados_eps_id_fkey FOREIGN KEY (eps_id) REFERENCES public.eps(id),
  CONSTRAINT empleados_arl_id_fkey FOREIGN KEY (arl_id) REFERENCES public.arl(id),
  CONSTRAINT empleados_fondo_pension_id_fkey FOREIGN KEY (fondo_pension_id) REFERENCES public.fondos_pension(id),
  CONSTRAINT empleados_verificado_por_fkey FOREIGN KEY (verificado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT empleados_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT empleados_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.eps (
  id integer NOT NULL DEFAULT nextval('eps_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  codigo character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT eps_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fondos_pension (
  id integer NOT NULL DEFAULT nextval('fondos_pension_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  codigo character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT fondos_pension_pkey PRIMARY KEY (id)
);
CREATE TABLE public.incidentes (
  id integer NOT NULL DEFAULT nextval('incidentes_id_seq'::regclass),
  puesto_id integer,
  empleado_reporta integer,
  tipo_incidente character varying NOT NULL,
  descripcion text NOT NULL,
  nivel_gravedad character varying CHECK (nivel_gravedad::text = ANY (ARRAY['bajo'::character varying, 'medio'::character varying, 'alto'::character varying, 'critico'::character varying]::text[])),
  fecha_incidente timestamp without time zone NOT NULL,
  fecha_reporte timestamp without time zone DEFAULT now(),
  estado character varying DEFAULT 'abierto'::character varying CHECK (estado::text = ANY (ARRAY['abierto'::character varying, 'en_investigacion'::character varying, 'resuelto'::character varying, 'cerrado'::character varying]::text[])),
  acciones_tomadas text,
  resuelto_por integer,
  fecha_resolucion timestamp without time zone,
  evidencias_urls jsonb DEFAULT '[]'::jsonb,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT incidentes_pkey PRIMARY KEY (id),
  CONSTRAINT incidentes_empleado_reporta_fkey FOREIGN KEY (empleado_reporta) REFERENCES public.empleados(id),
  CONSTRAINT incidentes_resuelto_por_fkey FOREIGN KEY (resuelto_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.minutas (
  id integer NOT NULL DEFAULT nextval('minutas_id_seq'::regclass),
  turno_id integer,
  puesto_id integer,
  contenido text NOT NULL,
  visible_para_cliente boolean DEFAULT true,
  creada_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT minutas_pkey PRIMARY KEY (id),
  CONSTRAINT minutas_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id),
  CONSTRAINT minutas_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.modulos (
  id integer NOT NULL DEFAULT nextval('modulos_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  categoria character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  parent_id integer,
  CONSTRAINT modulos_pkey PRIMARY KEY (id),
  CONSTRAINT modulos_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.modulos(id)
);
CREATE TABLE public.notificaciones (
  id integer NOT NULL DEFAULT nextval('notificaciones_id_seq'::regclass),
  para_usuario_id integer,
  mensaje text,
  tipo character varying CHECK (tipo::text = ANY (ARRAY['correo'::character varying, 'push'::character varying, 'sistema'::character varying]::text[])),
  leido boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  categoria character varying DEFAULT 'sistema'::character varying,
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_para_usuario_id_fkey FOREIGN KEY (para_usuario_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.novedades (
  id integer NOT NULL DEFAULT nextval('novedades_id_seq'::regclass),
  creada_por integer,
  turno_id integer,
  tipo character varying,
  descripcion text,
  nivel_alerta character varying CHECK (nivel_alerta::text = ANY (ARRAY['bajo'::character varying, 'medio'::character varying, 'alto'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT novedades_pkey PRIMARY KEY (id),
  CONSTRAINT novedades_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT novedades_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id)
);
CREATE TABLE public.puestos_trabajo (
  id integer NOT NULL DEFAULT nextval('puestos_trabajo_id_seq'::regclass),
  contrato_id integer NOT NULL,
  nombre character varying NOT NULL,
  direccion text,
  ciudad character varying,
  latitud numeric,
  longitud numeric,
  numero_guardas integer DEFAULT 0,
  parent_id integer,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  creado_por integer,
  actualizado_por integer,
  configuracion_id integer,
  CONSTRAINT puestos_trabajo_pkey PRIMARY KEY (id),
  CONSTRAINT puestos_trabajo_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT puestos_trabajo_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT puestos_trabajo_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id),
  CONSTRAINT puestos_trabajo_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT puestos_trabajo_configuracion_id_fkey FOREIGN KEY (configuracion_id) REFERENCES public.turnos_configuracion(id)
);
CREATE TABLE public.recorridos_supervisor (
  id integer NOT NULL DEFAULT nextval('recorridos_supervisor_id_seq'::regclass),
  supervisor_id integer,
  puesto_id integer,
  fecha date,
  hora time without time zone,
  latitud numeric,
  longitud numeric,
  observaciones text,
  novedades text,
  validado boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT recorridos_supervisor_pkey PRIMARY KEY (id),
  CONSTRAINT recorridos_supervisor_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.reportes (
  id integer NOT NULL DEFAULT nextval('reportes_id_seq'::regclass),
  tipo_reporte character varying,
  parametros jsonb,
  generado_por integer,
  url_archivo text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT reportes_pkey PRIMARY KEY (id),
  CONSTRAINT reportes_generado_por_fkey FOREIGN KEY (generado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.roles (
  id integer NOT NULL DEFAULT nextval('roles_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  nivel_jerarquia integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.roles_modulos (
  id integer NOT NULL DEFAULT nextval('roles_modulos_id_seq'::regclass),
  rol_id integer NOT NULL,
  modulo_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT roles_modulos_pkey PRIMARY KEY (id),
  CONSTRAINT roles_modulos_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id),
  CONSTRAINT roles_modulos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id)
);
CREATE TABLE public.roles_modulos_usuarios_externos (
  id integer NOT NULL DEFAULT nextval('roles_modulos_usuarios_externos_id_seq'::regclass),
  usuario_externo_id integer NOT NULL,
  modulo_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT roles_modulos_usuarios_externos_pkey PRIMARY KEY (id),
  CONSTRAINT roles_modulos_usuarios_externos_usuario_externo_id_fkey FOREIGN KEY (usuario_externo_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT roles_modulos_usuarios_externos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id)
);
CREATE TABLE public.sesiones_usuario (
  id integer NOT NULL DEFAULT nextval('sesiones_usuario_id_seq'::regclass),
  usuario_id integer,
  token_sesion character varying UNIQUE,
  ip_address inet,
  user_agent text,
  fecha_inicio timestamp without time zone DEFAULT now(),
  fecha_ultimo_acceso timestamp without time zone DEFAULT now(),
  activa boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sesiones_usuario_pkey PRIMARY KEY (id),
  CONSTRAINT sesiones_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.subpuestos_trabajo (
  id integer NOT NULL DEFAULT nextval('subpuestos_trabajo_id_seq'::regclass),
  puesto_id integer NOT NULL,
  nombre character varying NOT NULL,
  descripcion text,
  numero_guardas integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  configuracion_id integer,
  CONSTRAINT subpuestos_trabajo_pkey PRIMARY KEY (id),
  CONSTRAINT subpuestos_trabajo_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.tipo_servicio (
  id integer NOT NULL DEFAULT nextval('tipo_servicio_id_seq'::regclass),
  nombre character varying NOT NULL,
  categoria character varying,
  descripcion text,
  modalidad character varying,
  valor_base numeric,
  activo boolean DEFAULT true,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT tipo_servicio_pkey PRIMARY KEY (id),
  CONSTRAINT tipo_servicio_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.turnos (
  id integer NOT NULL DEFAULT nextval('turnos_id_seq'::regclass),
  empleado_id integer,
  puesto_id integer,
  fecha date NOT NULL,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  tipo_turno character varying,
  asignado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  configuracion_id integer,
  orden_en_ciclo integer,
  plaza_no integer,
  grupo character varying,
  estado_turno character varying DEFAULT 'programado'::character varying CHECK (estado_turno::text = ANY (ARRAY['programado'::character varying, 'cumplido'::character varying, 'no_cumplido'::character varying, 'parcial'::character varying]::text[])),
  horas_reportadas numeric,
  duracion_horas numeric,
  fecha_fin timestamp without time zone,
  subpuesto_id integer,
  CONSTRAINT turnos_pkey PRIMARY KEY (id),
  CONSTRAINT turnos_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT turnos_asignado_por_fkey FOREIGN KEY (asignado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT turnos_subpuesto_id_fkey FOREIGN KEY (subpuesto_id) REFERENCES public.subpuestos_trabajo(id)
);
CREATE TABLE public.turnos_asignacion_ciclo (
  id integer NOT NULL DEFAULT nextval('turnos_asignacion_ciclo_id_seq'::regclass),
  puesto_id integer NOT NULL,
  configuracion_id integer,
  grupo character varying NOT NULL,
  empleado_id integer,
  fecha_inicio date NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT turnos_asignacion_ciclo_pkey PRIMARY KEY (id),
  CONSTRAINT turnos_asignacion_ciclo_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT turnos_asignacion_ciclo_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.turnos_asistencia (
  id integer NOT NULL DEFAULT nextval('turnos_asistencia_id_seq'::regclass),
  turno_id integer NOT NULL,
  empleado_id integer NOT NULL,
  hora_entrada timestamp without time zone,
  hora_salida timestamp without time zone,
  observaciones text,
  registrado_por integer,
  metodo_registro character varying DEFAULT 'manual'::character varying CHECK (metodo_registro::text = ANY (ARRAY['manual'::character varying, 'biometrico'::character varying, 'app'::character varying, 'gps'::character varying]::text[])),
  estado_asistencia character varying DEFAULT 'pendiente'::character varying CHECK (estado_asistencia::text = ANY (ARRAY['pendiente'::character varying, 'cumplido'::character varying, 'no_cumplido'::character varying, 'parcial'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT turnos_asistencia_pkey PRIMARY KEY (id),
  CONSTRAINT turnos_asistencia_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id),
  CONSTRAINT turnos_asistencia_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT turnos_asistencia_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.turnos_configuracion (
  id integer NOT NULL DEFAULT nextval('turnos_configuracion_id_seq'::regclass),
  nombre character varying NOT NULL,
  descripcion text,
  dias_ciclo integer NOT NULL DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT turnos_configuracion_pkey PRIMARY KEY (id)
);
CREATE TABLE public.turnos_configuracion_historial (
  id integer NOT NULL DEFAULT nextval('turnos_configuracion_historial_id_seq'::regclass),
  configuracion_id integer NOT NULL,
  cambio text NOT NULL,
  fecha timestamp without time zone DEFAULT now(),
  usuario_id integer,
  CONSTRAINT turnos_configuracion_historial_pkey PRIMARY KEY (id)
);
CREATE TABLE public.turnos_detalle_configuracion (
  id integer NOT NULL DEFAULT nextval('turnos_detalle_configuracion_id_seq'::regclass),
  configuracion_id integer NOT NULL,
  orden integer NOT NULL,
  tipo character varying NOT NULL,
  hora_inicio time without time zone NOT NULL DEFAULT '00:00:00'::time without time zone,
  hora_fin time without time zone NOT NULL DEFAULT '00:00:00'::time without time zone,
  plazas integer NOT NULL DEFAULT 1,
  CONSTRAINT turnos_detalle_configuracion_pkey PRIMARY KEY (id),
  CONSTRAINT turnos_detalle_configuracion_configuracion_id_fkey FOREIGN KEY (configuracion_id) REFERENCES public.turnos_configuracion(id)
);
CREATE TABLE public.turnos_generacion_log (
  id integer NOT NULL DEFAULT nextval('turnos_generacion_log_id_seq'::regclass),
  puesto_id integer,
  configuracion_id integer,
  mes integer,
  año integer,
  generado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  subpuesto_id integer,
  descripcion text,
  CONSTRAINT turnos_generacion_log_pkey PRIMARY KEY (id),
  CONSTRAINT turnos_generacion_log_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT turnos_generacion_log_subpuesto_id_fkey FOREIGN KEY (subpuesto_id) REFERENCES public.subpuestos_trabajo(id)
);
CREATE TABLE public.usuarios_externos (
  id integer NOT NULL DEFAULT nextval('usuarios_externos_id_seq'::regclass),
  user_id uuid NOT NULL UNIQUE,
  nombre_completo character varying NOT NULL,
  cedula character varying NOT NULL UNIQUE,
  correo character varying,
  telefono character varying,
  rol character varying NOT NULL,
  estado boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT usuarios_externos_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_externos_rol_fkey FOREIGN KEY (rol) REFERENCES public.roles(nombre)
);
CREATE TABLE public.usuarios_modulos (
  id integer NOT NULL DEFAULT nextval('usuarios_modulos_id_seq'::regclass),
  usuario_id integer,
  modulo_id integer,
  concedido boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT usuarios_modulos_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_modulos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT usuarios_modulos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id)
);
`;
