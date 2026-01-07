import { GeminiService } from 'src/modules/ia/gemini.service';

export async function analizarAsistenciaIA(
  gemini: GeminiService,
  empleado: any,
  lugar: any,
  distancia: number,
  tipo: 'entrada' | 'salida'
) {
  const prompt = `
El empleado ${empleado.nombre} realizó una ${tipo} en el lugar ${lugar.nombre}.
La distancia entre la ubicación esperada y la real fue de ${distancia.toFixed(2)} metros.

Analiza si este comportamiento es anómalo o normal.
Si supera los 900 metros, considera que podría ser irregular.
Responde brevemente en español indicando si parece una asistencia normal o si se debe revisar.
`;

  return await gemini.humanResponse(prompt);
}
