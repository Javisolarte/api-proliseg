import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillConceptos() {
    console.log('Iniciando script de asignación de conceptos a turnos existentes...');

    try {
        // 1. Obtener todos los conceptos
        const { data: conceptos, error: conError } = await supabase
            .from('conceptos_turno')
            .select('id, codigo');

        if (conError) throw conError;
        
        console.log(`Se encontraron ${conceptos.length} conceptos:`, conceptos.map(c => c.codigo).join(', '));

        const mapConceptos = new Map<string, number>();
        conceptos.forEach(c => mapConceptos.set(c.codigo, c.id));

        // 2. Obtener todos los turnos que no tienen concepto
        console.log('Buscando turnos sin concepto asignado...');
        
        // Paginación para no saturar memoria si hay muchos turnos
        let hasMore = true;
        let offset = 0;
        const limit = 1000;
        let totalUpdated = 0;

        while (hasMore) {
            const { data: turnos, error: turnosError } = await supabase
                .from('turnos')
                .select('id, tipo_turno, estado_turno, observaciones')
                .is('concepto_id', null)
                .order('id')
                .range(offset, offset + limit - 1);

            if (turnosError) throw turnosError;

            if (!turnos || turnos.length === 0) {
                hasMore = false;
                break;
            }

            console.log(`Procesando lote de ${turnos.length} turnos (Offset: ${offset})...`);

            // Procesar secuencialmente o en pequeños chunks de promesas factory
            const processChunk = async (chunk: any[]) => {
                await Promise.all(chunk.map(async (turno) => {
                    const tipoTurno = turno.tipo_turno?.toLowerCase() || '';
                    const estado = turno.estado_turno?.toLowerCase() || '';
                
                let code = '';
                
                // Lógica de mapeo igual a la que usamos en el frontend
                if (estado === 'retirado' || estado === 'retired' || tipoTurno === 'ret') {
                    code = 'RET';
                } else if (tipoTurno === 'd' || tipoTurno === 'dia' || tipoTurno.includes('día') || tipoTurno.includes('dia')) {
                    code = 'D';
                } else if (tipoTurno === 'n' || tipoTurno === 'noche' || tipoTurno.includes('noche')) {
                    code = 'N';
                } else if (tipoTurno === 'z' || tipoTurno === 'descanso' || tipoTurno.includes('descanso')) {
                    code = 'Z';
                } else if (tipoTurno.includes('extra') || tipoTurno === 'x') {
                    code = 'X';
                } else if (tipoTurno === 'ind' || tipoTurno === 'induccion' || tipoTurno.includes('inducción')) {
                    code = 'IND';
                } else if (['pnr', 'lic', 'inc', 'san', 'v'].includes(tipoTurno)) {
                    code = tipoTurno.toUpperCase();
                } else {
                    // Por defecto si no encaja, asumimos que era la inicial
                    code = tipoTurno.charAt(0).toUpperCase();
                }

                const conceptoId = mapConceptos.get(code);

                if (conceptoId) {
                    const { error: updError } = await supabase
                        .from('turnos')
                        .update({ 
                            concepto_id: conceptoId,
                            tipo_turno: code // Estandarizamos el texto al código oficial de una vez
                        })
                        .eq('id', turno.id);

                    if (updError) {
                        console.error(`Error actualizando turno ${turno.id}:`, updError);
                    } else {
                        totalUpdated++;
                    }
                }
            }));
            };

            for (let i = 0; i < turnos.length; i += 50) {
                const chunk = turnos.slice(i, i + 50);
                await processChunk(chunk);
            }

            offset += limit;
        }

        console.log(`\n✅ Proceso completado. Se alinearon ${totalUpdated} turnos al estándar de Conceptos.`);

    } catch (error) {
        console.error('Error catastrófico en script:', error);
    }
}

backfillConceptos();
