import { GeminiService } from 'src/modules/ia/gemini.service';

export async function analizarAsistenciaIA(
  gemini: GeminiService,
  empleado: any,
  lugar: any,
  distancia: number,
  tipo: 'entrada' | 'salida',
  foto_url?: string
) {
  let prompt = `
El empleado ${empleado.nombre} realizó una ${tipo} en el lugar ${lugar.nombre}.
La distancia entre la ubicación esperada y la real fue de ${distancia.toFixed(2)} metros.
`;

  if (foto_url) {
    const promptVision = `
${prompt}
Además, basándote en la foto adjunta, realiza una inspección de presentación personal del guarda de seguridad:
1. ¿Tiene el carnet de la empresa visible y puesto?
2. ¿Se ve en buen estado físico o se nota muy cansado/con ojeras marcadas?
3. ¿Está usando el uniforme correctamente?

Responde de forma muy breve, profesional y directa en español. Indica el nivel de riesgo y una breve observación sobre su presentación.
`;
    return await gemini.analyzeImage(foto_url, promptVision);
  }

  const promptFinal = prompt + `\nAnaliza si este comportamiento es anómalo o normal.\nSi supera los 900 metros, considera que podría ser irregular.\nResponde brevemente en español indicando si parece una asistencia normal o si se debe revisar.`;
  return await gemini.humanResponse(promptFinal);
}
