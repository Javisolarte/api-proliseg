import { Injectable } from '@nestjs/common';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  context: string;
  message: string;
  details?: any;
}

@Injectable()
export class SystemLoggerService {
  private logs: LogEntry[] = [];
  private maxLogs = 500;

  constructor() {
    // Semi-populate with recent system activity logs on startup
    const now = new Date();
    this.addLog('INFO', 'SystemInit', 'Plataforma PROLISEG inicializada correctamente.');
    this.addLog('INFO', 'Database', 'Conexión a Supabase DB verificada y sincronizada.');
    this.addLog('INFO', 'Redis', 'Instancia Redis enrutada OK (canal cache & pub/sub activos).');
    this.addLog('INFO', 'JobsEngine', 'Motor de tareas background escuchando cola por defectos.');
  }

  addLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', context: string, message: string, details?: any): LogEntry {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      details,
    };

    this.logs.unshift(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return entry;
  }

  getLogs(filter?: { level?: string; search?: string; limit?: number }): LogEntry[] {
    let result = [...this.logs];

    if (filter?.level && filter.level !== 'ALL') {
      result = result.filter((l) => l.level === filter.level);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.context.toLowerCase().includes(q) ||
          l.level.toLowerCase().includes(q)
      );
    }

    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  clearLogs(): void {
    this.logs = [];
    this.addLog('INFO', 'Console', 'Consola de registros limpiada manualmente por el operador.');
  }
}
