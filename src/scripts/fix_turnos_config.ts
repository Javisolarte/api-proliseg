
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('🔄 Iniciando corrección de configuraciones de turnos...');

    // --- CONFIGURACIÓN 3: 2D-2N-2Z (6 Días) ---
    console.log('🛠️ Corrigiendo Configuración 3 (2D-2N-2Z)...');

    // 1. Eliminar detalles existentes
    const { error: deleteError3 } = await supabase
        .from('turnos_detalle_configuracion')
        .delete()
        .eq('configuracion_id', 3);

    if (deleteError3) {
        console.error('❌ Error eliminando detalles config 3:', deleteError3);
        return;
    }

    // 2. Insertar nuevos detalles (2 Días, 2 Noches, 2 Descansos)
    const detallesConfig3 = [
        { configuracion_id: 3, orden: 1, tipo: 'DIA', hora_inicio: '08:00:00', hora_fin: '20:00:00', plazas: 1 },
        { configuracion_id: 3, orden: 2, tipo: 'DIA', hora_inicio: '08:00:00', hora_fin: '20:00:00', plazas: 1 },
        { configuracion_id: 3, orden: 3, tipo: 'NOCHE', hora_inicio: '20:00:00', hora_fin: '08:00:00', plazas: 1 },
        { configuracion_id: 3, orden: 4, tipo: 'NOCHE', hora_inicio: '20:00:00', hora_fin: '08:00:00', plazas: 1 },
        { configuracion_id: 3, orden: 5, tipo: 'DESCANSO', hora_inicio: '00:00:00', hora_fin: '00:00:00', plazas: 1 },
        { configuracion_id: 3, orden: 6, tipo: 'DESCANSO', hora_inicio: '00:00:00', hora_fin: '00:00:00', plazas: 1 },
    ];

    const { error: insertError3 } = await supabase
        .from('turnos_detalle_configuracion')
        .insert(detallesConfig3);

    if (insertError3) {
        console.error('❌ Error insertando detalles config 3:', insertError3);
    } else {
        console.log('✅ Configuración 3 actualizada correctamente.');
    }


    // --- CONFIGURACIÓN 4: 4x2 (6 Días) ---
    console.log('🛠️ Corrigiendo Configuración 4 (4x2)...');

    // 1. Eliminar detalles existentes
    const { error: deleteError4 } = await supabase
        .from('turnos_detalle_configuracion')
        .delete()
        .eq('configuracion_id', 4);

    if (deleteError4) {
        console.error('❌ Error eliminando detalles config 4:', deleteError4);
        return;
    }

    // 2. Insertar nuevos detalles (4 Trabajo, 2 Descanso)
    const detallesConfig4 = [
        { configuracion_id: 4, orden: 1, tipo: 'TRABAJO', hora_inicio: '08:00:00', hora_fin: '17:00:00', plazas: 1 },
        { configuracion_id: 4, orden: 2, tipo: 'TRABAJO', hora_inicio: '08:00:00', hora_fin: '17:00:00', plazas: 1 },
        { configuracion_id: 4, orden: 3, tipo: 'TRABAJO', hora_inicio: '08:00:00', hora_fin: '17:00:00', plazas: 1 },
        { configuracion_id: 4, orden: 4, tipo: 'TRABAJO', hora_inicio: '08:00:00', hora_fin: '17:00:00', plazas: 1 },
        { configuracion_id: 4, orden: 5, tipo: 'DESCANSO', hora_inicio: '00:00:00', hora_fin: '00:00:00', plazas: 1 },
        { configuracion_id: 4, orden: 6, tipo: 'DESCANSO', hora_inicio: '00:00:00', hora_fin: '00:00:00', plazas: 1 },
    ];

    const { error: insertError4 } = await supabase
        .from('turnos_detalle_configuracion')
        .insert(detallesConfig4);

    if (insertError4) {
        console.error('❌ Error insertando detalles config 4:', insertError4);
    } else {
        console.log('✅ Configuración 4 actualizada correctamente.');
    }

    console.log('🏁 Proceso finalizado.');
}

main().catch(console.error);
