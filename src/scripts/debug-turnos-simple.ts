import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const subpuestoId = 17;
    console.log(`--- DEBUG TURNOS SUBPUESTO ${subpuestoId} ---`);

    // 1. Asignaciones
    const { data: asigs } = await supabase
        .from('asignacion_guardas_puesto')
        .select(`
            id,
            empleado_id,
            fase_inicial,
            fecha_inicio_patron,
            empleado:empleado_id(nombre_completo)
        `)
        .eq('subpuesto_id', subpuestoId)
        .eq('activo', true);

    if (!asigs) {
        console.log("No se encontraron asignaciones");
        return;
    }

    console.log(`Encontradas ${asigs.length} asignaciones activas.\n`);

    for (const a of asigs) {
        const empName = (a.empleado as any)?.nombre_completo;
        console.log(`PERSONA: ${empName} (ID: ${a.empleado_id})`);
        console.log(`Metadata: Fase=${a.fase_inicial}, Ancla=${a.fecha_inicio_patron}`);

        // Turnos Marzo
        const { data: tMarzo } = await supabase
            .from('turnos')
            .select('fecha, tipo_turno')
            .eq('empleado_id', a.empleado_id)
            .eq('subpuesto_id', subpuestoId)
            .gte('fecha', '2026-03-25')
            .lte('fecha', '2026-03-31')
            .order('fecha', { ascending: true });

        if (tMarzo && tMarzo.length > 0) {
            console.log("Turnos Marzo (25-31):");
            tMarzo.forEach(t => console.log(`  ${t.fecha}: ${t.tipo_turno}`));
        } else {
            console.log("!!! NO TIENE TURNOS EN MARZO !!!");
        }

        // Turnos Abril
        const { data: tAbril } = await supabase
            .from('turnos')
            .select('fecha, tipo_turno')
            .eq('empleado_id', a.empleado_id)
            .eq('subpuesto_id', subpuestoId)
            .gte('fecha', '2026-04-01')
            .lte('fecha', '2026-04-05')
            .order('fecha', { ascending: true });

        if (tAbril && tAbril.length > 0) {
            console.log("Turnos Abril (1-5):");
            tAbril.forEach(t => console.log(`  ${t.fecha}: ${t.tipo_turno}`));
        } else {
            console.log("No se han generado turnos en Abril aún.");
        }
        console.log("-----------------------------------\n");
    }
}

main().catch(console.error);
