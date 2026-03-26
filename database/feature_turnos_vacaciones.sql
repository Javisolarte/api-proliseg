-- 1. Tabla de Conceptos de Turno
CREATE TABLE IF NOT EXISTS public.conceptos_turno (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  horas_normales DECIMAL(4,2) DEFAULT 0,
  horas_extras DECIMAL(4,2) DEFAULT 0,
  paga_salario BOOLEAN DEFAULT true,
  paga_aux_transporte BOOLEAN DEFAULT true,
  color VARCHAR(20) DEFAULT '#3788d8',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- 2. Semilla de datos para Conceptos
INSERT INTO public.conceptos_turno (codigo, nombre, descripcion, horas_normales, horas_extras, paga_salario, paga_aux_transporte, color)
VALUES 
('D', 'DIA', 'Turno de Día (7AM a 7PM)', 8, 4, true, true, '#1976d2'),
('N', 'NOCHE', 'Turno de Noche (7PM a 7AM)', 8, 4, true, true, '#7b1fa2'),
('Z', 'DESCANSO', 'Día de Descanso Programado', 0, 0, false, false, '#9e9e9e'),
('IND', 'INDUCCION', 'Día de Inducción (No remunerado)', 0, 0, false, false, '#607d8b'),
('RET', 'RETIRADO', 'Empleado Retirado del Puesto', 0, 0, false, false, '#f44336'),
('LIC', 'LICENCIA', 'Licencia Remunerada (Sin Aux. Transp)', 8, 0, true, false, '#ff9800'),
('PNR', 'PERMISO NO REMUNERADO', 'Permiso Sin Sueldo', 0, 0, false, false, '#ff5722'),
('SAN', 'SANCION', 'Suspensión Disciplinaria (No paga)', 0, 0, false, false, '#d32f2f'),
('INC', 'INCAPACIDAD', 'Incapacidad Médica (Sin Aux. Transp)', 8, 0, true, false, '#e91e63'),
('V', 'VACACIONES', 'Vacaciones Disfrutadas', 8, 0, true, false, '#4caf50'),
('Vp', 'VACACIONES PAGADAS', 'Vacaciones Pagadas Trabajadas', 8, 0, true, true, '#2e7d32'),
('R', 'REEMPLAZO', 'Cubrimiento de Novedad', 8, 4, true, true, '#0288d1'),
('X', 'EXTRA', 'Jornada Extraordinaria', 0, 12, true, true, '#fbc02d')
ON CONFLICT (codigo) DO UPDATE SET 
  nombre = EXCLUDED.nombre,
  horas_normales = EXCLUDED.horas_normales,
  horas_extras = EXCLUDED.horas_extras,
  color = EXCLUDED.color,
  paga_salario = EXCLUDED.paga_salario,
  paga_aux_transporte = EXCLUDED.paga_aux_transporte;

-- 3. Tabla de Vacaciones
CREATE TABLE IF NOT EXISTS public.vacaciones (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER NOT NULL REFERENCES public.empleados(id),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  fecha_retorno DATE NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'disfrutada', 'cancelada', 'pagada')),
  pagadas_sin_disfrutar BOOLEAN DEFAULT false,
  observaciones TEXT,
  creado_por INTEGER REFERENCES public.usuarios_externos(id),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- 4. Actualizar Tabla de Turnos (Link a Conceptos)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turnos' AND column_name='concepto_id') THEN
        ALTER TABLE public.turnos ADD COLUMN concepto_id INTEGER REFERENCES public.conceptos_turno(id);
    END IF;
END $$;
