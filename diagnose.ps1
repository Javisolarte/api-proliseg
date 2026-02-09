
$URL = "https://ttkubmwrwgqxjdafpgji.supabase.co/rest/v1"
$KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0a3VibXdyd2dxeGpkYWZwZ2ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1MzA5MCwiZXhwIjoyMDcxMjI5MDkwfQ.Jx3NsajEFdkxZh9jsHam9Mb8lDUFRWnszauW80p8vNM"
$Headers = @{
    "apikey" = $KEY
    "Authorization" = "Bearer $KEY"
}

Write-Host "🔍 Diagnóstico de Turnos - Febrero 2026" -ForegroundColor Cyan

# 1. Conteo total
$total = Invoke-RestMethod -Uri "$URL/turnos?fecha=gte.2026-02-01&fecha=lte.2026-02-28&select=count" -Headers $Headers -Method Get
Write-Host "📊 Total turnos en Feb 2026: $($total[0].count)"

# 2. Logs de generación
$logs = Invoke-RestMethod -Uri "$URL/turnos_generacion_log?mes=eq.2/&año=eq.2026" -Headers $Headers -Method Get
Write-Host "📊 Logs encontrados para Feb 2026: $($logs.Count)"

# 3. Subpuestos activos con config
$subs = Invoke-RestMethod -Uri "$URL/subpuestos_trabajo?activo=eq.true&configuracion_id=not.is.null&select=id,nombre,guardas_activos,configuracion_id" -Headers $Headers -Method Get
Write-Host "📊 Subpuestos activos con configuración: $($subs.Count)"

Write-Host "`n🔍 Verificando subpuestos sin turnos..."

foreach ($sub in $subs) {
    $id = $sub.id
    $nombre = $sub.nombre
    
    $tFebrero = Invoke-RestMethod -Uri "$URL/turnos?subpuesto_id=eq.$id&fecha=gte.2026-02-01&fecha=lte.2026-02-28&select=count" -Headers $Headers -Method Get
    
    if ($tFebrero[0].count -eq 0) {
        # Verificar asignación
        $configId = $sub.configuracion_id
        $detalles = Invoke-RestMethod -Uri "$URL/turnos_detalle_configuracion?configuracion_id=eq.$configId" -Headers $Headers -Method Get
        $uniqueStates = ($detalles.tipo | Select-Object -Unique).Count
        if ($uniqueStates -eq 0) { $uniqueStates = 3 }
        
        $req = $sub.guardas_activos * $uniqueStates
        
        $asigs = Invoke-RestMethod -Uri "$URL/asignacion_guardas_puesto?subpuesto_id=eq.$id&activo=eq.true&select=count" -Headers $Headers -Method Get
        $asigCount = $asigs[0].count
        
        if ($asigCount -lt $req) {
            Write-Host "❌ [SIN TURNOS] $nombre (ID: $id): Faltan empleados ($asigCount/$req). BLOQUEADO." -ForegroundColor Red
        } else {
            Write-Host "⚠️ [SIN TURNOS] $nombre (ID: $id): Tiene empleados ($asigCount/$req) pero NO tiene turnos generados." -ForegroundColor Yellow
        }
    }
}
