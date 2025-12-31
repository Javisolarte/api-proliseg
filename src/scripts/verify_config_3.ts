
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('🔍 Verificando configuración ID 3 (2D-2N-2Z)...');

    const { data, error } = await supabase
        .from('turnos_detalle_configuracion')
        .select('*')
        .eq('configuracion_id', 3)
        .order('orden', { ascending: true });

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    console.log(`✅ Se encontraron ${data?.length} detalles:`);
    console.table(data);
}

main();
