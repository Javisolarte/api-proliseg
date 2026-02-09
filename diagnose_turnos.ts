
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('🔍 Diagnosing Turnos for February 2026...');

    // 1. Check total turns in Feb
    const { count: totalFeb, error: errorFeb } = await supabase
        .from('turnos')
        .select('*', { count: 'exact', head: true })
        .gte('fecha', '2026-02-01')
        .lte('fecha', '2026-02-28');

    if (errorFeb) console.error('❌ Error checking turnos:', errorFeb);
    else console.log(`📊 Total turnos in Feb 2026: ${totalFeb}`);

    // 2. Check turnos_generacion_log for Feb
    const { data: logs, error: errorLogs } = await supabase
        .from('turnos_generacion_log')
        .select('*')
        .eq('mes', 2)
        .eq('año', 2026);

    if (errorLogs) console.error('❌ Error checking logs:', errorLogs);
    else console.log(`📊 Logs found for Feb 2026: ${logs.length}`);

    // 3. Count subpuestos with turnos in Feb
    const { data: subpuestosWithTurnos, error: errorSubWith } = await supabase
        .rpc('exec_sql', { query: `SELECT count(DISTINCT subpuesto_id) FROM turnos WHERE fecha >= '2026-02-01' AND fecha <= '2026-02-28'` });

    // Note: exec_sql might return data in different format
    console.log('📊 Subpuestos with turnos in Feb:', subpuestosWithTurnos);

    // 4. Count active subpuestos with configuration
    const { count: totalSubpuestos, error: errorSub } = await supabase
        .from('subpuestos_trabajo')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)
        .not('configuracion_id', 'is', null);

    console.log(`📊 Active subpuestos with config: ${totalSubpuestos}`);

    // 5. Check for incomplete assignments
    const { data: incomplete, error: errorInc } = await supabase
        .rpc('exec_sql', {
            query: `
            WITH req AS (
                SELECT s.id, s.nombre, s.guardas_activos, s.configuracion_id,
                       (SELECT count(DISTINCT tipo) FROM turnos_detalle_configuracion WHERE configuracion_id = s.configuracion_id) as estados
                FROM subpuestos_trabajo s
                WHERE s.activo = true AND s.configuracion_id IS NOT NULL
            )
            SELECT r.id, r.nombre, r.guardas_activos * r.estados as nec, count(a.id) as asig
            FROM req r
            LEFT JOIN asignacion_guardas_puesto a ON a.subpuesto_id = r.id AND a.activo = true
            GROUP BY r.id, r.nombre, r.guardas_activos, r.estados
            HAVING count(a.id) < (r.guardas_activos * r.estados)
       `});

    if (incomplete && incomplete.length > 0) {
        console.log('⚠️ Subpuestos with INCOMPLETE assignments:', incomplete.length);
        console.log(incomplete.slice(0, 5));
    } else {
        console.log('✅ All active subpuestos have enough assignments.');
    }
}

diagnose();
