
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('🔍 Diagnosing Turnos for February 2026...');

    try {
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

        // 3. Count active subpuestos with configuration
        const { count: totalSubpuestos, error: errorSub } = await supabase
            .from('subpuestos_trabajo')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true)
            .not('configuracion_id', 'is', null);

        console.log(`📊 Active subpuestos with config: ${totalSubpuestos}`);

        // 4. Detailed check for subpuestos missing turnos in Feb
        const { data: subpuestos, error: subError } = await supabase
            .from('subpuestos_trabajo')
            .select('id, nombre, guardas_activos, configuracion_id')
            .eq('activo', true)
            .not('configuracion_id', 'is', null);

        if (subError) throw subError;

        let missingCount = 0;
        let incompleteAsigCount = 0;

        for (const sub of subpuestos) {
            const { count: febTurnos } = await supabase
                .from('turnos')
                .select('*', { count: 'exact', head: true })
                .eq('subpuesto_id', sub.id)
                .gte('fecha', '2026-02-01')
                .lte('fecha', '2026-02-28');

            if (febTurnos === 0) {
                missingCount++;
                // Check if it has enough assignments
                const { data: details } = await supabase.from('turnos_detalle_configuracion').select('tipo').eq('configuracion_id', sub.configuracion_id);
                const uniqueStates = new Set(details.map(d => d.tipo)).size;
                const req = sub.guardas_activos * uniqueStates;

                const { count: asig } = await supabase.from('asignacion_guardas_puesto').select('*', { count: 'exact', head: true }).eq('subpuesto_id', sub.id).eq('activo', true);

                if (asig < req) {
                    incompleteAsigCount++;
                    console.log(`❌ [MISSING] ${sub.nombre} (ID: ${sub.id}): Faltan empleados (${asig}/${req}). Por eso no se genera.`);
                } else {
                    console.log(`⚠️ [MISSING] ${sub.nombre} (ID: ${sub.id}): Tiene empleados (${asig}/${req}) pero NO tiene turnos.`);
                }
            }
        }

        console.log(`\n🏁 Summary:`);
        console.log(`- Subpuestos sin turnos en Feb: ${missingCount}`);
        console.log(`- De esos, con asignación incompleta: ${incompleteAsigCount}`);

    } catch (e) {
        console.error('💥 Crash:', e);
    }
}

diagnose();
