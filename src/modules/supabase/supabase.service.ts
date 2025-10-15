import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabaseClient: SupabaseClient; // Cliente estándar (anon)
  private supabaseAdmin: SupabaseClient;  // Cliente admin (service role)

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('❌ Supabase configuration keys are missing (URL, ANON_KEY, SERVICE_ROLE_KEY)');
    }

    // Cliente normal (RLS activado)
    this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: true, persistSession: false },
    });

    // Cliente admin (bypass RLS)
    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    this.logger.log('✅ Supabase clients initialized successfully');
  }

  /** Retorna cliente anónimo (RLS activo) */
  getClient(): SupabaseClient {
    if (!this.supabaseClient) throw new Error('Supabase client not initialized');
    return this.supabaseClient;
  }

  /** Retorna cliente admin (bypass RLS) */
  getSupabaseAdminClient(): SupabaseClient {
    if (!this.supabaseAdmin) throw new Error('Supabase admin client not initialized');
    return this.supabaseAdmin;
  }

  /** Crea un cliente con token de usuario autenticado */
  getClientWithAuth(token: string): SupabaseClient {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL or Anon Key not defined in configuration');
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /** Verifica token y retorna el usuario */
  async verifyToken(token: string) {
    const { data, error } = await this.supabaseAdmin.auth.getUser(token);
    if (error) throw error;
    return data.user;
  }
}
