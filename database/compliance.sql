-- ==========================================
-- COMPLIANCE & LEGAL LAYER - FIXED
-- Manual execution in Supabase SQL Editor
-- ==========================================

-- 1. Tabla de Logs Legales Inmutables
CREATE TABLE IF NOT EXISTS audit_legal_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id INTEGER REFERENCES usuarios_externos(id),
    entidad VARCHAR(100) NOT NULL,
    entidad_id VARCHAR(100) NOT NULL,
    accion VARCHAR(50) NOT NULL, -- VIEW, DOWNLOAD, MODIFY, DELETE
    detalles JSONB,
    ip VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    hash_integridad TEXT NOT NULL -- Hash SHA-256 generado por el backend
);

-- 2. Columnas para Soft Delete Legal en tablas críticas
-- Puestos de Trabajo
ALTER TABLE puestos_trabajo ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE puestos_trabajo ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES usuarios_externos(id);
ALTER TABLE puestos_trabajo ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Empleados
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES usuarios_externos(id);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 3. Índices para búsqueda legal rápida
CREATE INDEX IF NOT EXISTS idx_audit_legal_entidad ON audit_legal_log(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_audit_legal_usuario ON audit_legal_log(usuario_id);

-- 4. Trigger para evitar modificación de logs (Inmutabilidad simulada)
CREATE OR REPLACE FUNCTION protect_legal_logs()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs legales son inmutables y no pueden ser modificados o eliminados.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_protect_legal_logs
BEFORE UPDATE OR DELETE ON audit_legal_log
FOR EACH ROW EXECUTE FUNCTION protect_legal_logs();
