-- ================================================================
-- CONFIGURACIÓN DE POLÍTICAS DE STORAGE PARA SUPABASE
-- ================================================================
-- Este script configura las políticas de acceso público para los buckets
-- de almacenamiento utilizados en la plataforma PROLISEG

-- ================================================================
-- BUCKET: documentos
-- Almacena PDFs generados de consentimientos, contratos, referencias, etc.
-- ================================================================

-- 1. Asegurar que el bucket existe (si no existe, créalo manualmente en Supabase UI)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('documentos', 'documentos', true)
-- ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "documentos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "documentos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "documentos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_authenticated_delete" ON storage.objects;

-- 3. POLÍTICA DE LECTURA PÚBLICA
-- Permite que cualquier persona (autenticada o no) pueda leer archivos del bucket 'documentos'
CREATE POLICY "documentos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'documentos');

-- 4. POLÍTICA DE UPLOAD (solo usuarios autenticados)
CREATE POLICY "documentos_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos');

-- 5. POLÍTICA DE ACTUALIZACIÓN (solo usuarios autenticados)
CREATE POLICY "documentos_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documentos');

-- 6. POLÍTICA DE ELIMINACIÓN (solo usuarios autenticados)
CREATE POLICY "documentos_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documentos');

-- ================================================================
-- OTROS BUCKETS OPCIONALES
-- ================================================================

-- Si necesitas configurar otros buckets, repite el patrón anterior
-- Por ejemplo: 'memorandos', 'pqrsf_adjuntos', 'estudios-seguridad', etc.

-- Ejemplo para bucket 'memorandos':
DROP POLICY IF EXISTS "memorandos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "memorandos_authenticated_upload" ON storage.objects;

CREATE POLICY "memorandos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'memorandos');

CREATE POLICY "memorandos_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'memorandos');

-- ================================================================
-- VERIFICACIÓN
-- ================================================================
-- Para verificar que las políticas se aplicaron correctamente:
-- SELECT * FROM storage.buckets WHERE id = 'documentos';
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'documentos%';
