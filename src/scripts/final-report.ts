import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  console.log('📊 Generando Análisis Final de tipo_turno...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabase = app.get(SupabaseService).getSupabaseAdminClient();

  let allData: any[] = [];
  let from = 0;
  let to = 999;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('turnos')
      .select('tipo_turno, concepto_id')
      .range(from, to);

    if (error) {
      console.error('❌ Error obteniendo datos:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      from += 1000;
      to += 1000;
    }
    
    // Safety break for huge tables if needed, but here we want the full count
    if (allData.length > 50000) break; 
  }

  const stats: any = {};
  allData.forEach(t => {
    const key = `${t.tipo_turno || 'NULL'} (Concepto: ${t.concepto_id || 'NULL'})`;
    stats[key] = (stats[key] || 0) + 1;
  });

  console.log('\n✅ RESULTADOS GLOBALES DE ESTANDARIZACIÓN:');
  const tableData = Object.entries(stats)
    .map(([name, count]) => ({ 'Tipo de Turno (Concepto ID)': name, 'Total Registros': count }))
    .sort((a, b) => (b['Total Registros'] as number) - (a['Total Registros'] as number));
  
  console.table(tableData);

  await app.close();
  process.exit(0);
}

run();
