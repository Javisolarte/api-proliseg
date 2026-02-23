/**
 * Retorna la fecha actual ajustada a la zona horaria de Colombia (UTC-5)
 * El servidor usualmente opera en UTC, este helper asegura que los logs
 * y registros de asistencia tengan la hora local correcta.
 */
export function getColombiaTime(): Date {
    const now = new Date();
    // Colombia es UTC-5 siempre (no tiene horario de verano)
    const offsetMs = -5 * 60 * 60 * 1000;
    // getTimezoneOffset() devuelve la diferencia en minutos entre UTC y la hora local del sistema
    // Lo sumamos para llegar a UTC puro, y restamos 5 horas.
    return new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + offsetMs);
}
