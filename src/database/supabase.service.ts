import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('❌ Supabase configuration is missing');
    }

    // Cliente usuario normal (respeta RLS)
    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: true, persistSession: false },
    });

    // Cliente administrador (bypass RLS)
    this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    this.logger.log('✅ Supabase clients initialized successfully');
  }

  /** Cliente estándar (usuario) */
  getClient(): SupabaseClient {
    if (!this.client) throw new Error('Supabase client not initialized');
    return this.client;
  }

  /** Cliente administrador (bypass RLS) */
  getSupabaseAdminClient(): SupabaseClient {
    if (!this.adminClient) throw new Error('Supabase admin client not initialized');
    return this.adminClient;
  }

  /** Cliente con token de usuario */
  getClientWithAuth(token: string): SupabaseClient {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL or Anon Key is missing');
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Consulta genérica */
  async query<T = any>(
    table: string,
    options?: {
      select?: string;
      filters?: Record<string, any>;
      order?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: T[]; error: any; count?: number }> {
    let query = this.getClient().from(table).select(options?.select ?? '*', { count: 'exact' });

    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => (query = query.eq(key, value)));
    }
    if (options?.order)
      query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset)
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

    const { data, error, count } = await query;

    return {
      data:
        error || !Array.isArray(data) || (Array.isArray(data) && data.length > 0 && 'message' in data[0])
          ? []
          : (data as T[]),
      error,
      count: count === null ? undefined : count,
    };
  }

  /** Insertar registro */
  async insert<T = any>(table: string, data: any | any[]): Promise<{ data: T | null; error: any }> {
    const { data: result, error } = await this.getClient().from(table).insert(data).select().single();
    return { data: result ?? null, error };
  }

  /** Actualizar registro por ID */
  async update<T = any>(table: string, id: number, data: any): Promise<{ data: T | null; error: any }> {
    const { data: result, error } = await this.getClient().from(table).update(data).eq('id', id).select().single();
    return { data: result ?? null, error };
  }

  /** Eliminar registro por ID */
  async delete(table: string, id: number): Promise<{ error: any }> {
    const { error } = await this.getClient().from(table).delete().eq('id', id);
    return { error };
  }

  /** Ejecutar función RPC con cliente admin */
  async rpc<T = any>(functionName: string, params?: any): Promise<{ data: T | null; error: any }> {
    const { data, error } = await this.getSupabaseAdminClient().rpc(functionName, params);
    return { data: data ?? null, error };
  }
}
