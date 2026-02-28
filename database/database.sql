-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.arl (
  id integer NOT NULL DEFAULT nextval('arl_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  codigo character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT arl_pkey PRIMARY KEY (id)
);
CREATE TABLE public.articulos_dotacion (
  id integer NOT NULL DEFAULT nextval('articulos_dotacion_id_seq'::regclass),
  codigo character varying UNIQUE,
  nombre character varying NOT NULL,
  categoria_id integer,
  descripcion text,
  activo boolean DEFAULT true,
  creado_por integer,
  actualizado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT articulos_dotacion_pkey PRIMARY KEY (id),
  CONSTRAINT fk_articulo_categoria FOREIGN KEY (categoria_id) REFERENCES public.categorias_dotacion(id),
  CONSTRAINT fk_articulo_creado_por FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT fk_articulo_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.articulos_dotacion_variantes (
  id integer NOT NULL DEFAULT nextval('articulos_dotacion_variantes_id_seq'::regclass),
  articulo_id integer NOT NULL,
  talla character varying NOT NULL,
  stock_actual integer DEFAULT 0,
  stock_minimo integer DEFAULT 5,
  notificar boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT articulos_dotacion_variantes_pkey PRIMARY KEY (id),
  CONSTRAINT fk_variante_articulo FOREIGN KEY (articulo_id) REFERENCES public.articulos_dotacion(id)
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
  contrato_id integer,
  rol_puesto character varying DEFAULT 'titular'::character varying CHECK (rol_puesto::text = ANY (ARRAY['titular'::character varying, 'relevante'::character varying]::text[])),
  patron_descanso character varying,
  fecha_inicio_patron date DEFAULT CURRENT_DATE,
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
  registrada_por integer,
  created_at timestamp without time zone DEFAULT now(),
  empleado_id integer,
  latitud_entrada text,
  longitud_entrada text,
  latitud_salida text,
  longitud_salida text,
  evidencia_foto_url text,
  verificado_jefe boolean DEFAULT false,
  validacion_facial_score numeric,
  CONSTRAINT asistencias_pkey PRIMARY KEY (id),
  CONSTRAINT asistencias_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id),
  CONSTRAINT asistencias_registrada_por_fkey FOREIGN KEY (registrada_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT asistencias_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.aspirantes (
  id integer NOT NULL DEFAULT nextval('aspirantes_id_seq'::regclass),
  nombre_completo character varying NOT NULL,
  cedula character varying NOT NULL UNIQUE,
  telefono character varying NOT NULL,
  correo character varying,
  estado character varying DEFAULT 'nuevo'::character varying CHECK (estado::text = ANY (ARRAY['nuevo'::character varying, 'en_proceso'::character varying, 'aprobado'::character varying, 'descartado'::character varying, 'contratado'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT aspirantes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.aspirantes_datos_pre_empleado (
  id integer NOT NULL DEFAULT nextval('aspirantes_datos_pre_empleado_id_seq'::regclass),
  aspirante_id integer NOT NULL,
  nombre_completo character varying NOT NULL,
  cedula character varying NOT NULL,
  fecha_expedicion date,
  lugar_expedicion character varying,
  fecha_nacimiento date,
  genero character varying,
  rh character varying,
  estado_civil character varying,
  telefono character varying,
  telefono_secundario character varying,
  correo character varying,
  departamento character varying,
  ciudad character varying,
  direccion text,
  formacion_academica character varying,
  observaciones text,
  eps_id integer,
  arl_id integer,
  fondo_pension_id integer,
  tiene_discapacidad boolean DEFAULT false,
  observacion_discapacidad text,
  completado boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT aspirantes_datos_pre_empleado_pkey PRIMARY KEY (id),
  CONSTRAINT aspirantes_datos_pre_empleado_aspirante_id_fkey FOREIGN KEY (aspirante_id) REFERENCES public.aspirantes(id),
  CONSTRAINT aspirantes_datos_pre_empleado_eps_id_fkey FOREIGN KEY (eps_id) REFERENCES public.eps(id),
  CONSTRAINT aspirantes_datos_pre_empleado_arl_id_fkey FOREIGN KEY (arl_id) REFERENCES public.arl(id),
  CONSTRAINT aspirantes_datos_pre_empleado_fondo_pension_id_fkey FOREIGN KEY (fondo_pension_id) REFERENCES public.fondos_pension(id)
);
CREATE TABLE public.aspirantes_intentos_prueba (
  id integer NOT NULL DEFAULT nextval('aspirantes_intentos_prueba_id_seq'::regclass),
  aspirante_id integer NOT NULL,
  prueba_id integer NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  fecha_programada date NOT NULL,
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  direccion text NOT NULL,
  latitud numeric NOT NULL,
  longitud numeric NOT NULL,
  radio_metros integer DEFAULT 100,
  fecha_inicio_real timestamp without time zone,
  fecha_fin_real timestamp without time zone,
  presentado boolean DEFAULT false,
  porcentaje numeric,
  aprobado boolean,
  ip_origen inet,
  dispositivo text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT aspirantes_intentos_prueba_pkey PRIMARY KEY (id),
  CONSTRAINT aspirantes_intentos_prueba_aspirante_id_fkey FOREIGN KEY (aspirante_id) REFERENCES public.aspirantes(id),
  CONSTRAINT aspirantes_intentos_prueba_prueba_id_fkey FOREIGN KEY (prueba_id) REFERENCES public.aspirantes_pruebas(id)
);
CREATE TABLE public.aspirantes_preguntas (
  id integer NOT NULL DEFAULT nextval('aspirantes_preguntas_id_seq'::regclass),
  prueba_id integer NOT NULL,
  pregunta text NOT NULL,
  retroalimentacion text,
  orden integer,
  activa boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT aspirantes_preguntas_pkey PRIMARY KEY (id),
  CONSTRAINT aspirantes_preguntas_prueba_id_fkey FOREIGN KEY (prueba_id) REFERENCES public.aspirantes_pruebas(id)
);
CREATE TABLE public.aspirantes_preguntas_opciones (
  id integer NOT NULL DEFAULT nextval('aspirantes_preguntas_opciones_id_seq'::regclass),
  pregunta_id integer NOT NULL,
  texto text NOT NULL,
  es_correcta boolean DEFAULT false,
  orden integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT aspirantes_preguntas_opciones_pkey PRIMARY KEY (id),
  CONSTRAINT aspirantes_preguntas_opciones_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES public.aspirantes_preguntas(id)
);
CREATE TABLE public.aspirantes_pruebas (
  id integer NOT NULL DEFAULT nextval('aspirantes_pruebas_id_seq'::regclass),
  nombre character varying NOT NULL,
  descripcion text,
  tiempo_minutos integer NOT NULL,
  puntaje_minimo numeric NOT NULL CHECK (puntaje_minimo >= 0::numeric AND puntaje_minimo <= 100::numeric),
  activa boolean DEFAULT true,
  creada_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT aspirantes_pruebas_pkey PRIMARY KEY (id),
  CONSTRAINT aspirantes_pruebas_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.aspirantes_respuestas (
  id integer NOT NULL DEFAULT nextval('aspirantes_respuestas_id_seq'::regclass),
  intento_id integer NOT NULL,
  pregunta_id integer NOT NULL,
  opcion_id integer NOT NULL,
  es_correcta boolean,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT aspirantes_respuestas_pkey PRIMARY KEY (id),
  CONSTRAINT aspirantes_respuestas_intento_id_fkey FOREIGN KEY (intento_id) REFERENCES public.aspirantes_intentos_prueba(id),
  CONSTRAINT aspirantes_respuestas_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES public.aspirantes_preguntas(id),
  CONSTRAINT aspirantes_respuestas_opcion_id_fkey FOREIGN KEY (opcion_id) REFERENCES public.aspirantes_preguntas_opciones(id)
);
CREATE TABLE public.audit_legal_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id integer,
  entidad character varying NOT NULL,
  entidad_id character varying NOT NULL,
  accion character varying NOT NULL,
  detalles jsonb,
  ip character varying,
  user_agent text,
  timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  hash_integridad text NOT NULL,
  CONSTRAINT audit_legal_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_legal_log_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
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
  estado_anterior jsonb,
  estado_nuevo jsonb,
  CONSTRAINT auditoria_pkey PRIMARY KEY (id),
  CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.boton_panico_eventos (
  id integer NOT NULL DEFAULT nextval('boton_panico_eventos_id_seq'::regclass),
  origen character varying NOT NULL CHECK (origen::text = ANY (ARRAY['empleado'::character varying, 'cliente'::character varying]::text[])),
  empleado_id integer,
  cliente_id integer,
  usuario_id integer NOT NULL,
  puesto_id integer,
  contrato_id integer,
  turno_id integer,
  latitud numeric,
  longitud numeric,
  precision_metros numeric,
  ip_origen inet,
  dispositivo character varying,
  version_app character varying,
  estado character varying NOT NULL DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'atendido'::character varying, 'falso'::character varying, 'cerrado'::character varying]::text[])),
  atendido_por integer,
  fecha_atencion timestamp without time zone,
  tiempo_respuesta_segundos integer,
  minuta_id integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT boton_panico_eventos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_panico_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_panico_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT fk_panico_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT fk_panico_puesto FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT fk_panico_contrato FOREIGN KEY (contrato_id) REFERENCES public.contratos(id),
  CONSTRAINT fk_panico_turno FOREIGN KEY (turno_id) REFERENCES public.turnos(id),
  CONSTRAINT fk_panico_atendido_por FOREIGN KEY (atendido_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT fk_panico_minuta FOREIGN KEY (minuta_id) REFERENCES public.minutas(id)
);
CREATE TABLE public.calendario_eventos (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  usuario_id integer NOT NULL,
  titulo character varying NOT NULL,
  descripcion text,
  fecha_inicio timestamp without time zone NOT NULL,
  fecha_fin timestamp without time zone NOT NULL,
  todo_el_dia boolean DEFAULT false,
  ubicacion character varying,
  color character varying DEFAULT '#3788d8'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT calendario_eventos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_calendario_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.calendario_recordatorios (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  evento_id integer NOT NULL,
  fecha_programada timestamp without time zone NOT NULL,
  tipo_notificacion character varying DEFAULT 'sistema'::character varying CHECK (tipo_notificacion::text = ANY (ARRAY['correo'::text, 'push'::text, 'sistema'::text])),
  enviado boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT calendario_recordatorios_pkey PRIMARY KEY (id),
  CONSTRAINT fk_recordatorio_evento FOREIGN KEY (evento_id) REFERENCES public.calendario_eventos(id)
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
CREATE TABLE public.categorias_dotacion (
  id integer NOT NULL DEFAULT nextval('categorias_dotacion_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT categorias_dotacion_pkey PRIMARY KEY (id)
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
CREATE TABLE public.clientes_configuracion (
  id integer NOT NULL DEFAULT nextval('clientes_configuracion_id_seq'::regclass),
  cliente_id integer UNIQUE,
  horarios jsonb,
  reglas_visitas jsonb,
  limites jsonb,
  branding jsonb,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT clientes_configuracion_pkey PRIMARY KEY (id),
  CONSTRAINT clientes_configuracion_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
);
CREATE TABLE public.comunicaciones_historial (
  id integer NOT NULL DEFAULT nextval('comunicaciones_historial_id_seq'::regclass),
  sesion_id text NOT NULL,
  empleado_id integer,
  puesto_id integer,
  usuario_dashboard_id integer,
  tipo text NOT NULL DEFAULT 'audio'::text,
  duracion_segundos integer,
  audio_path text,
  audio_url text,
  latitud numeric,
  longitud numeric,
  fecha_inicio timestamp with time zone,
  fecha_fin timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comunicaciones_historial_pkey PRIMARY KEY (id),
  CONSTRAINT comunicaciones_historial_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT comunicaciones_historial_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT comunicaciones_historial_usuario_dashboard_id_fkey FOREIGN KEY (usuario_dashboard_id) REFERENCES public.usuarios_externos(id)
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
CREATE TABLE public.consentimientos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  usuario_id integer,
  empleado_id integer,
  politica_id integer NOT NULL,
  aceptado boolean NOT NULL DEFAULT true,
  ip_address character varying,
  user_agent text,
  firmado_hash character varying,
  metadatos jsonb,
  revocado boolean DEFAULT false,
  fecha_revocacion timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT consentimientos_pkey PRIMARY KEY (id),
  CONSTRAINT consentimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT consentimientos_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT consentimientos_politica_id_fkey FOREIGN KEY (politica_id) REFERENCES public.politicas(id)
);
CREATE TABLE public.consentimientos_empleado (
  id integer NOT NULL DEFAULT nextval('consentimientos_empleado_id_seq'::regclass),
  empleado_id integer NOT NULL,
  documento_generado_id integer,
  tipo_consentimiento character varying NOT NULL,
  acepta boolean DEFAULT false,
  fecha_consentimiento timestamp with time zone DEFAULT now(),
  documento_pdf_url text,
  datos_json jsonb,
  vigente boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT consentimientos_empleado_pkey PRIMARY KEY (id),
  CONSTRAINT consentimientos_empleado_documento_generado_id_fkey FOREIGN KEY (documento_generado_id) REFERENCES public.documentos_generados(id),
  CONSTRAINT consentimientos_empleado_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.consentimientos_informados (
  id integer NOT NULL DEFAULT nextval('consentimientos_informados_id_seq'::regclass),
  empleado_id integer,
  documento_generado_id integer,
  tipo_consentimiento character varying NOT NULL,
  fecha_aceptacion timestamp without time zone DEFAULT now(),
  vigente boolean DEFAULT true,
  observaciones text,
  CONSTRAINT consentimientos_informados_pkey PRIMARY KEY (id),
  CONSTRAINT consentimientos_informados_documento_generado_id_fkey FOREIGN KEY (documento_generado_id) REFERENCES public.documentos_generados(id),
  CONSTRAINT consentimientos_informados_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.contratos (
  id integer NOT NULL DEFAULT nextval('contratos_id_seq'::regclass),
  cliente_id integer,
  tipo_servicio_id integer,
  valor numeric,
  guardas_activos integer,
  fecha_inicio date,
  fecha_fin date,
  estado boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  cotizacion_origen_id integer,
  documento_generado_id integer,
  estado_firma character varying DEFAULT 'pendiente'::character varying,
  CONSTRAINT contratos_pkey PRIMARY KEY (id),
  CONSTRAINT contratos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT contratos_tipo_servicio_id_fkey FOREIGN KEY (tipo_servicio_id) REFERENCES public.tipo_servicio(id),
  CONSTRAINT contratos_cotizacion_origen_id_fkey FOREIGN KEY (cotizacion_origen_id) REFERENCES public.cotizaciones(id),
  CONSTRAINT contratos_documento_generado_id_fkey FOREIGN KEY (documento_generado_id) REFERENCES public.documentos_generados(id)
);
CREATE TABLE public.contratos_personal (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  empleado_id integer NOT NULL,
  tipo_contrato character varying NOT NULL CHECK (tipo_contrato::text = ANY (ARRAY['prueba_3_meses'::character varying, 'termino_fijo'::character varying, 'termino_indefinido'::character varying, 'obra_labor'::character varying]::text[])),
  fecha_inicio date NOT NULL,
  fecha_fin date,
  fecha_fin_prueba date,
  salario_id integer NOT NULL,
  contrato_pdf_url text,
  terminacion_pdf_url text,
  contrato_anterior_id integer,
  creado_por integer,
  estado character varying DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'finalizado'::character varying, 'terminado'::character varying, 'renovado'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT now(),
  modalidad_trabajo character varying NOT NULL DEFAULT 'tiempo_completo'::character varying CHECK (modalidad_trabajo::text = ANY (ARRAY['tiempo_completo'::character varying, 'medio_tiempo'::character varying, 'virtual'::character varying, 'por_horas'::character varying, 'turnos'::character varying, 'practicas'::character varying, 'otro'::character varying]::text[])),
  documento_generado_id integer,
  CONSTRAINT contratos_personal_pkey PRIMARY KEY (id),
  CONSTRAINT fk_contrato_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_contrato_salario FOREIGN KEY (salario_id) REFERENCES public.salarios(id),
  CONSTRAINT fk_contrato_anterior FOREIGN KEY (contrato_anterior_id) REFERENCES public.contratos_personal(id),
  CONSTRAINT contratos_personal_documento_generado_id_fkey FOREIGN KEY (documento_generado_id) REFERENCES public.documentos_generados(id)
);
CREATE TABLE public.correos_asignaciones (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  correo_id integer NOT NULL,
  empleado_id integer NOT NULL,
  fecha_asignacion timestamp without time zone DEFAULT now(),
  fecha_devolucion timestamp without time zone,
  activo boolean DEFAULT true,
  asignado_por integer,
  observaciones text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT correos_asignaciones_pkey PRIMARY KEY (id),
  CONSTRAINT fk_asignacion_correo FOREIGN KEY (correo_id) REFERENCES public.correos_corporativos(id),
  CONSTRAINT fk_asignacion_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_asignacion_realizada_por FOREIGN KEY (asignado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.correos_corporativos (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  direccion_correo character varying NOT NULL UNIQUE,
  contrasena character varying,
  proveedor character varying DEFAULT 'corporativo'::character varying,
  numero_recuperacion character varying,
  correo_recuperacion character varying,
  estado character varying DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::text, 'suspendido'::text, 'bloqueado'::text, 'eliminado'::text])),
  fecha_creacion_cuenta date,
  fecha_ultima_verificacion timestamp without time zone,
  verificado_por integer,
  observaciones_verificacion text,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT correos_corporativos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_correo_verificado_por FOREIGN KEY (verificado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT fk_correo_creado_por FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.cotizaciones (
  id integer NOT NULL DEFAULT nextval('cotizaciones_id_seq'::regclass),
  cliente_id integer,
  prospecto_datos jsonb,
  fecha_emision date DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  subtotal numeric NOT NULL DEFAULT 0,
  impuestos numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  estado character varying DEFAULT 'borrador'::character varying CHECK (estado::text = ANY (ARRAY['borrador'::character varying, 'en_proceso'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'vencida'::character varying]::text[])),
  observaciones text,
  creado_por integer,
  aprobado_por integer,
  contrato_generado_id integer,
  documento_generado_id integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  public_token character varying UNIQUE,
  public_token_expires_at timestamp without time zone,
  fecha_envio timestamp without time zone,
  fecha_aceptacion timestamp without time zone,
  fecha_rechazo timestamp without time zone,
  fecha_expiracion timestamp without time zone,
  motivo_rechazo text,
  CONSTRAINT cotizaciones_pkey PRIMARY KEY (id),
  CONSTRAINT cotizaciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT cotizaciones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT cotizaciones_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT cotizaciones_contrato_generado_id_fkey FOREIGN KEY (contrato_generado_id) REFERENCES public.contratos(id),
  CONSTRAINT cotizaciones_documento_generado_id_fkey FOREIGN KEY (documento_generado_id) REFERENCES public.documentos_generados(id)
);
CREATE TABLE public.cotizaciones_items (
  id integer NOT NULL DEFAULT nextval('cotizaciones_items_id_seq'::regclass),
  cotizacion_id integer,
  tipo_servicio_id integer,
  descripcion character varying NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  total_linea numeric NOT NULL DEFAULT 0,
  CONSTRAINT cotizaciones_items_pkey PRIMARY KEY (id),
  CONSTRAINT cotizaciones_items_tipo_servicio_id_fkey FOREIGN KEY (tipo_servicio_id) REFERENCES public.tipo_servicio(id),
  CONSTRAINT cotizaciones_items_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES public.cotizaciones(id)
);
CREATE TABLE public.documentos_generados (
  id integer NOT NULL DEFAULT nextval('documentos_generados_id_seq'::regclass),
  plantilla_id integer,
  codigo_referencia uuid DEFAULT gen_random_uuid() UNIQUE,
  entidad_tipo character varying NOT NULL,
  entidad_id integer NOT NULL,
  datos_json jsonb NOT NULL,
  url_pdf text,
  estado character varying DEFAULT 'borrador'::character varying CHECK (estado::text = ANY (ARRAY['borrador'::character varying, 'generando_pdf'::character varying, 'pendiente_firmas'::character varying, 'firmado'::character varying, 'anulado'::character varying, 'cerrado'::character varying, 'enviado'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  fecha_generacion timestamp without time zone,
  fecha_envio_firmas timestamp without time zone,
  fecha_cierre timestamp without time zone,
  created_by_id integer,
  CONSTRAINT documentos_generados_pkey PRIMARY KEY (id),
  CONSTRAINT documentos_generados_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES public.plantillas_documentos(id)
);
CREATE TABLE public.dotacion_programacion (
  id integer NOT NULL DEFAULT nextval('dotacion_programacion_id_seq'::regclass),
  empleado_id integer NOT NULL,
  fecha_ultima_dotacion date,
  fecha_proxima_dotacion date,
  estado character varying DEFAULT 'pendiente'::character varying CHECK (estado::text = ANY (ARRAY['pendiente'::character varying, 'entregada'::character varying, 'vencida'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT dotacion_programacion_pkey PRIMARY KEY (id),
  CONSTRAINT fk_prog_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.dotaciones_empleado (
  id integer NOT NULL DEFAULT nextval('dotaciones_empleado_id_seq'::regclass),
  empleado_id integer NOT NULL,
  variante_id integer NOT NULL,
  cantidad integer DEFAULT 1 CHECK (cantidad > 0),
  fecha_entrega date DEFAULT CURRENT_DATE,
  entregado_por integer NOT NULL,
  observaciones text,
  created_at timestamp without time zone DEFAULT now(),
  condicion character varying NOT NULL DEFAULT 'nuevo'::character varying CHECK (condicion::text = ANY (ARRAY['nuevo'::character varying, 'segunda'::character varying]::text[])),
  CONSTRAINT dotaciones_empleado_pkey PRIMARY KEY (id),
  CONSTRAINT fk_dot_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_dot_variante FOREIGN KEY (variante_id) REFERENCES public.articulos_dotacion_variantes(id),
  CONSTRAINT fk_dot_entregado_por FOREIGN KEY (entregado_por) REFERENCES public.usuarios_externos(id)
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
  documento_generado_id integer,
  CONSTRAINT empleado_capacitaciones_pkey PRIMARY KEY (id),
  CONSTRAINT empleado_capacitaciones_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT empleado_capacitaciones_capacitacion_id_fkey FOREIGN KEY (capacitacion_id) REFERENCES public.capacitaciones(id),
  CONSTRAINT empleado_capacitaciones_documento_generado_id_fkey FOREIGN KEY (documento_generado_id) REFERENCES public.documentos_generados(id)
);
CREATE TABLE public.empleado_financiero (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  empleado_id integer NOT NULL,
  banco character varying NOT NULL,
  tipo_cuenta character varying NOT NULL CHECK (tipo_cuenta::text = ANY (ARRAY['ahorros'::character varying, 'corriente'::character varying]::text[])),
  numero_cuenta character varying NOT NULL,
  metodo_pago character varying DEFAULT 'transferencia'::character varying,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT empleado_financiero_pkey PRIMARY KEY (id),
  CONSTRAINT fk_financiero_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.empleado_ubicaciones (
  id bigint NOT NULL DEFAULT nextval('empleado_ubicaciones_id_seq'::regclass),
  empleado_id integer NOT NULL,
  usuario_id integer,
  sesion_id integer,
  latitud numeric NOT NULL,
  longitud numeric NOT NULL,
  precision_metros numeric,
  velocidad numeric,
  bateria integer,
  origen character varying DEFAULT 'app'::character varying,
  evento character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT empleado_ubicaciones_pkey PRIMARY KEY (id),
  CONSTRAINT fk_ubicacion_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_ubicacion_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT fk_ubicacion_sesion FOREIGN KEY (sesion_id) REFERENCES public.sesiones_usuario(id)
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
  direccion character varying,
  departamento character varying,
  ciudad character varying,
  estado_civil character varying,
  genero character varying,
  eps_id integer,
  arl_id integer,
  fondo_pension_id integer,
  fecha_afiliacion_eps date,
  fecha_fin_eps date,
  fecha_afiliacion_arl date,
  fecha_fin_arl date,
  fecha_afiliacion_pension date,
  fecha_fin_pension date,
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
  asignado boolean DEFAULT false,
  nivel_confianza numeric DEFAULT 0,
  riesgo_ausencia numeric DEFAULT 0,
  rendimiento_promedio numeric DEFAULT 0,
  ultima_evaluacion timestamp without time zone DEFAULT now(),
  formacion_academica text,
  edad integer,
  contrato_personal_id integer,
  rh character varying CHECK (rh::text = ANY (ARRAY['O+'::character varying, 'O-'::character varying, 'A+'::character varying, 'A-'::character varying, 'B+'::character varying, 'B-'::character varying, 'AB+'::character varying, 'AB-'::character varying]::text[])),
  lugar_expedicion character varying,
  telefono_2 character varying,
  tiene_discapacidad boolean DEFAULT false,
  descripcion_discapacidad text,
  experiencia text,
  observaciones text,
  tipo_vigilante_id integer,
  tiene_curso_vigilancia boolean DEFAULT false,
  tipo_curso_vigilancia_id integer,
  fecha_vencimiento_curso date,
  deleted_at timestamp with time zone,
  deleted_by integer,
  deletion_reason text,
  firma_digital_base64 text,
  cargo_oficial character varying,
  numero_cuenta character varying,
  entidad_bancaria character varying,
  tipo_cuenta character varying,
  certificado_bancario_url text,
  CONSTRAINT empleados_pkey PRIMARY KEY (id),
  CONSTRAINT empleados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT empleados_eps_id_fkey FOREIGN KEY (eps_id) REFERENCES public.eps(id),
  CONSTRAINT empleados_arl_id_fkey FOREIGN KEY (arl_id) REFERENCES public.arl(id),
  CONSTRAINT empleados_fondo_pension_id_fkey FOREIGN KEY (fondo_pension_id) REFERENCES public.fondos_pension(id),
  CONSTRAINT empleados_verificado_por_fkey FOREIGN KEY (verificado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT empleados_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT empleados_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT fk_empleado_contrato_activo FOREIGN KEY (contrato_personal_id) REFERENCES public.contratos_personal(id),
  CONSTRAINT fk_empleados_tipo_vigilante FOREIGN KEY (tipo_vigilante_id) REFERENCES public.tipos_vigilante(id),
  CONSTRAINT fk_empleados_tipo_curso_vigilancia FOREIGN KEY (tipo_curso_vigilancia_id) REFERENCES public.tipos_curso_vigilancia(id),
  CONSTRAINT empleados_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.eps (
  id integer NOT NULL DEFAULT nextval('eps_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  codigo character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT eps_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feature_flags (
  flag_key character varying NOT NULL,
  enabled boolean DEFAULT false,
  description text,
  metadata jsonb,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT feature_flags_pkey PRIMARY KEY (flag_key)
);
CREATE TABLE public.festivos_colombia (
  fecha date NOT NULL,
  descripcion text,
  CONSTRAINT festivos_colombia_pkey PRIMARY KEY (fecha)
);
CREATE TABLE public.firmas_documentos (
  id integer NOT NULL DEFAULT nextval('firmas_documentos_id_seq'::regclass),
  documento_id integer,
  usuario_id integer,
  nombre_firmante character varying,
  documento_identidad_firmante character varying,
  cargo_firmante character varying,
  tipo_firma character varying DEFAULT 'digital'::character varying CHECK (tipo_firma::text = ANY (ARRAY['digital'::character varying, 'manuscrita_capturada'::character varying, 'biometrica'::character varying]::text[])),
  firma_base64 text,
  ip_address inet,
  fecha_firma timestamp without time zone DEFAULT now(),
  token_validacion uuid DEFAULT gen_random_uuid(),
  orden integer DEFAULT 1,
  empleado_id integer,
  huella_base64 text,
  CONSTRAINT firmas_documentos_pkey PRIMARY KEY (id),
  CONSTRAINT firmas_documentos_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.documentos_generados(id),
  CONSTRAINT firmas_documentos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT firmas_documentos_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.fm_archivos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  propietario_id integer NOT NULL,
  carpeta_id uuid,
  nombre_archivo text NOT NULL,
  extension text,
  mime_type text,
  tamano_bytes bigint,
  visibilidad text DEFAULT 'privado'::text CHECK (visibilidad = ANY (ARRAY['privado'::text, 'compartido'::text, 'publico'::text])),
  eliminado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fm_archivos_pkey PRIMARY KEY (id),
  CONSTRAINT fm_archivos_propietario_id_fkey FOREIGN KEY (propietario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT fm_archivos_carpeta_id_fkey FOREIGN KEY (carpeta_id) REFERENCES public.fm_carpetas(id)
);
CREATE TABLE public.fm_carpetas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  propietario_id integer NOT NULL,
  parent_id uuid,
  nombre text NOT NULL,
  color text DEFAULT '#F0F0F0'::text,
  eliminado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fm_carpetas_pkey PRIMARY KEY (id),
  CONSTRAINT fm_carpetas_propietario_id_fkey FOREIGN KEY (propietario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT fm_carpetas_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.fm_carpetas(id)
);
CREATE TABLE public.fm_permisos (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  usuario_destino_id integer NOT NULL,
  archivo_id uuid,
  carpeta_id uuid,
  permiso text DEFAULT 'lectura'::text CHECK (permiso = ANY (ARRAY['lectura'::text, 'escritura'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fm_permisos_pkey PRIMARY KEY (id),
  CONSTRAINT fm_permisos_usuario_destino_id_fkey FOREIGN KEY (usuario_destino_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT fm_permisos_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES public.fm_archivos(id),
  CONSTRAINT fm_permisos_carpeta_id_fkey FOREIGN KEY (carpeta_id) REFERENCES public.fm_carpetas(id)
);
CREATE TABLE public.fm_versiones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  archivo_id uuid NOT NULL,
  numero_version integer NOT NULL,
  url_storage text NOT NULL,
  comentario_cambio text,
  creado_por integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fm_versiones_pkey PRIMARY KEY (id),
  CONSTRAINT fm_versiones_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES public.fm_archivos(id),
  CONSTRAINT fm_versiones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.fondos_pension (
  id integer NOT NULL DEFAULT nextval('fondos_pension_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  codigo character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT fondos_pension_pkey PRIMARY KEY (id)
);
CREATE TABLE public.geocercas (
  id bigint NOT NULL DEFAULT nextval('geocercas_id_seq'::regclass),
  nombre character varying NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['puesto'::character varying, 'ruta_punto'::character varying, 'custom'::character varying]::text[])),
  radio_metros integer NOT NULL DEFAULT 50,
  latitud numeric NOT NULL,
  longitud numeric NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT geocercas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.geocercas_eventos (
  id bigint NOT NULL DEFAULT nextval('geocercas_eventos_id_seq'::regclass),
  geocerca_id bigint NOT NULL,
  empleado_id integer,
  evento character varying NOT NULL CHECK (evento::text = ANY (ARRAY['entrada'::character varying, 'salida'::character varying]::text[])),
  latitud numeric,
  longitud numeric,
  precision_metros numeric,
  timestamp timestamp without time zone DEFAULT now(),
  origen character varying DEFAULT 'gps'::character varying,
  CONSTRAINT geocercas_eventos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_evento_geocerca FOREIGN KEY (geocerca_id) REFERENCES public.geocercas(id),
  CONSTRAINT fk_evento_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.geocercas_puestos (
  id bigint NOT NULL DEFAULT nextval('geocercas_puestos_id_seq'::regclass),
  geocerca_id bigint NOT NULL,
  puesto_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT geocercas_puestos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_geo_puesto_geo FOREIGN KEY (geocerca_id) REFERENCES public.geocercas(id),
  CONSTRAINT fk_geo_puesto_puesto FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.geocercas_ruta_puntos (
  id bigint NOT NULL DEFAULT nextval('geocercas_ruta_puntos_id_seq'::regclass),
  geocerca_id bigint NOT NULL,
  ruta_punto_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT geocercas_ruta_puntos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_geo_ruta_geo FOREIGN KEY (geocerca_id) REFERENCES public.geocercas(id),
  CONSTRAINT fk_geo_ruta_punto FOREIGN KEY (ruta_punto_id) REFERENCES public.rutas_supervision_puntos(id)
);
CREATE TABLE public.geocercas_vertices (
  id bigint NOT NULL DEFAULT nextval('geocercas_vertices_id_seq'::regclass),
  geocerca_id bigint NOT NULL,
  orden integer NOT NULL,
  latitud numeric NOT NULL,
  longitud numeric NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT geocercas_vertices_pkey PRIMARY KEY (id),
  CONSTRAINT fk_vertice_geocerca FOREIGN KEY (geocerca_id) REFERENCES public.geocercas(id)
);
CREATE TABLE public.ia_comportamiento_anomalo (
  id integer NOT NULL DEFAULT nextval('ia_comportamiento_anomalo_id_seq'::regclass),
  empleado_id integer,
  puesto_id integer,
  tipo_anomalia character varying,
  descripcion text,
  nivel_alerta character varying CHECK (nivel_alerta::text = ANY (ARRAY['bajo'::character varying, 'medio'::character varying, 'alto'::character varying, 'critico'::character varying]::text[])),
  timestamp timestamp without time zone DEFAULT now(),
  evidencia_url text,
  procesado boolean DEFAULT false,
  CONSTRAINT ia_comportamiento_anomalo_pkey PRIMARY KEY (id),
  CONSTRAINT ia_comportamiento_anomalo_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT ia_comportamiento_anomalo_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.ia_modelos_configuracion (
  id integer NOT NULL DEFAULT nextval('ia_modelos_configuracion_id_seq'::regclass),
  nombre_modelo character varying,
  version character varying,
  parametros jsonb,
  fecha_entrenamiento timestamp without time zone DEFAULT now(),
  accuracy numeric,
  activo boolean DEFAULT true,
  tipo_modelo character varying CHECK (tipo_modelo::text = ANY (ARRAY['prediccion_incidentes'::character varying, 'reentrenamiento'::character varying, 'rutas'::character varying, 'comportamiento_anomalo'::character varying]::text[])),
  CONSTRAINT ia_modelos_configuracion_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ia_predicciones_incidentes (
  id integer NOT NULL DEFAULT nextval('ia_predicciones_incidentes_id_seq'::regclass),
  empleado_id integer,
  puesto_id integer,
  fecha_prediccion timestamp without time zone DEFAULT now(),
  tipo_prediccion character varying CHECK (tipo_prediccion::text = ANY (ARRAY['incidente'::character varying, 'ausencia'::character varying]::text[])),
  probabilidad numeric CHECK (probabilidad >= 0::numeric AND probabilidad <= 1::numeric),
  modelo_version character varying,
  observaciones text,
  procesado boolean DEFAULT false,
  CONSTRAINT ia_predicciones_incidentes_pkey PRIMARY KEY (id),
  CONSTRAINT ia_predicciones_incidentes_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT ia_predicciones_incidentes_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.ia_reentrenamiento_personal (
  id integer NOT NULL DEFAULT nextval('ia_reentrenamiento_personal_id_seq'::regclass),
  empleado_id integer,
  motivo text,
  nivel_riesgo character varying CHECK (nivel_riesgo::text = ANY (ARRAY['bajo'::character varying, 'medio'::character varying, 'alto'::character varying, 'critico'::character varying]::text[])),
  fecha_recomendacion timestamp without time zone DEFAULT now(),
  requiere_reentrenamiento boolean DEFAULT false,
  recomendacion text,
  evaluado_por_ia boolean DEFAULT true,
  CONSTRAINT ia_reentrenamiento_personal_pkey PRIMARY KEY (id),
  CONSTRAINT ia_reentrenamiento_personal_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
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
CREATE TABLE public.inventario_documentos (
  id integer NOT NULL DEFAULT nextval('inventario_documentos_id_seq'::regclass),
  proveedor_id integer,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['factura'::character varying, 'pedido'::character varying, 'remision'::character varying]::text[])),
  numero_documento character varying,
  fecha date,
  url_pdf text,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT inventario_documentos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_documento_proveedor FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id),
  CONSTRAINT fk_documento_creado_por FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.inventario_movimientos (
  id integer NOT NULL DEFAULT nextval('inventario_movimientos_id_seq'::regclass),
  variante_id integer NOT NULL,
  tipo_movimiento character varying NOT NULL CHECK (tipo_movimiento::text = ANY (ARRAY['entrada'::character varying, 'salida'::character varying, 'ajuste'::character varying]::text[])),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  motivo text,
  documento_id integer,
  empleado_id integer,
  realizado_por integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT inventario_movimientos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_mov_variante FOREIGN KEY (variante_id) REFERENCES public.articulos_dotacion_variantes(id),
  CONSTRAINT fk_mov_documento FOREIGN KEY (documento_id) REFERENCES public.inventario_documentos(id),
  CONSTRAINT fk_mov_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_mov_realizado_por FOREIGN KEY (realizado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.inventario_puesto (
  id integer NOT NULL DEFAULT nextval('inventario_puesto_id_seq'::regclass),
  puesto_id integer,
  variante_articulo_id integer,
  cantidad_actual integer DEFAULT 0,
  cantidad_minima integer DEFAULT 1,
  condicion character varying DEFAULT 'bueno'::character varying CHECK (condicion::text = ANY (ARRAY['nuevo'::character varying, 'bueno'::character varying, 'regular'::character varying, 'malo'::character varying, 'baja'::character varying]::text[])),
  ubicacion_detalle character varying,
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT inventario_puesto_pkey PRIMARY KEY (id),
  CONSTRAINT inventario_puesto_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT inventario_puesto_variante_articulo_id_fkey FOREIGN KEY (variante_articulo_id) REFERENCES public.articulos_dotacion_variantes(id)
);
CREATE TABLE public.inventario_puesto_movimientos (
  id integer NOT NULL DEFAULT nextval('inventario_puesto_movimientos_id_seq'::regclass),
  puesto_id integer,
  variante_articulo_id integer,
  tipo_movimiento character varying CHECK (tipo_movimiento::text = ANY (ARRAY['entrega_a_puesto'::character varying, 'retiro_de_puesto'::character varying, 'consumo'::character varying, 'baja'::character varying, 'traslado'::character varying]::text[])),
  cantidad integer NOT NULL,
  condicion_entrada character varying,
  responsable_id integer,
  fecha timestamp without time zone DEFAULT now(),
  observacion text,
  CONSTRAINT inventario_puesto_movimientos_pkey PRIMARY KEY (id),
  CONSTRAINT inventario_puesto_movimientos_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT inventario_puesto_movimientos_variante_articulo_id_fkey FOREIGN KEY (variante_articulo_id) REFERENCES public.articulos_dotacion_variantes(id),
  CONSTRAINT inventario_puesto_movimientos_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo character varying,
  estado character varying DEFAULT 'pending'::character varying,
  payload jsonb,
  error text,
  intentos integer DEFAULT 0,
  max_intentos integer DEFAULT 3,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  completed_at timestamp without time zone,
  CONSTRAINT jobs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.listas_acceso (
  id integer NOT NULL DEFAULT nextval('listas_acceso_id_seq'::regclass),
  puesto_id integer,
  documento character varying,
  placa character varying,
  tipo_lista character varying CHECK (tipo_lista::text = ANY (ARRAY['blanca'::character varying, 'negra'::character varying]::text[])),
  motivo text,
  fecha_vencimiento date,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT listas_acceso_pkey PRIMARY KEY (id),
  CONSTRAINT listas_acceso_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.memorandos (
  id integer NOT NULL DEFAULT nextval('memorandos_id_seq'::regclass),
  codigo character varying UNIQUE,
  titulo character varying NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['informativo'::character varying, 'preventivo'::character varying, 'disciplinario'::character varying, 'llamado_atencion'::character varying]::text[])),
  descripcion text NOT NULL,
  nivel_gravedad character varying CHECK (nivel_gravedad::text = ANY (ARRAY['bajo'::character varying, 'medio'::character varying, 'alto'::character varying, 'critico'::character varying]::text[])),
  estado character varying NOT NULL DEFAULT 'borrador'::character varying CHECK (estado::text = ANY (ARRAY['borrador'::character varying, 'enviado'::character varying, 'leido'::character varying, 'firmado'::character varying, 'cerrado'::character varying, 'anulado'::character varying]::text[])),
  fecha_emision timestamp without time zone DEFAULT now(),
  fecha_limite_firma timestamp without time zone,
  requiere_firma boolean DEFAULT false,
  creado_por integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT memorandos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_memorando_creado_por FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.memorandos_adjuntos (
  id integer NOT NULL DEFAULT nextval('memorandos_adjuntos_id_seq'::regclass),
  memorando_id integer NOT NULL,
  tipo character varying CHECK (tipo::text = ANY (ARRAY['imagen'::character varying, 'pdf'::character varying, 'audio'::character varying, 'video'::character varying, 'otro'::character varying]::text[])),
  url text NOT NULL,
  descripcion text,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT memorandos_adjuntos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_mem_adj_memorando FOREIGN KEY (memorando_id) REFERENCES public.memorandos(id),
  CONSTRAINT fk_mem_adj_usuario FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.memorandos_empleados (
  id integer NOT NULL DEFAULT nextval('memorandos_empleados_id_seq'::regclass),
  memorando_id integer NOT NULL,
  empleado_id integer NOT NULL,
  estado character varying NOT NULL DEFAULT 'pendiente'::character varying CHECK (estado::text = ANY (ARRAY['pendiente'::character varying, 'leido'::character varying, 'firmado'::character varying, 'rechazado'::character varying]::text[])),
  fecha_leido timestamp without time zone,
  fecha_firma timestamp without time zone,
  ip_firma inet,
  observacion_empleado text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT memorandos_empleados_pkey PRIMARY KEY (id),
  CONSTRAINT fk_mem_emp_memorando FOREIGN KEY (memorando_id) REFERENCES public.memorandos(id),
  CONSTRAINT fk_mem_emp_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.memorandos_firmas (
  id integer NOT NULL DEFAULT nextval('memorandos_firmas_id_seq'::regclass),
  memorando_empleado_id integer NOT NULL,
  metodo_firma character varying DEFAULT 'digital'::character varying CHECK (metodo_firma::text = ANY (ARRAY['digital'::character varying, 'biometrica'::character varying, 'token'::character varying, 'manual'::character varying]::text[])),
  firma_base64 text,
  dispositivo character varying,
  user_agent text,
  ip_address inet,
  fecha_firma timestamp without time zone DEFAULT now(),
  CONSTRAINT memorandos_firmas_pkey PRIMARY KEY (id),
  CONSTRAINT fk_mem_firma_mem_emp FOREIGN KEY (memorando_empleado_id) REFERENCES public.memorandos_empleados(id)
);
CREATE TABLE public.memorandos_historial (
  id integer NOT NULL DEFAULT nextval('memorandos_historial_id_seq'::regclass),
  memorando_id integer NOT NULL,
  accion character varying NOT NULL CHECK (accion::text = ANY (ARRAY['creado'::character varying, 'enviado'::character varying, 'leido'::character varying, 'firmado'::character varying, 'rechazado'::character varying, 'cerrado'::character varying, 'anulado'::character varying]::text[])),
  realizado_por integer,
  observacion text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT memorandos_historial_pkey PRIMARY KEY (id),
  CONSTRAINT fk_mem_hist_memorando FOREIGN KEY (memorando_id) REFERENCES public.memorandos(id),
  CONSTRAINT fk_mem_hist_usuario FOREIGN KEY (realizado_por) REFERENCES public.usuarios_externos(id)
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
  fecha date DEFAULT CURRENT_DATE,
  hora time without time zone DEFAULT CURRENT_TIME,
  tipo character varying,
  descripcion text,
  fotos jsonb DEFAULT '[]'::jsonb,
  ubicacion_lat numeric,
  ubicacion_lng numeric,
  firma_guardia text,
  firma_supervisor text,
  validado boolean DEFAULT false,
  validado_por integer,
  fecha_validacion timestamp without time zone,
  tipo_novedad character varying,
  titulo character varying,
  categoria character varying,
  nivel_riesgo character varying,
  videos jsonb DEFAULT '[]'::jsonb,
  adjuntos jsonb DEFAULT '[]'::jsonb,
  turno_entrante integer,
  turno_saliente integer,
  inventario_entregado jsonb DEFAULT '[]'::jsonb,
  observaciones_cambio text,
  ip_origen character varying,
  dispositivo character varying,
  version_app character varying,
  estado character varying DEFAULT 'activo'::character varying,
  CONSTRAINT minutas_pkey PRIMARY KEY (id),
  CONSTRAINT minutas_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id),
  CONSTRAINT minutas_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT minutas_validado_por_fkey FOREIGN KEY (validado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT minutas_turno_entrante_fkey FOREIGN KEY (turno_entrante) REFERENCES public.usuarios_externos(id),
  CONSTRAINT minutas_turno_saliente_fkey FOREIGN KEY (turno_saliente) REFERENCES public.usuarios_externos(id),
  CONSTRAINT minutas_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.minutas_rutas (
  id integer NOT NULL DEFAULT nextval('minutas_rutas_id_seq'::regclass),
  ejecucion_id integer NOT NULL,
  supervisor_id integer NOT NULL,
  puesto_id integer NOT NULL,
  tipo_chequeo_id integer NOT NULL,
  detalle_operativo text NOT NULL,
  novedades text,
  mejoras_sugeridas text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT minutas_rutas_pkey PRIMARY KEY (id),
  CONSTRAINT minutas_rutas_ejecucion_id_fkey FOREIGN KEY (ejecucion_id) REFERENCES public.rutas_supervision_ejecucion(id),
  CONSTRAINT minutas_rutas_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.empleados(id),
  CONSTRAINT minutas_rutas_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT minutas_rutas_tipo_chequeo_id_fkey FOREIGN KEY (tipo_chequeo_id) REFERENCES public.tipos_chequeo(id)
);
CREATE TABLE public.minutas_rutas_check_resultados (
  id integer NOT NULL DEFAULT nextval('minutas_rutas_check_resultados_id_seq'::regclass),
  minuta_id integer NOT NULL,
  item_id integer NOT NULL,
  resultado character varying NOT NULL,
  observacion text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT minutas_rutas_check_resultados_pkey PRIMARY KEY (id),
  CONSTRAINT minutas_rutas_check_resultados_minuta_id_fkey FOREIGN KEY (minuta_id) REFERENCES public.minutas_rutas(id),
  CONSTRAINT minutas_rutas_check_resultados_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.tipos_chequeo_items(id)
);
CREATE TABLE public.minutas_rutas_evidencias (
  id integer NOT NULL DEFAULT nextval('minutas_rutas_evidencias_id_seq'::regclass),
  minuta_id integer NOT NULL,
  tipo character varying CHECK (tipo::text = ANY (ARRAY['foto'::character varying, 'audio'::character varying, 'documento'::character varying]::text[])),
  url text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT minutas_rutas_evidencias_pkey PRIMARY KEY (id),
  CONSTRAINT minutas_rutas_evidencias_minuta_id_fkey FOREIGN KEY (minuta_id) REFERENCES public.minutas_rutas(id)
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
CREATE TABLE public.nomina_deducciones (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['porcentaje'::character varying, 'valor_fijo'::character varying]::text[])),
  valor numeric NOT NULL,
  aplica_a character varying NOT NULL CHECK (aplica_a::text = ANY (ARRAY['salario'::character varying, 'devengado_total'::character varying]::text[])),
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  creado_por integer,
  CONSTRAINT nomina_deducciones_pkey PRIMARY KEY (id),
  CONSTRAINT fk_nomina_deducciones_creado_por FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.nomina_empleado (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  empleado_id integer NOT NULL,
  contrato_id integer NOT NULL,
  salario_id integer NOT NULL,
  periodo_id integer NOT NULL,
  horas_normales numeric DEFAULT 0,
  horas_extra_diurnas numeric DEFAULT 0,
  horas_extra_nocturnas numeric DEFAULT 0,
  horas_extra_festivas numeric DEFAULT 0,
  horas_dominicales numeric DEFAULT 0,
  total_horas_extra numeric DEFAULT 0,
  total_recargos numeric DEFAULT 0,
  total_deducciones numeric DEFAULT 0,
  total_devengado numeric DEFAULT 0,
  total_pagar numeric DEFAULT 0,
  generado boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT nomina_empleado_pkey PRIMARY KEY (id),
  CONSTRAINT fk_nomina_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_nomina_contrato FOREIGN KEY (contrato_id) REFERENCES public.contratos_personal(id),
  CONSTRAINT fk_nomina_salario FOREIGN KEY (salario_id) REFERENCES public.salarios(id),
  CONSTRAINT fk_nomina_periodo FOREIGN KEY (periodo_id) REFERENCES public.nomina_periodos(id)
);
CREATE TABLE public.nomina_empleado_deducciones (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nomina_empleado_id integer NOT NULL,
  deduccion_id integer NOT NULL,
  valor_calculado numeric NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT nomina_empleado_deducciones_pkey PRIMARY KEY (id),
  CONSTRAINT fk_deduccion_tipo FOREIGN KEY (deduccion_id) REFERENCES public.nomina_deducciones(id),
  CONSTRAINT fk_deduccion_nomina FOREIGN KEY (nomina_empleado_id) REFERENCES public.nomina_empleado(id)
);
CREATE TABLE public.nomina_novedades (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  empleado_id integer NOT NULL,
  periodo_id integer NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['incapacidad_general'::character varying, 'incapacidad_laboral'::character varying, 'licencia_maternidad'::character varying, 'licencia_paternidad'::character varying, 'licencia_no_remunerada'::character varying, 'licencia_remunerada'::character varying, 'sancion'::character varying, 'bonificacion'::character varying, 'otro'::character varying]::text[])),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  dias integer NOT NULL CHECK (dias >= 0),
  observacion text,
  created_at timestamp without time zone DEFAULT now(),
  creado_por integer,
  CONSTRAINT nomina_novedades_pkey PRIMARY KEY (id),
  CONSTRAINT nomina_novedades_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT nomina_novedades_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.nomina_periodos(id),
  CONSTRAINT nomina_novedades_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.nomina_periodos (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  anio integer NOT NULL,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  cerrado boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  total_devengado numeric DEFAULT 0,
  total_deducciones numeric DEFAULT 0,
  total_pagar numeric DEFAULT 0,
  total_neto numeric DEFAULT 0,
  CONSTRAINT nomina_periodos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.nomina_valores_hora (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  anio integer NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['hora_normal'::text, 'hora_extra_diurna'::text, 'hora_extra_nocturna'::text, 'hora_extra_festiva'::text, 'hora_dominical'::text, 'recargo_nocturno'::text, 'salario_minimo'::text, 'auxilio_transporte'::text, 'salud_empleado'::text, 'pension_empleado'::text, 'otro'::text])),
  multiplicador numeric NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  creado_por integer,
  CONSTRAINT nomina_valores_hora_pkey PRIMARY KEY (id),
  CONSTRAINT fk_nomina_valores_hora_creado_por FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
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
CREATE TABLE public.notificaciones_dispositivos (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  usuario_id integer,
  empleado_id integer,
  token_dispositivo text NOT NULL UNIQUE,
  plataforma character varying CHECK (plataforma::text = ANY (ARRAY['android'::character varying, 'ios'::character varying, 'web'::character varying]::text[])),
  modelo_dispositivo character varying,
  app_version character varying,
  activo boolean DEFAULT true,
  ultimo_uso timestamp without time zone DEFAULT now(),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT notificaciones_dispositivos_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_dispositivos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT notificaciones_dispositivos_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.notificaciones_envios (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  destinatario_tipo character varying NOT NULL CHECK (destinatario_tipo::text = ANY (ARRAY['usuario'::character varying, 'empleado'::character varying, 'cliente'::character varying, 'sistema'::character varying]::text[])),
  destinatario_id integer NOT NULL,
  evento_id integer,
  canal USER-DEFINED NOT NULL,
  titulo character varying,
  mensaje text NOT NULL,
  datos_extra jsonb,
  accion_url text,
  estado USER-DEFINED DEFAULT 'pendiente'::notificacion_estado,
  prioridad USER-DEFINED DEFAULT 'media'::notificacion_prioridad,
  intentos_realizados integer DEFAULT 0,
  max_intentos integer DEFAULT 3,
  fecha_programada timestamp without time zone DEFAULT now(),
  fecha_envio timestamp without time zone,
  fecha_lectura timestamp without time zone,
  error_log text,
  proveedor_id_externo text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT notificaciones_envios_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_envios_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.notificaciones_eventos(id)
);
CREATE TABLE public.notificaciones_eventos (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  codigo character varying NOT NULL UNIQUE,
  nombre character varying NOT NULL,
  descripcion text,
  prioridad_por_defecto USER-DEFINED DEFAULT 'media'::notificacion_prioridad,
  canales_obligatorios ARRAY DEFAULT '{}'::notificacion_canal[],
  agrupar_notificaciones boolean DEFAULT false,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT notificaciones_eventos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notificaciones_plantillas (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  evento_id integer NOT NULL,
  canal USER-DEFINED NOT NULL,
  asunto_template text,
  cuerpo_template text NOT NULL,
  metadata_template jsonb,
  idioma character varying DEFAULT 'es'::character varying,
  version integer DEFAULT 1,
  activo boolean DEFAULT true,
  CONSTRAINT notificaciones_plantillas_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_plantillas_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.notificaciones_eventos(id)
);
CREATE TABLE public.notificaciones_preferencias (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  usuario_id integer,
  empleado_id integer,
  evento_id integer NOT NULL,
  canal USER-DEFINED NOT NULL,
  habilitado boolean DEFAULT true,
  horario_silencio_inicio time without time zone,
  horario_silencio_fin time without time zone,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT notificaciones_preferencias_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_preferencias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT notificaciones_preferencias_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT notificaciones_preferencias_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.notificaciones_eventos(id)
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
CREATE TABLE public.plantillas_documentos (
  id integer NOT NULL DEFAULT nextval('plantillas_documentos_id_seq'::regclass),
  nombre character varying NOT NULL,
  tipo character varying NOT NULL,
  contenido_html text NOT NULL,
  variables_requeridas jsonb DEFAULT '[]'::jsonb,
  version integer DEFAULT 1,
  activa boolean DEFAULT true,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT plantillas_documentos_pkey PRIMARY KEY (id),
  CONSTRAINT plantillas_documentos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.politicas (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  codigo character varying NOT NULL,
  nombre character varying NOT NULL,
  version character varying NOT NULL,
  contenido text NOT NULL,
  vigente boolean DEFAULT true,
  fecha_vigencia timestamp without time zone DEFAULT now(),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT politicas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pqrsf (
  id integer NOT NULL DEFAULT nextval('pqrsf_id_seq'::regclass),
  cliente_id integer NOT NULL,
  usuario_cliente_id integer NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['peticion'::character varying, 'queja'::character varying, 'reclamo'::character varying, 'sugerencia'::character varying, 'felicitacion'::character varying]::text[])),
  asunto character varying NOT NULL,
  descripcion text NOT NULL,
  estado character varying NOT NULL DEFAULT 'abierto'::character varying CHECK (estado::text = ANY (ARRAY['abierto'::character varying, 'en_proceso'::character varying, 'respondido'::character varying, 'cerrado'::character varying]::text[])),
  prioridad character varying DEFAULT 'media'::character varying CHECK (prioridad::text = ANY (ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying, 'critica'::character varying]::text[])),
  contrato_id integer,
  puesto_id integer,
  fecha_creacion timestamp without time zone DEFAULT now(),
  fecha_respuesta timestamp without time zone,
  fecha_cierre timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT pqrsf_pkey PRIMARY KEY (id),
  CONSTRAINT pqrsf_cliente_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT pqrsf_usuario_fk FOREIGN KEY (usuario_cliente_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT pqrsf_contrato_fk FOREIGN KEY (contrato_id) REFERENCES public.contratos(id),
  CONSTRAINT pqrsf_puesto_fk FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.pqrsf_adjuntos (
  id integer NOT NULL DEFAULT nextval('pqrsf_adjuntos_id_seq'::regclass),
  pqrsf_id integer NOT NULL,
  tipo character varying CHECK (tipo::text = ANY (ARRAY['imagen'::character varying, 'pdf'::character varying, 'audio'::character varying, 'video'::character varying, 'otro'::character varying]::text[])),
  url text NOT NULL,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT pqrsf_adjuntos_pkey PRIMARY KEY (id),
  CONSTRAINT pqrsf_adjuntos_pqrsf_fk FOREIGN KEY (pqrsf_id) REFERENCES public.pqrsf(id),
  CONSTRAINT pqrsf_adjuntos_usuario_fk FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.pqrsf_asignaciones (
  id integer NOT NULL DEFAULT nextval('pqrsf_asignaciones_id_seq'::regclass),
  pqrsf_id integer NOT NULL,
  asignado_a integer NOT NULL,
  asignado_por integer NOT NULL,
  fecha_asignacion timestamp without time zone DEFAULT now(),
  activo boolean DEFAULT true,
  CONSTRAINT pqrsf_asignaciones_pkey PRIMARY KEY (id),
  CONSTRAINT pqrsf_asignaciones_pqrsf_fk FOREIGN KEY (pqrsf_id) REFERENCES public.pqrsf(id),
  CONSTRAINT pqrsf_asignado_a_fk FOREIGN KEY (asignado_a) REFERENCES public.usuarios_externos(id),
  CONSTRAINT pqrsf_asignado_por_fk FOREIGN KEY (asignado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.pqrsf_respuestas (
  id integer NOT NULL DEFAULT nextval('pqrsf_respuestas_id_seq'::regclass),
  pqrsf_id integer NOT NULL,
  respondido_por integer NOT NULL,
  mensaje text NOT NULL,
  visible_para_cliente boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT pqrsf_respuestas_pkey PRIMARY KEY (id),
  CONSTRAINT pqrsf_respuesta_pqrsf_fk FOREIGN KEY (pqrsf_id) REFERENCES public.pqrsf(id),
  CONSTRAINT pqrsf_respuesta_usuario_fk FOREIGN KEY (respondido_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.proveedores (
  id integer NOT NULL DEFAULT nextval('proveedores_id_seq'::regclass),
  nombre character varying NOT NULL,
  nit character varying UNIQUE,
  telefono character varying,
  correo character varying,
  direccion text,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT proveedores_pkey PRIMARY KEY (id)
);
CREATE TABLE public.puestos_estudios_seguridad (
  id bigint NOT NULL DEFAULT nextval('puestos_estudios_seguridad_id_seq'::regclass),
  puesto_id integer NOT NULL,
  url_documento text NOT NULL,
  fecha_estudio date NOT NULL,
  fecha_vencimiento date,
  estado character varying NOT NULL DEFAULT 'vigente'::character varying,
  observaciones text,
  creado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT puestos_estudios_seguridad_pkey PRIMARY KEY (id),
  CONSTRAINT fk_estudio_puesto FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.puestos_trabajo (
  id integer NOT NULL DEFAULT nextval('puestos_trabajo_id_seq'::regclass),
  contrato_id integer NOT NULL,
  nombre character varying NOT NULL,
  direccion text,
  ciudad character varying,
  latitud numeric,
  longitud numeric,
  parent_id integer,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  creado_por integer,
  actualizado_por integer,
  tiene_arma boolean NOT NULL DEFAULT false,
  cantidad_armas integer NOT NULL DEFAULT 0,
  tiene_cctv boolean NOT NULL DEFAULT false,
  cantidad_camaras integer NOT NULL DEFAULT 0,
  deleted_at timestamp with time zone,
  deleted_by integer,
  deletion_reason text,
  CONSTRAINT puestos_trabajo_pkey PRIMARY KEY (id),
  CONSTRAINT puestos_trabajo_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT puestos_trabajo_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT puestos_trabajo_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id),
  CONSTRAINT puestos_trabajo_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT puestos_trabajo_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.usuarios_externos(id)
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
CREATE TABLE public.referencias_detalles (
  id integer NOT NULL DEFAULT nextval('referencias_detalles_id_seq'::regclass),
  verificacion_id integer,
  tipo_referencia character varying NOT NULL,
  nombre_contacto character varying,
  empresa_institucion character varying,
  telefono character varying,
  resultado_verificacion text,
  es_valida boolean DEFAULT false,
  observaciones text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT referencias_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT referencias_detalles_verificacion_id_fkey FOREIGN KEY (verificacion_id) REFERENCES public.verificacion_referencias(id)
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
CREATE TABLE public.residentes (
  id integer NOT NULL DEFAULT nextval('residentes_id_seq'::regclass),
  cliente_id integer,
  puesto_id integer,
  usuario_id integer,
  nombre_completo character varying NOT NULL,
  documento character varying NOT NULL,
  torre_bloque character varying,
  apto_casa character varying,
  telefono character varying,
  correo character varying,
  tipo_habitante character varying DEFAULT 'propietario'::character varying CHECK (tipo_habitante::text = ANY (ARRAY['propietario'::character varying, 'arrendatario'::character varying, 'familiar'::character varying, 'apoderado'::character varying]::text[])),
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT residentes_pkey PRIMARY KEY (id),
  CONSTRAINT residentes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT residentes_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT residentes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.residentes_vehiculos (
  id integer NOT NULL DEFAULT nextval('residentes_vehiculos_id_seq'::regclass),
  residente_id integer,
  placa character varying NOT NULL,
  tipo_vehiculo character varying DEFAULT 'carro'::character varying CHECK (tipo_vehiculo::text = ANY (ARRAY['carro'::character varying, 'moto'::character varying, 'bicicleta'::character varying, 'otro'::character varying]::text[])),
  marca character varying,
  color character varying,
  parqueadero_asignado character varying,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT residentes_vehiculos_pkey PRIMARY KEY (id),
  CONSTRAINT residentes_vehiculos_residente_id_fkey FOREIGN KEY (residente_id) REFERENCES public.residentes(id)
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
  usuario_id integer NOT NULL,
  modulo_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  concedido boolean DEFAULT true,
  CONSTRAINT roles_modulos_usuarios_externos_pkey PRIMARY KEY (id),
  CONSTRAINT roles_modulos_usuarios_externos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id),
  CONSTRAINT roles_modulos_usuarios_externos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.rondas_definicion (
  id integer NOT NULL DEFAULT nextval('rondas_definicion_id_seq'::regclass),
  nombre character varying NOT NULL,
  puesto_id integer,
  descripcion text,
  activa boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT rondas_definicion_pkey PRIMARY KEY (id),
  CONSTRAINT rondas_definicion_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.rondas_ejecucion (
  id integer NOT NULL DEFAULT nextval('rondas_ejecucion_id_seq'::regclass),
  ronda_definicion_id integer,
  rondero_id integer,
  fecha_inicio timestamp without time zone DEFAULT now(),
  fecha_fin timestamp without time zone,
  estado character varying DEFAULT 'en_proceso'::character varying CHECK (estado::text = ANY (ARRAY['en_proceso'::character varying, 'completada'::character varying, 'incompleta'::character varying, 'cancelada'::character varying]::text[])),
  observaciones text,
  CONSTRAINT rondas_ejecucion_pkey PRIMARY KEY (id),
  CONSTRAINT rondas_ejecucion_ronda_definicion_id_fkey FOREIGN KEY (ronda_definicion_id) REFERENCES public.rondas_definicion(id),
  CONSTRAINT rondas_ejecucion_rondero_id_fkey FOREIGN KEY (rondero_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.rondas_puntos (
  id integer NOT NULL DEFAULT nextval('rondas_puntos_id_seq'::regclass),
  ronda_definicion_id integer,
  nombre_punto character varying NOT NULL,
  orden integer NOT NULL,
  codigo_nfc_qr character varying,
  latitud_esperada numeric,
  longitud_esperada numeric,
  instrucciones text,
  CONSTRAINT rondas_puntos_pkey PRIMARY KEY (id),
  CONSTRAINT rondas_puntos_ronda_definicion_id_fkey FOREIGN KEY (ronda_definicion_id) REFERENCES public.rondas_definicion(id)
);
CREATE TABLE public.rondas_registros (
  id integer NOT NULL DEFAULT nextval('rondas_registros_id_seq'::regclass),
  ronda_ejecucion_id integer,
  punto_id integer,
  fecha_registro timestamp without time zone DEFAULT now(),
  latitud_real numeric,
  longitud_real numeric,
  foto_url text,
  comentario text,
  es_valido boolean DEFAULT true,
  CONSTRAINT rondas_registros_pkey PRIMARY KEY (id),
  CONSTRAINT rondas_registros_ronda_ejecucion_id_fkey FOREIGN KEY (ronda_ejecucion_id) REFERENCES public.rondas_ejecucion(id),
  CONSTRAINT rondas_registros_punto_id_fkey FOREIGN KEY (punto_id) REFERENCES public.rondas_puntos(id)
);
CREATE TABLE public.rondas_ronderos (
  id integer NOT NULL DEFAULT nextval('rondas_ronderos_id_seq'::regclass),
  rondero_id integer,
  puesto_id integer,
  hora_programada time without time zone NOT NULL,
  hora_real timestamp without time zone,
  latitud numeric,
  longitud numeric,
  distancia_desviacion numeric,
  estado character varying DEFAULT 'pendiente'::character varying CHECK (estado::text = ANY (ARRAY['pendiente'::character varying, 'cumplida'::character varying, 'fallida'::character varying]::text[])),
  observaciones text,
  validado boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT rondas_ronderos_pkey PRIMARY KEY (id),
  CONSTRAINT rondas_ronderos_rondero_id_fkey FOREIGN KEY (rondero_id) REFERENCES public.empleados(id),
  CONSTRAINT rondas_ronderos_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.rutas_gps (
  id integer NOT NULL DEFAULT nextval('rutas_gps_id_seq'::regclass),
  empleado_id integer,
  puesto_id integer,
  latitud numeric NOT NULL,
  longitud numeric NOT NULL,
  precision_gps numeric,
  timestamp timestamp without time zone DEFAULT now(),
  tipo_ruta character varying CHECK (tipo_ruta::text = ANY (ARRAY['supervisor'::character varying, 'rondero'::character varying, 'patrulla'::character varying]::text[])),
  evento character varying,
  observaciones text,
  CONSTRAINT rutas_gps_pkey PRIMARY KEY (id),
  CONSTRAINT rutas_gps_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT rutas_gps_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.rutas_supervision (
  id integer NOT NULL DEFAULT nextval('rutas_supervision_id_seq'::regclass),
  nombre character varying NOT NULL,
  descripcion text,
  activa boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  ciudad text,
  departamento text,
  tipo_turno character varying,
  CONSTRAINT rutas_supervision_pkey PRIMARY KEY (id)
);
CREATE TABLE public.rutas_supervision_asignacion (
  id integer NOT NULL DEFAULT nextval('rutas_supervision_asignacion_id_seq'::regclass),
  ruta_id integer NOT NULL,
  turno_id integer NOT NULL,
  supervisor_id integer NOT NULL,
  vehiculo_id integer,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT rutas_supervision_asignacion_pkey PRIMARY KEY (id),
  CONSTRAINT rutas_supervision_asignacion_ruta_id_fkey FOREIGN KEY (ruta_id) REFERENCES public.rutas_supervision(id),
  CONSTRAINT rutas_supervision_asignacion_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id),
  CONSTRAINT rutas_supervision_asignacion_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.empleados(id),
  CONSTRAINT rutas_supervision_asignacion_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id)
);
CREATE TABLE public.rutas_supervision_control (
  id integer NOT NULL DEFAULT nextval('rutas_supervision_control_id_seq'::regclass),
  ejecucion_id integer NOT NULL,
  tipo character varying NOT NULL,
  descripcion text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT rutas_supervision_control_pkey PRIMARY KEY (id),
  CONSTRAINT rutas_supervision_control_ejecucion_id_fkey FOREIGN KEY (ejecucion_id) REFERENCES public.rutas_supervision_ejecucion(id)
);
CREATE TABLE public.rutas_supervision_ejecucion (
  id integer NOT NULL DEFAULT nextval('rutas_supervision_ejecucion_id_seq'::regclass),
  ruta_asignacion_id integer NOT NULL,
  supervisor_id integer NOT NULL,
  vehiculo_id integer,
  fecha_inicio timestamp without time zone DEFAULT now(),
  fecha_fin timestamp without time zone,
  estado character varying DEFAULT 'iniciada'::character varying,
  CONSTRAINT rutas_supervision_ejecucion_pkey PRIMARY KEY (id),
  CONSTRAINT rutas_supervision_ejecucion_ruta_asignacion_id_fkey FOREIGN KEY (ruta_asignacion_id) REFERENCES public.rutas_supervision_asignacion(id),
  CONSTRAINT rutas_supervision_ejecucion_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.empleados(id),
  CONSTRAINT rutas_supervision_ejecucion_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id)
);
CREATE TABLE public.rutas_supervision_eventos (
  id integer NOT NULL DEFAULT nextval('rutas_supervision_eventos_id_seq'::regclass),
  ejecucion_id integer NOT NULL,
  fecha timestamp without time zone DEFAULT now(),
  lat numeric,
  lng numeric,
  tipo_evento character varying CHECK (tipo_evento::text = ANY (ARRAY['gps'::character varying, 'llegada'::character varying, 'salida'::character varying, 'detencion'::character varying, 'incidencia'::character varying]::text[])),
  observacion text,
  CONSTRAINT rutas_supervision_eventos_pkey PRIMARY KEY (id),
  CONSTRAINT rutas_supervision_eventos_ejecucion_id_fkey FOREIGN KEY (ejecucion_id) REFERENCES public.rutas_supervision_ejecucion(id)
);
CREATE TABLE public.rutas_supervision_puntos (
  id integer NOT NULL DEFAULT nextval('rutas_supervision_puntos_id_seq'::regclass),
  ruta_id integer NOT NULL,
  puesto_id integer NOT NULL,
  orden integer NOT NULL,
  radio_metros integer DEFAULT 50,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT rutas_supervision_puntos_pkey PRIMARY KEY (id),
  CONSTRAINT rutas_supervision_puntos_ruta_id_fkey FOREIGN KEY (ruta_id) REFERENCES public.rutas_supervision(id),
  CONSTRAINT rutas_supervision_puntos_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
);
CREATE TABLE public.rutas_supervision_reprogramaciones (
  id integer NOT NULL DEFAULT nextval('rutas_supervision_reprogramaciones_id_seq'::regclass),
  ejecucion_id integer NOT NULL,
  punto_id integer,
  motivo text NOT NULL,
  creado_por integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT rutas_supervision_reprogramaciones_pkey PRIMARY KEY (id),
  CONSTRAINT rutas_supervision_reprogramaciones_ejecucion_id_fkey FOREIGN KEY (ejecucion_id) REFERENCES public.rutas_supervision_ejecucion(id),
  CONSTRAINT rutas_supervision_reprogramaciones_punto_id_fkey FOREIGN KEY (punto_id) REFERENCES public.rutas_supervision_puntos(id),
  CONSTRAINT rutas_supervision_reprogramaciones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.empleados(id)
);
CREATE TABLE public.salarios (
  id integer NOT NULL DEFAULT nextval('salarios_id_seq'::regclass),
  nombre_salario character varying NOT NULL,
  valor numeric NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT salarios_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sesiones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id integer,
  token_hash character varying,
  ip_address character varying,
  user_agent text,
  expires_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sesiones_pkey PRIMARY KEY (id),
  CONSTRAINT sesiones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
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
  guardas_activos integer NOT NULL DEFAULT 1,
  CONSTRAINT subpuestos_trabajo_pkey PRIMARY KEY (id),
  CONSTRAINT subpuestos_trabajo_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT subpuestos_trabajo_configuracion_id_fkey FOREIGN KEY (configuracion_id) REFERENCES public.turnos_configuracion(id)
);
CREATE TABLE public.supervisor_vehiculos (
  id integer NOT NULL DEFAULT nextval('supervisor_vehiculos_id_seq'::regclass),
  supervisor_id integer NOT NULL,
  vehiculo_id integer NOT NULL,
  fecha_asignacion date DEFAULT CURRENT_DATE,
  activo boolean DEFAULT true,
  CONSTRAINT supervisor_vehiculos_pkey PRIMARY KEY (id),
  CONSTRAINT supervisor_vehiculos_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.empleados(id),
  CONSTRAINT supervisor_vehiculos_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id)
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
  actualizado_por integer,
  CONSTRAINT tipo_servicio_pkey PRIMARY KEY (id),
  CONSTRAINT tipo_servicio_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT tipo_servicio_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.tipos_chequeo (
  id integer NOT NULL DEFAULT nextval('tipos_chequeo_id_seq'::regclass),
  nombre character varying NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  CONSTRAINT tipos_chequeo_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tipos_chequeo_items (
  id integer NOT NULL DEFAULT nextval('tipos_chequeo_items_id_seq'::regclass),
  tipo_chequeo_id integer NOT NULL,
  pregunta text NOT NULL,
  descripcion text,
  obligatorio boolean DEFAULT true,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tipos_chequeo_items_pkey PRIMARY KEY (id),
  CONSTRAINT tipos_chequeo_items_tipo_chequeo_id_fkey FOREIGN KEY (tipo_chequeo_id) REFERENCES public.tipos_chequeo(id)
);
CREATE TABLE public.tipos_curso_vigilancia (
  id integer NOT NULL DEFAULT nextval('tipos_curso_vigilancia_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT tipos_curso_vigilancia_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tipos_vigilante (
  id integer NOT NULL DEFAULT nextval('tipos_vigilante_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT tipos_vigilante_pkey PRIMARY KEY (id)
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
  estado_turno character varying DEFAULT 'programado'::character varying CHECK (estado_turno::text = ANY (ARRAY['programado'::character varying, 'cumplido'::character varying, 'no_cumplido'::character varying, 'parcial'::character varying, 'pendiente_asignar'::character varying]::text[])),
  horas_reportadas numeric,
  duracion_horas numeric,
  fecha_fin timestamp without time zone,
  subpuesto_id integer,
  observaciones text,
  es_reemplazo boolean DEFAULT false,
  CONSTRAINT turnos_pkey PRIMARY KEY (id),
  CONSTRAINT turnos_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT turnos_asignado_por_fkey FOREIGN KEY (asignado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT turnos_subpuesto_id_fkey FOREIGN KEY (subpuesto_id) REFERENCES public.subpuestos_trabajo(id),
  CONSTRAINT turnos_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id)
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
  tiempo_total_minutos integer,
  tiempo_total_horas numeric,
  horas_normales numeric,
  horas_extras numeric,
  genero_horas_extra boolean DEFAULT false,
  horas_nocturnas numeric DEFAULT 0,
  horas_diurnas numeric DEFAULT 0,
  horas_dominicales numeric DEFAULT 0,
  horas_festivas numeric DEFAULT 0,
  minutos_tolerancia integer DEFAULT 0,
  foto_entrada text,
  foto_salida text,
  latitud_entrada text,
  longitud_entrada text,
  latitud_salida text,
  longitud_salida text,
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
  tipo_proyeccion character varying DEFAULT 'ciclico'::character varying CHECK (tipo_proyeccion::text = ANY (ARRAY['ciclico'::character varying, 'semanal_reglas'::character varying]::text[])),
  creado_por integer,
  actualizado_por integer,
  updated_at timestamp with time zone DEFAULT now(),
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
  dias_semana ARRAY,
  aplica_festivos character varying DEFAULT 'indiferente'::character varying CHECK (aplica_festivos::text = ANY (ARRAY['indiferente'::character varying, 'no_aplica'::character varying, 'solo_festivos'::character varying]::text[])),
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
CREATE TABLE public.turnos_reemplazos (
  id integer NOT NULL DEFAULT nextval('turnos_reemplazos_id_seq'::regclass),
  turno_original_id integer NOT NULL,
  empleado_reemplazo_id integer NOT NULL,
  motivo text,
  autorizado_por integer,
  fecha_autorizacion timestamp without time zone DEFAULT now(),
  estado character varying DEFAULT 'pendiente'::character varying CHECK (estado::text = ANY (ARRAY['pendiente'::character varying, 'aprobado'::character varying, 'rechazado'::character varying, 'ejecutado'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT turnos_reemplazos_pkey PRIMARY KEY (id),
  CONSTRAINT turnos_reemplazos_turno_original_id_fkey FOREIGN KEY (turno_original_id) REFERENCES public.turnos(id),
  CONSTRAINT turnos_reemplazos_empleado_reemplazo_id_fkey FOREIGN KEY (empleado_reemplazo_id) REFERENCES public.empleados(id),
  CONSTRAINT turnos_reemplazos_autorizado_por_fkey FOREIGN KEY (autorizado_por) REFERENCES public.usuarios_externos(id)
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
  bloqueado boolean DEFAULT false,
  bloqueado_motivo text,
  bloqueado_hasta timestamp without time zone,
  intentos_fallidos integer DEFAULT 0,
  ultimo_intento_fallido timestamp without time zone,
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
CREATE TABLE public.vehiculos (
  id integer NOT NULL DEFAULT nextval('vehiculos_id_seq'::regclass),
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['moto'::character varying, 'carro'::character varying]::text[])),
  placa character varying NOT NULL UNIQUE,
  marca character varying,
  modelo character varying,
  cilindraje integer,
  tarjeta_propietario character varying NOT NULL,
  soat_vencimiento date NOT NULL,
  tecnomecanica_vencimiento date NOT NULL,
  url_soat text,
  url_tecnomecanica text,
  url_tarjeta_propiedad text,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT vehiculos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.verificacion_referencias (
  id integer NOT NULL DEFAULT nextval('verificacion_referencias_id_seq'::regclass),
  aspirante_id integer,
  empleado_id integer,
  responsable_verificacion integer,
  estado character varying DEFAULT 'en_proceso'::character varying CHECK (estado::text = ANY (ARRAY['en_proceso'::character varying, 'finalizado'::character varying, 'con_hallazgos'::character varying]::text[])),
  documento_final_id integer,
  conclusiones text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT verificacion_referencias_pkey PRIMARY KEY (id),
  CONSTRAINT verificacion_referencias_aspirante_id_fkey FOREIGN KEY (aspirante_id) REFERENCES public.aspirantes(id),
  CONSTRAINT verificacion_referencias_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT verificacion_referencias_responsable_verificacion_fkey FOREIGN KEY (responsable_verificacion) REFERENCES public.usuarios_externos(id),
  CONSTRAINT verificacion_referencias_documento_final_id_fkey FOREIGN KEY (documento_final_id) REFERENCES public.documentos_generados(id)
);
CREATE TABLE public.visitantes (
  id integer NOT NULL DEFAULT nextval('visitantes_id_seq'::regclass),
  documento character varying NOT NULL UNIQUE,
  nombre_completo character varying NOT NULL,
  empresa_arl character varying,
  foto_url text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT visitantes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.visitas_registro (
  id integer NOT NULL DEFAULT nextval('visitas_registro_id_seq'::regclass),
  puesto_id integer,
  visitante_id integer,
  residente_destino_id integer,
  vehiculo_placa character varying,
  parqueadero_asignado character varying,
  fecha_entrada timestamp without time zone DEFAULT now(),
  fecha_salida timestamp without time zone,
  autorizado_por character varying,
  guardia_entrada_id integer,
  guardia_salida_id integer,
  observaciones text,
  tipo_ingreso character varying DEFAULT 'visitante'::character varying CHECK (tipo_ingreso::text = ANY (ARRAY['visitante'::character varying, 'domiciliario'::character varying, 'contratista'::character varying, 'prestador_servicio'::character varying]::text[])),
  estado character varying DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'finalizado'::character varying]::text[])),
  evidencia_entrada_url text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT visitas_registro_pkey PRIMARY KEY (id),
  CONSTRAINT visitas_registro_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT visitas_registro_visitante_id_fkey FOREIGN KEY (visitante_id) REFERENCES public.visitantes(id),
  CONSTRAINT visitas_registro_residente_destino_id_fkey FOREIGN KEY (residente_destino_id) REFERENCES public.residentes(id),
  CONSTRAINT visitas_registro_guardia_entrada_id_fkey FOREIGN KEY (guardia_entrada_id) REFERENCES public.usuarios_externos(id),
  CONSTRAINT visitas_registro_guardia_salida_id_fkey FOREIGN KEY (guardia_salida_id) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.visitas_tecnicas_puesto (
  id integer NOT NULL DEFAULT nextval('visitas_tecnicas_puesto_id_seq'::regclass),
  puesto_id integer,
  tipo_visitante character varying CHECK (tipo_visitante::text = ANY (ARRAY['coordinador'::character varying, 'supervisor'::character varying, 'ingeniero'::character varying, 'tecnico'::character varying, 'mensajero'::character varying]::text[])),
  nombre_visitante character varying NOT NULL,
  empresa character varying,
  fecha_llegada timestamp without time zone DEFAULT now(),
  fecha_salida timestamp without time zone,
  motivo_visita text,
  resultado_observaciones text,
  foto_evidencia_url text,
  registrado_por integer,
  created_at timestamp without time zone DEFAULT now(),
  solicitado_por_tipo text DEFAULT 'usuario'::text,
  solicitado_por_id integer,
  documento_generado_id integer,
  estado character varying DEFAULT 'programada'::character varying CHECK (estado::text = ANY (ARRAY['programada'::character varying, 'en_proceso'::character varying, 'completada'::character varying, 'incumplida'::character varying, 'cancelada'::character varying]::text[])),
  asignado_a integer,
  fecha_programada timestamp without time zone,
  cumplida boolean DEFAULT false,
  notas_programacion text,
  CONSTRAINT visitas_tecnicas_puesto_pkey PRIMARY KEY (id),
  CONSTRAINT visitas_tecnicas_puesto_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_trabajo(id),
  CONSTRAINT visitas_tecnicas_puesto_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT visitas_tecnicas_puesto_documento_generado_id_fkey FOREIGN KEY (documento_generado_id) REFERENCES public.documentos_generados(id),
  CONSTRAINT visitas_tecnicas_puesto_asignado_a_fkey FOREIGN KEY (asignado_a) REFERENCES public.usuarios_externos(id)
);
CREATE TABLE public.sedes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  ciudad VARCHAR(100) NOT NULL,
  departamento VARCHAR(100),
  codigo_postal VARCHAR(20),
  telefono VARCHAR(20),
  email VARCHAR(150),
  latitud DECIMAL(10,8),
  longitud DECIMAL(11,8),
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
ALTER TABLE public.empleados ADD COLUMN sede_id bigint;
ALTER TABLE public.empleados ADD CONSTRAINT empleados_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);