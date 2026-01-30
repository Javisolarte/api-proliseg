-- ===============================================
-- PRODUCTION ENDPOINTS - DATABASE MIGRATIONS
-- ===============================================

-- BLOQUE 1: Feature Flags
CREATE TABLE IF NOT EXISTS feature_flags (
    flag_key VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar feature flags iniciales
INSERT INTO feature_flags (flag_key, enabled, description) VALUES
    ('new_dashboard', false, 'Nuevo dashboard operativo'),
    ('advanced_search', true, 'Búsqueda avanzada habilitada'),
    ('export_module', true, 'Módulo de exportación'),
    ('public_quotes', true, 'Cotizaciones públicas sin login')
ON CONFLICT (flag_key) DO NOTHING;

-- BLOQUE 2: Enhanced Audit (Add missing columns if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='auditoria' AND column_name='ip_address') THEN
        ALTER TABLE auditoria ADD COLUMN ip_address VARCHAR(45);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='auditoria' AND column_name='user_agent') THEN
        ALTER TABLE auditoria ADD COLUMN user_agent TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='auditoria' AND column_name='estado_anterior') THEN
        ALTER TABLE auditoria ADD COLUMN estado_anterior JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='auditoria' AND column_name='estado_nuevo') THEN
        ALTER TABLE auditoria ADD COLUMN estado_nuevo JSONB;
    END IF;
END $$;

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro ON auditoria(tabla_afectada, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria(accion);

-- BLOQUE 3: State Transitions - Cotizaciones
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='cotizaciones' AND column_name='public_token') THEN
        ALTER TABLE cotizaciones ADD COLUMN public_token VARCHAR(64) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='cotizaciones' AND column_name='public_token_expires_at') THEN
        ALTER TABLE cotizaciones ADD COLUMN public_token_expires_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='cotizaciones' AND column_name='fecha_envio') THEN
        ALTER TABLE cotizaciones ADD COLUMN fecha_envio TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='cotizaciones' AND column_name='fecha_aceptacion') THEN
        ALTER TABLE cotizaciones ADD COLUMN fecha_aceptacion TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='cotizaciones' AND column_name='fecha_rechazo') THEN
        ALTER TABLE cotizaciones ADD COLUMN fecha_rechazo TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='cotizaciones' AND column_name='fecha_expiracion') THEN
        ALTER TABLE cotizaciones ADD COLUMN fecha_expiracion TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='cotizaciones' AND column_name='motivo_rechazo') THEN
        ALTER TABLE cotizaciones ADD COLUMN motivo_rechazo TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_public_token ON cotizaciones(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);

-- BLOQUE 3: State Transitions - Documentos Generados
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documentos_generados' AND column_name='fecha_generacion') THEN
        ALTER TABLE documentos_generados ADD COLUMN fecha_generacion TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documentos_generados' AND column_name='fecha_envio_firmas') THEN
        ALTER TABLE documentos_generados ADD COLUMN fecha_envio_firmas TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documentos_generados' AND column_name='fecha_cierre') THEN
        ALTER TABLE documentos_generados ADD COLUMN fecha_cierre TIMESTAMP;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos_generados(estado);

-- BLOQUE 7: Security - User Blocking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='usuarios_externos' AND column_name='bloqueado') THEN
        ALTER TABLE usuarios_externos ADD COLUMN bloqueado BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='usuarios_externos' AND column_name='bloqueado_motivo') THEN
        ALTER TABLE usuarios_externos ADD COLUMN bloqueado_motivo TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='usuarios_externos' AND column_name='bloqueado_hasta') THEN
        ALTER TABLE usuarios_externos ADD COLUMN bloqueado_hasta TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='usuarios_externos' AND column_name='intentos_fallidos') THEN
        ALTER TABLE usuarios_externos ADD COLUMN intentos_fallidos INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='usuarios_externos' AND column_name='ultimo_intento_fallido') THEN
        ALTER TABLE usuarios_externos ADD COLUMN ultimo_intento_fallido TIMESTAMP;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado ON usuarios_externos(bloqueado) WHERE bloqueado = true;

-- BLOQUE 7: Session Management
CREATE TABLE IF NOT EXISTS sesiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id INTEGER REFERENCES usuarios_externos(id) ON DELETE CASCADE,
    token_hash VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expires ON sesiones(expires_at);
CREATE INDEX IF NOT EXISTS idx_sesiones_token_hash ON sesiones(token_hash);

-- BLOQUE 8: Background Jobs
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(50),  -- 'email', 'pdf', 'webhook', 'export'
    estado VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    payload JSONB,
    error TEXT,
    intentos INTEGER DEFAULT 0,
    max_intentos INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_estado ON jobs(estado);
CREATE INDEX IF NOT EXISTS idx_jobs_tipo ON jobs(tipo);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- BLOQUE 10: Client Configuration
CREATE TABLE IF NOT EXISTS clientes_configuracion (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE UNIQUE,
    horarios JSONB,  -- {"entrada": "08:00", "salida": "18:00", "zona_horaria": "America/Bogota"}
    reglas_visitas JSONB,  -- {"requiere_autorizacion": true, "max_acompanantes": 3}
    limites JSONB,  -- {"max_guardias": 50, "max_puestos": 10}
    branding JSONB,  -- {"logo_url": "...", "color_primario": "#..."}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_config_cliente ON clientes_configuracion(cliente_id);

-- Insert default configuration for existing clients
INSERT INTO clientes_configuracion (cliente_id, horarios, reglas_visitas, limites, branding)
SELECT 
    id,
    '{"entrada": "08:00", "salida": "18:00", "zona_horaria": "America/Bogota"}'::jsonb,
    '{"requiere_autorizacion": false, "max_acompanantes": 5}'::jsonb,
    '{"max_guardias": 100, "max_puestos": 50}'::jsonb,
    '{"color_primario": "#1976D2", "color_secundario": "#424242"}'::jsonb
FROM clientes
WHERE id NOT IN (SELECT cliente_id FROM clientes_configuracion WHERE cliente_id IS NOT NULL)
ON CONFLICT (cliente_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE feature_flags IS 'Almacena feature flags para activar/desactivar funcionalidades sin deploy';
COMMENT ON TABLE sesiones IS 'Gestión de sesiones activas con Redis';
COMMENT ON TABLE jobs IS 'Cola de trabajos background para emails, PDFs, webhooks';
COMMENT ON TABLE clientes_configuracion IS 'Configuración específica por cliente (multi-tenancy)';

-- Add trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_feature_flags_updated_at') THEN
        CREATE TRIGGER update_feature_flags_updated_at 
        BEFORE UPDATE ON feature_flags
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_jobs_updated_at') THEN
        CREATE TRIGGER update_jobs_updated_at 
        BEFORE UPDATE ON jobs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_clientes_config_updated_at') THEN
        CREATE TRIGGER update_clientes_config_updated_at 
        BEFORE UPDATE ON clientes_configuracion
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ===============================================
-- GRANTS (adjust based on your role names)
-- ===============================================
-- GRANT SELECT, INSERT, UPDATE ON feature_flags TO your_app_role;
-- GRANT SELECT, INSERT ON auditoria TO your_app_role;
-- GRANT ALL ON sesiones TO your_app_role;
-- GRANT ALL ON jobs TO your_app_role;
-- GRANT ALL ON clientes_configuracion TO your_app_role;
