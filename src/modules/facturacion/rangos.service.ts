import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FactusApiService } from './factus-api.service';

@Injectable()
export class RangosService {
  private readonly logger = new Logger(RangosService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly factusApi: FactusApiService
  ) {}

  async findAll() {
    return [];
  }

  async syncRangosFactus() {
    return { success: true };
  }
}
