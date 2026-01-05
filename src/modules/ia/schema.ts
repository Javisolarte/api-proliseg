// WARNING: This schema is for context only and is not meant to be run.
// Table order and constraints may not be valid for execution.

export const schema = `-- WARNING: This schema is for context only and is not meant to be run.
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
  CONSTRAINT asistencias_pkey PRIMARY KEY (id),
  CONSTRAINT asistencias_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id),
  CONSTRAINT asistencias_registrada_por_fkey FOREIGN KEY (registrada_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT asistencias_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
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
  guardas_activos integer,
  fecha_inicio date,
  fecha_fin date,
  estado boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT contratos_pkey PRIMARY KEY (id),
  CONSTRAINT contratos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT contratos_tipo_servicio_id_fkey FOREIGN KEY (tipo_servicio_id) REFERENCES public.tipo_servicio(id)
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
  CONSTRAINT contratos_personal_pkey PRIMARY KEY (id),
  CONSTRAINT fk_contrato_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_contrato_salario FOREIGN KEY (salario_id) REFERENCES public.salarios(id),
  CONSTRAINT fk_contrato_anterior FOREIGN KEY (contrato_anterior_id) REFERENCES public.contratos_personal(id)
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
  CONSTRAINT empleado_capacitaciones_pkey PRIMARY KEY (id),
  CONSTRAINT empleado_capacitaciones_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT empleado_capacitaciones_capacitacion_id_fkey FOREIGN KEY (capacitacion_id) REFERENCES public.capacitaciones(id)
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
  CONSTRAINT fk_empleados_tipo_curso_vigilancia FOREIGN KEY (tipo_curso_vigilancia_id) REFERENCES public.tipos_curso_vigilancia(id)
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
  CONSTRAINT puestos_trabajo_pkey PRIMARY KEY (id),
  CONSTRAINT puestos_trabajo_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT puestos_trabajo_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios_externos(id),
  CONSTRAINT puestos_trabajo_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id),
  CONSTRAINT puestos_trabajo_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.puestos_trabajo(id)
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
  usuario_id integer NOT NULL,
  modulo_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  concedido boolean DEFAULT true,
  CONSTRAINT roles_modulos_usuarios_externos_pkey PRIMARY KEY (id),
  CONSTRAINT roles_modulos_usuarios_externos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id),
  CONSTRAINT roles_modulos_usuarios_externos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_externos(id)
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
`;
