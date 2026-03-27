import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
    // 1. Encontrar el subpuesto de Didier (ID 391)
    const { data: turns } = await supabase.from('turnos').select('subpuesto_id').eq('empleado_id', 391).limit(1);
    if (!turns || turns.length === 0) {
        console.log('No se encontraron turnos para Didier.');
        return;
    }
    const subId = turns[0].subpuesto_id;
    console.log(`Subpuesto ID: ${subId}`);

    // 2. Ver configuracion
    const { data: sub } = await supabase.from('subpuestos_trabajo').select('configuracion_id').eq('id', subId).single();
    if (!sub || !sub.configuracion_id) {
        console.log('El subpuesto no tiene configuración.');
        return;
    }
    const configId = sub.configuracion_id;
    console.log(`Config ID: ${configId}`);

    // 3. Ver detalles del ciclo
    const { data: detalles, error: dError } = await supabase.from('turnos_detalle_configuracion')
        .select('orden, tipo, hora_inicio, hora_fin')
        .eq('configuracion_id', configId)
        .order('orden', { ascending: true });
    
    if (dError) {
        console.error('Error fetching detalles:', dError.message);
        return;
    }

    console.log('\nDetalles del Ciclo Configurado:');
    detalles.forEach(d => {
        console.log(`${d.orden}: ${d.tipo} (${d.hora_inicio || '—'} - ${d.hora_fin || '—'})`);
    });
}

checkConfig().catch(console.error);
