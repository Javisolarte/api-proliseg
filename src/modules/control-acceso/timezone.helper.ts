/**
 * Constantes y utilidades para la gestión precisa de zona horaria en Control de Acceso.
 * Colombia (America/Bogota) opera con UTC-5 fijo (sin horario de verano).
 */
export const OFFSET_COLOMBIA_HORAS = -5;
export const OFFSET_COLOMBIA_MS = -5 * 60 * 60 * 1000;

/**
 * Normaliza cualquier entrada de fecha/hora para visitas de control de acceso.
 *
 * Casos contemplados:
 * 1. String sin zona horaria (ej: "2026-10-13T10:13:00", "2026-10-13 10:13:00", "2026-10-13T10:13:00.000", "2026-10-13"):
 *    Se interpreta como hora local de Colombia (UTC-5) y se convierte a su timestamp UTC real (+5 horas).
 * 2. String procedente de clientes móviles Flutter/Dart que formatean hora local colombiana (ej: "2026-10-13T10:13:00Z" o "2026-10-13T10:13:00.000Z"):
 *    Si `asumirHoraLocalSiTieneZ` es true (por defecto en la App de Residentes),
 *    la hora numérica se interpreta como hora local colombiana y se convierte a UTC sumando 5 horas.
 * 3. String con offset explícito (ej: "2026-10-13T10:13:00-05:00"):
 *    Se parsea directamente respetando el offset indicado.
 * 4. Objeto Date o valor nulo:
 *    Retorna ISO string estándar en UTC.
 */
export function normalizarFechaColombiaUTC(
  input?: string | Date | null,
  asumirHoraLocalSiTieneZ = false
): string {
  if (!input) {
    return new Date().toISOString();
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  const str = String(input).trim();
  if (!str) {
    return new Date().toISOString();
  }

  // 1. Si tiene offset explícito con signo (+HH:MM o -HH:MM):
  if (/[+-]\d{2}:?\d{2}$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // 2. Extraer partes de fecha y hora: YYYY-MM-DD y HH:mm[:ss[.sss]]
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?)?/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hours = match[4] ? parseInt(match[4], 10) : 9;
    const minutes = match[5] ? parseInt(match[5], 10) : 0;
    const seconds = match[6] ? Math.floor(parseFloat(match[6])) : 0;

    const tieneZ = str.endsWith('Z') || str.endsWith('z');

    // Si no tiene 'Z' o si se indicó asumirHoraLocalSiTieneZ:
    // La hora ingresada es hora local de Colombia (UTC-5), por lo que en UTC sumamos 5 horas
    if (!tieneZ || asumirHoraLocalSiTieneZ) {
      const utcDate = new Date(Date.UTC(year, month, day, hours + 5, minutes, seconds, 0));
      return utcDate.toISOString();
    } else {
      // Tiene 'Z' y no forzamos re-interpretación: ya es UTC
      const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds, 0));
      return utcDate.toISOString();
    }
  }

  const fallback = new Date(str);
  return !isNaN(fallback.getTime()) ? fallback.toISOString() : new Date().toISOString();
}

/**
 * Convierte un objeto Date en UTC al formato "YYYY-MM-DDTHH:mm:ss" en hora local de Colombia (UTC-5),
 * necesario para enviar rangos de validez a terminales físicos Hikvision / Dahua.
 */
export function formatearHoraLocalHardwareColombia(date: Date): string {
  const localMs = date.getTime() + OFFSET_COLOMBIA_MS;
  const localDate = new Date(localMs);
  return localDate.toISOString().replace('Z', '').split('.')[0];
}
