BEGIN;

-----------------------------------------------------------------------------
-- 0. CONFIGURACIÓN INICIAL Y NUEVOS ROLES
-----------------------------------------------------------------------------

-- Agregamos el rol de residente si no existe
INSERT INTO public.roles (nombre, descripcion, nivel_jerarquia) 
VALUES ('residente', 'Usuario final residente en conjunto o edificio', 0)
ON CONFLICT (nombre) DO NOTHING;

-----------------------------------------------------------------------------
-- 1. MÓDULO CORE: PLANTILLAS INTELIGENTES Y FIRMAS
-----------------------------------------------------------------------------

-- Definición de las plantillas (HTML con variables)
CREATE TABLE IF NOT EXISTS public.plantillas_documentos (
  id serial PRIMARY KEY,
  nombre varchar NOT NULL,
  tipo varchar NOT NULL CHECK (tipo IN ('contrato_cliente', 'contrato_empleado', 'consentimiento', 'certificado', 'referencia', 'cotizacion', 'otro')),
  contenido_html text NOT NULL, -- Guardarás el HTML aquí usando {{variable}}
  variables_requeridas jsonb DEFAULT '[]'::jsonb, -- Array de nombres de variables esperadas
  version int DEFAULT 1,
  activa boolean DEFAULT true,
  creado_por int REFERENCES public.usuarios_externos(id),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- Instancias de documentos generados (PDFs finales)
CREATE TABLE IF NOT EXISTS public.documentos_generados (
  id serial PRIMARY KEY,
  plantilla_id int REFERENCES public.plantillas_documentos(id),
  codigo_referencia uuid DEFAULT gen_random_uuid() UNIQUE, -- Para validar autenticidad por QR
  entidad_tipo varchar NOT NULL, -- 'empleado', 'cliente', 'proveedor', 'residente'
  entidad_id int NOT NULL, -- ID de la tabla correspondiente
  datos_json jsonb NOT NULL, -- Los datos exactos con los que se rellenó
  url_pdf text, -- URL en Storage
  estado varchar DEFAULT 'borrador' CHECK (estado IN ('borrador', 'pendiente_firmas', 'firmado', 'anulado')),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- Gestión de Firmas Digitales y Biométricas
CREATE TABLE IF NOT EXISTS public.firmas_documentos (
  id serial PRIMARY KEY,
  documento_id int REFERENCES public.documentos_generados(id) ON DELETE CASCADE,
  usuario_id int REFERENCES public.usuarios_externos(id), -- Si es usuario del sistema
  nombre_firmante varchar, -- Si es externo (ej. referencia laboral)
  documento_identidad_firmante varchar,
  cargo_firmante varchar,
  tipo_firma varchar DEFAULT 'digital' CHECK (tipo_firma IN ('digital', 'manuscrita_capturada', 'biometrica')),
  firma_base64 text, -- Imagen de la firma
  ip_address inet,
  fecha_firma timestamp without time zone DEFAULT now(),
  token_validacion uuid DEFAULT gen_random_uuid(), -- Token único de esta firma específica
  orden int DEFAULT 1 -- Orden en que deben firmar
);

-----------------------------------------------------------------------------
-- 2. MÓDULO DE COTIZACIONES (GESTIÓN COMERCIAL)
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id serial PRIMARY KEY,
  cliente_id int REFERENCES public.clientes(id), -- Null si es prospecto nuevo
  prospecto_datos jsonb, -- { "empresa": "ABC", "nit": "...", "contacto": "..." }
  fecha_emision date DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  subtotal numeric NOT NULL DEFAULT 0,
  impuestos numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  estado varchar DEFAULT 'borrador' CHECK (estado IN ('borrador', 'en_proceso', 'aprobada', 'rechazada', 'vencida')),
  observaciones text,
  creado_por int REFERENCES public.usuarios_externos(id),
  aprobado_por int REFERENCES public.usuarios_externos(id), -- Usuario interno que valida
  contrato_generado_id int REFERENCES public.contratos(id), -- Link si se aprueba
  documento_generado_id int REFERENCES public.documentos_generados(id), -- PDF de la cotización
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cotizaciones_items (
  id serial PRIMARY KEY,
  cotizacion_id int REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  tipo_servicio_id int REFERENCES public.tipo_servicio(id),
  descripcion varchar NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  total_linea numeric NOT NULL DEFAULT 0
);

-----------------------------------------------------------------------------
-- 3. ACTUALIZACIÓN DE CONTRATOS Y CONSENTIMIENTOS
-----------------------------------------------------------------------------

-- Actualizar Contratos Personales para soportar el nuevo motor de documentos
ALTER TABLE public.contratos_personal 
ADD COLUMN IF NOT EXISTS documento_generado_id int REFERENCES public.documentos_generados(id);

-- Actualizar Contratos Clientes
ALTER TABLE public.contratos 
ADD COLUMN IF NOT EXISTS cotizacion_origen_id int REFERENCES public.cotizaciones(id),
ADD COLUMN IF NOT EXISTS documento_generado_id int REFERENCES public.documentos_generados(id),
ADD COLUMN IF NOT EXISTS estado_firma varchar DEFAULT 'pendiente';

-- Tabla para Consentimientos Informados (Polígrafo, visita dom, datos)
CREATE TABLE IF NOT EXISTS public.consentimientos_informados (
  id serial PRIMARY KEY,
  empleado_id int REFERENCES public.empleados(id),
  documento_generado_id int REFERENCES public.documentos_generados(id),
  tipo_consentimiento varchar NOT NULL, -- 'tratamiento_datos', 'poligrafo', 'visita_domiciliaria'
  fecha_aceptacion timestamp without time zone DEFAULT now(),
  vigente boolean DEFAULT true,
  observaciones text
);

-----------------------------------------------------------------------------
-- 4. CAPACITACIONES, CERTIFICADOS Y REFERENCIAS
-----------------------------------------------------------------------------

-- Vincular certificados PDF a capacitaciones
ALTER TABLE public.empleado_capacitaciones
ADD COLUMN IF NOT EXISTS documento_generado_id int REFERENCES public.documentos_generados(id);

-- Verificación de Referencias
CREATE TABLE IF NOT EXISTS public.verificacion_referencias (
  id serial PRIMARY KEY,
  aspirante_id int REFERENCES public.aspirantes(id),
  empleado_id int REFERENCES public.empleados(id),
  responsable_verificacion int REFERENCES public.usuarios_externos(id),
  estado varchar DEFAULT 'en_proceso' CHECK (estado IN ('en_proceso', 'finalizado', 'con_hallazgos')),
  documento_final_id int REFERENCES public.documentos_generados(id), -- PDF resumen firmado
  conclusiones text,
  created_at timestamp without time zone DEFAULT now()
);

-- Detalles de cada llamada o contacto de referencia
CREATE TABLE IF NOT EXISTS public.referencias_detalles (
  id serial PRIMARY KEY,
  verificacion_id int REFERENCES public.verificacion_referencias(id) ON DELETE CASCADE,
  tipo_referencia varchar NOT NULL, -- 'laboral', 'personal', 'academica'
  nombre_contacto varchar,
  empresa_institucion varchar,
  telefono varchar,
  resultado_verificacion text, -- Qué dijeron
  es_valida boolean DEFAULT false,
  observaciones text,
  created_at timestamp without time zone DEFAULT now()
);

-----------------------------------------------------------------------------
-- 5. MÓDULO DE RESIDENTES Y VEHÍCULOS (Conjuntos Residenciales)
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.residentes (
  id serial PRIMARY KEY,
  cliente_id int REFERENCES public.clientes(id), -- A qué cliente (Conjunto/Edificio) pertenece
  puesto_id int REFERENCES public.puestos_trabajo(id), -- Link físico al puesto
  usuario_id int REFERENCES public.usuarios_externos(id), -- Login App (Rol residente)
  nombre_completo varchar NOT NULL,
  documento varchar NOT NULL,
  torre_bloque varchar,
  apto_casa varchar, -- Unidad
  telefono varchar,
  correo varchar,
  tipo_habitante varchar DEFAULT 'propietario' CHECK (tipo_habitante IN ('propietario', 'arrendatario', 'familiar', 'apoderado')),
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  UNIQUE(puesto_id, torre_bloque, apto_casa, documento) -- Evitar duplicados por unidad
);

CREATE TABLE IF NOT EXISTS public.residentes_vehiculos (
  id serial PRIMARY KEY,
  residente_id int REFERENCES public.residentes(id) ON DELETE CASCADE,
  placa varchar NOT NULL,
  tipo_vehiculo varchar DEFAULT 'carro' CHECK (tipo_vehiculo IN ('carro', 'moto', 'bicicleta', 'otro')),
  marca varchar,
  color varchar,
  parqueadero_asignado varchar,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now()
);

-----------------------------------------------------------------------------
-- 6. MÓDULO DE VISITAS Y CONTROL DE ACCESO
-----------------------------------------------------------------------------

-- Base de datos de personas externas (Visitantes recurrentes o nuevos)
CREATE TABLE IF NOT EXISTS public.visitantes (
  id serial PRIMARY KEY,
  documento varchar NOT NULL UNIQUE,
  nombre_completo varchar NOT NULL,
  empresa_arl varchar, -- Para contratistas/domiciliarios
  foto_url text, -- Foto rostro
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- Listas de Control (Blanca/Negra)
CREATE TABLE IF NOT EXISTS public.listas_acceso (
  id serial PRIMARY KEY,
  puesto_id int REFERENCES public.puestos_trabajo(id),
  documento varchar,
  placa varchar,
  tipo_lista varchar CHECK (tipo_lista IN ('blanca', 'negra')),
  motivo text,
  fecha_vencimiento date,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now()
);

-- Registro transaccional de visitas
CREATE TABLE IF NOT EXISTS public.visitas_registro (
  id serial PRIMARY KEY,
  puesto_id int REFERENCES public.puestos_trabajo(id),
  visitante_id int REFERENCES public.visitantes(id),
  residente_destino_id int REFERENCES public.residentes(id), -- A quién visita
  vehiculo_placa varchar, -- Si entra en vehículo
  parqueadero_asignado varchar,
  fecha_entrada timestamp without time zone DEFAULT now(),
  fecha_salida timestamp without time zone,
  autorizado_por varchar, -- Nombre de quien autorizó (ej. Residente Torre 1 Apto 202)
  guardia_entrada_id int REFERENCES public.usuarios_externos(id),
  guardia_salida_id int REFERENCES public.usuarios_externos(id),
  observaciones text,
  tipo_ingreso varchar DEFAULT 'visitante' CHECK (tipo_ingreso IN ('visitante', 'domiciliario', 'contratista', 'prestador_servicio')),
  estado varchar DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado')),
  evidencia_entrada_url text,
  created_at timestamp without time zone DEFAULT now()
);

-----------------------------------------------------------------------------
-- 7. RONDAS INTELIGENTES Y MANTENIMIENTO AL PUESTO
-----------------------------------------------------------------------------

-- Estructura mejorada para rondas (Definición -> Puntos -> Ejecución)
CREATE TABLE IF NOT EXISTS public.rondas_definicion (
  id serial PRIMARY KEY,
  nombre varchar NOT NULL,
  puesto_id int REFERENCES public.puestos_trabajo(id),
  descripcion text,
  activa boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rondas_puntos (
  id serial PRIMARY KEY,
  ronda_definicion_id int REFERENCES public.rondas_definicion(id) ON DELETE CASCADE,
  nombre_punto varchar NOT NULL,
  orden int NOT NULL,
  codigo_nfc_qr varchar, -- El código físico pegado en la pared
  latitud_esperada numeric,
  longitud_esperada numeric,
  instrucciones text
);

CREATE TABLE IF NOT EXISTS public.rondas_ejecucion (
  id serial PRIMARY KEY,
  ronda_definicion_id int REFERENCES public.rondas_definicion(id),
  rondero_id int REFERENCES public.empleados(id),
  fecha_inicio timestamp without time zone DEFAULT now(),
  fecha_fin timestamp without time zone,
  estado varchar DEFAULT 'en_proceso' CHECK (estado IN ('en_proceso', 'completada', 'incompleta', 'cancelada')),
  observaciones text
);

CREATE TABLE IF NOT EXISTS public.rondas_registros (
  id serial PRIMARY KEY,
  ronda_ejecucion_id int REFERENCES public.rondas_ejecucion(id) ON DELETE CASCADE,
  punto_id int REFERENCES public.rondas_puntos(id),
  fecha_registro timestamp without time zone DEFAULT now(),
  latitud_real numeric,
  longitud_real numeric,
  foto_url text,
  comentario text,
  es_valido boolean DEFAULT true
);

-- Visitas Técnicas / Mantenimiento / Supervisión al Puesto
CREATE TABLE IF NOT EXISTS public.visitas_tecnicas_puesto (
  id serial PRIMARY KEY,
  puesto_id int REFERENCES public.puestos_trabajo(id),
  tipo_visitante varchar CHECK (tipo_visitante IN ('coordinador', 'supervisor', 'ingeniero', 'tecnico', 'mensajero')),
  nombre_visitante varchar NOT NULL,
  empresa varchar,
  fecha_llegada timestamp without time zone DEFAULT now(),
  fecha_salida timestamp without time zone,
  motivo_visita text,
  resultado_observaciones text,
  foto_evidencia_url text,
  registrado_por int REFERENCES public.usuarios_externos(id), -- Guardia que registra
  created_at timestamp without time zone DEFAULT now()
);

-----------------------------------------------------------------------------
-- 8. ACTUALIZACIÓN ASISTENCIAS
-----------------------------------------------------------------------------

-- Mejoramos la tabla de asistencias existente
ALTER TABLE public.asistencias
ADD COLUMN IF NOT EXISTS evidencia_foto_url text,
ADD COLUMN IF NOT EXISTS verificado_jefe boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS validacion_facial_score numeric; -- Score si usas IA para validar cara

-----------------------------------------------------------------------------
-- 9. MÓDULO DE INVENTARIO POR PUESTO (Dotación fija)
-----------------------------------------------------------------------------

-- Inventario que pertenece al puesto, no a la persona
CREATE TABLE IF NOT EXISTS public.inventario_puesto (
  id serial PRIMARY KEY,
  puesto_id int REFERENCES public.puestos_trabajo(id),
  variante_articulo_id int REFERENCES public.articulos_dotacion_variantes(id),
  cantidad_actual int DEFAULT 0,
  cantidad_minima int DEFAULT 1,
  condicion varchar DEFAULT 'bueno' CHECK (condicion IN ('nuevo', 'bueno', 'regular', 'malo', 'baja')),
  ubicacion_detalle varchar, -- Ej: "Casillero 1", "Recepción"
  updated_at timestamp without time zone DEFAULT now(),
  UNIQUE(puesto_id, variante_articulo_id, condicion)
);

-- Historial de movimientos del inventario de puesto
CREATE TABLE IF NOT EXISTS public.inventario_puesto_movimientos (
  id serial PRIMARY KEY,
  puesto_id int REFERENCES public.puestos_trabajo(id),
  variante_articulo_id int REFERENCES public.articulos_dotacion_variantes(id),
  tipo_movimiento varchar CHECK (tipo_movimiento IN ('entrega_a_puesto', 'retiro_de_puesto', 'consumo', 'baja', 'traslado')),
  cantidad int NOT NULL,
  condicion_entrada varchar, -- 'nuevo' o 'segunda'
  responsable_id int REFERENCES public.usuarios_externos(id),
  fecha timestamp without time zone DEFAULT now(),
  observacion text
);

COMMIT;