/**
 * 📏 Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine.
 * @param lat1 Latitud del primer punto (ej. empleado)
 * @param lon1 Longitud del primer punto
 * @param lat2 Latitud del segundo punto (ej. lugar asignado)
 * @param lon2 Longitud del segundo punto
 * @returns Distancia en metros (número decimal)
 */
export function calcularDistancia(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  // Validar entradas
  if (
    [lat1, lon1, lat2, lon2].some(
      (v) => v === undefined || v === null || isNaN(v),
    )
  ) {
    console.warn('⚠️ Parámetros inválidos en calcularDistancia:', {
      lat1,
      lon1,
      lat2,
      lon2,
    });
    return 0;
  }

  const R = 6371e3; // radio de la Tierra en metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  // Fórmula de Haversine
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distancia = R * c;

  return parseFloat(distancia.toFixed(2)); // resultado en metros
}
