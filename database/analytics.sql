-- ==========================================
-- ANALYTICS LAYER (BI / OLAP) - FINAL FIXED V3
-- Manual execution in Supabase SQL Editor
-- ==========================================

-- 1. Dimensiones (Vistas para visualización rápida)
CREATE OR REPLACE VIEW dim_tiempo AS
SELECT 
    fecha::date as fecha,
    extract(year from fecha) as anio,
    extract(month from fecha) as mes,
    extract(week from fecha) as semana,
    to_char(fecha, 'Day') as nombre_dia
FROM generate_series('2025-01-01'::date, '2026-12-31'::date, '1 day'::interval) as gs(fecha);

-- 2. KPIs de Cumplimiento de Turnos
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_kpi_cumplimiento_turnos AS
SELECT 
    p.id as puesto_id,
    p.nombre as puesto_nombre,
    c.id as cliente_id,
    c.nombre_empresa as cliente_nombre,
    date_trunc('day', t.fecha) as dia,
    COUNT(t.id) as turnos_planificados,
    COUNT(a.id) as asistencias_registradas,
    CASE 
        WHEN COUNT(t.id) > 0 THEN (COUNT(a.id)::float / COUNT(t.id)::float) * 100
        ELSE 0
    END as porcentaje_cumplimiento
FROM puestos_trabajo p
JOIN contratos ct ON p.contrato_id = ct.id
JOIN clientes c ON ct.cliente_id = c.id
JOIN turnos t ON t.puesto_id = p.id
LEFT JOIN turnos_asistencia a ON a.turno_id = t.id
GROUP BY p.id, p.nombre, c.id, c.nombre_empresa, date_trunc('day', t.fecha);

-- 3. KPIs de Productividad y Horas
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_horas_trabajadas AS
SELECT 
    e.id as empleado_id,
    e.nombre_completo,
    date_trunc('month', a.hora_entrada) as mes,
    SUM(COALESCE(a.tiempo_total_horas, 0)) as total_horas_reales,
    COUNT(a.id) as total_asistencias
FROM empleados e
JOIN turnos_asistencia a ON a.empleado_id = e.id
WHERE a.hora_salida IS NOT NULL
GROUP BY e.id, e.nombre_completo, date_trunc('month', a.hora_entrada);

-- 4. KPIs de Incidentes
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_incidentes AS
SELECT 
    p.id as puesto_id,
    p.nombre as puesto_nombre,
    i.tipo_incidente as categoria,
    COUNT(i.id) as total_incidentes,
    date_trunc('month', i.fecha_incidente) as mes
FROM incidentes i
JOIN puestos_trabajo p ON i.puesto_id = p.id
GROUP BY p.id, p.nombre, i.tipo_incidente, date_trunc('month', i.fecha_incidente);

-- 5. Permisos
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;

-- 6. Función para refrescar métricas
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void SECURITY DEFINER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_kpi_cumplimiento_turnos;
    REFRESH MATERIALIZED VIEW mv_fact_horas_trabajadas;
    REFRESH MATERIALIZED VIEW mv_stats_incidentes;
END;
$$ LANGUAGE plpgsql;
