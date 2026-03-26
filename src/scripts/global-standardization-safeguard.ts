import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  console.log('🚀 Iniciando Salvaguarda de Estandarización Global...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabase = app.get(SupabaseService).getSupabaseAdminClient();

  // Mapeo detallado
  const map: Record<string, { name: string, id: number }> = {
    'D': { name: 'DIA', id: 1 },
    'DIA': { name: 'DIA', id: 1 },
    'DIURNO': { name: 'DIA', id: 1 },
    'D12': { name: 'DIA', id: 1 },
    'NORMAL': { name: 'DIA', id: 1 },
    'N': { name: 'NOCHE', id: 2 },
    'NOCHE': { name: 'NOCHE', id: 2 },
    'NOCTURNO': { name: 'NOCHE', id: 2 },
    'N12': { name: 'NOCHE', id: 2 },
    'Z': { name: 'DESCANSO', id: 3 },
    'DESCANSO': { name: 'DESCANSO', id: 3 },
    'Descanso': { name: 'DESCANSO', id: 3 },
    'X': { name: 'DESCANSO', id: 3 },
    'OFF': { name: 'DESCANSO', id: 3 },
    'RET': { name: 'RETIRADO', id: 5 },
    'RETIRADO': { name: 'RETIRADO', id: 5 },
    'INC': { name: 'INCAPACIDAD', id: 9 },
    'INCAPACIDAD': { name: 'INCAPACIDAD', id: 9 },
    'R': { name: 'REEMPLAZO', id: 12 },
    'REEMPLAZO': { name: 'REEMPLAZO', id: 12 },
    'PNR': { name: 'PERMISO NO REMUNERADO', id: 7 },
    'PERMISO NO REMUNERADO': { name: 'PERMISO NO REMUNERADO', id: 7 },
    'LIC': { name: 'LICENCIA', id: 6 },
    'LICENCIA': { name: 'LICENCIA', id: 6 },
    'INDUCCION': { name: 'INDUCCION', id: 4 },
    'IND': { name: 'INDUCCION', id: 4 },
  };

  let offset = 0;
  let hasMore = true;
  let count = 0;

  while (hasMore) {
    const { data, error } = await supabase
      .from('turnos')
      .select('id, tipo_turno, concepto_id, hora_inicio')
      .range(offset, offset + 999);

    if (error) {
      console.error(error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    for (const t of data) {
      let targetName: string = '';
      let targetId: number | null = null;

      if (t.tipo_turno === 'RELEVO') {
        const h = t.hora_inicio || '00:00:00';
        if (h >= '17:00:00' || h < '05:00:00') {
           targetName = 'NOCHE'; targetId = 2;
        } else {
           targetName = 'DIA'; targetId = 1;
        }
      } else if (map[t.tipo_turno]) {
        targetName = map[t.tipo_turno].name;
        targetId = map[t.tipo_turno].id;
      }

      // Solo actualizar si es diferente o le falta el ID
      if (targetId && (t.tipo_turno !== targetName || t.concepto_id !== targetId)) {
        await supabase.from('turnos').update({ tipo_turno: targetName, concepto_id: targetId }).eq('id', t.id);
        count++;
      }
    }

    offset += 1000;
    console.log(`... procesados ${offset} turnos (Actualizados: ${count})`);
  }

  await app.close();
  console.log(`🎉 Finalizado. Total registros corregidos: ${count}`);
}

run();
