# Instalador idempotente del servicio local 24/7 ProlisegAudioEdge (Windows)
$ErrorActionPreference = "Stop"

$RelayDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeExe = (Get-Command node).Source
$SupervisorScript = Join-Path $RelayDir "run-forever.js"
$TaskName = "ProlisegAudioEdge"

Write-Host "Configurando reglas de Firewall de Windows (TCP 9443 y TCP 9080)..."
New-NetFirewallRule -DisplayName "Prolicontrol Audio Edge HTTPS/WSS (9443)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 9443 -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName "Prolicontrol Audio Edge ACME HTTP-01 (9080)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 9080 -ErrorAction SilentlyContinue | Out-Null

Write-Host "Registrando Tarea Programada de Arranque Automatico ($TaskName)..."
$Action = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$SupervisorScript`"" -WorkingDirectory $RelayDir
$TriggerBoot = New-ScheduledTaskTrigger -AtStartup
$TriggerLogon = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($TriggerBoot, $TriggerLogon) -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "Servicio $TaskName instalado e iniciado con exito."
