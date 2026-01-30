import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto/feature-flag.dto';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class FeatureFlagsService {
    private readonly logger = new Logger(FeatureFlagsService.name);
    private readonly CACHE_PREFIX = 'feature_flag:';
    private readonly CACHE_TTL = 300; // 5 minutes

    constructor(
        private readonly supabaseService: SupabaseService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async create(createDto: CreateFeatureFlagDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('feature_flags')
            .insert(createDto)
            .select()
            .single();

        if (error) throw error;

        // Cache the new flag
        await this.cacheInRedis(data.flag_key, data.enabled);

        return data;
    }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('feature_flags')
            .select('*')
            .order('flag_key');

        if (error) throw error;
        return data;
    }

    async findOne(key: string) {
        // Try cache first
        const cached = await this.cacheManager.get(`${this.CACHE_PREFIX}${key}`);
        if (cached !== undefined) {
            return { flag_key: key, enabled: cached };
        }

        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('feature_flags')
            .select('*')
            .eq('flag_key', key)
            .single();

        if (error) {
            this.logger.warn(`Feature flag ${key} not found, defaulting to false`);
            return { flag_key: key, enabled: false };
        }

        // Cache it
        await this.cacheInRedis(key, data.enabled);

        return data;
    }

    async update(key: string, updateDto: UpdateFeatureFlagDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('feature_flags')
            .update({ ...updateDto, updated_at: new Date() })
            .eq('flag_key', key)
            .select()
            .single();

        if (error) throw error;

        // Invalidate cache
        await this.cacheManager.del(`${this.CACHE_PREFIX}${key}`);

        // Re-cache with new value
        if (updateDto.enabled !== undefined) {
            await this.cacheInRedis(key, updateDto.enabled);
        }

        return data;
    }

    async isEnabled(key: string): Promise<boolean> {
        const flag = await this.findOne(key);
        return flag.enabled;
    }

    private async cacheInRedis(key: string, enabled: boolean) {
        try {
            await this.cacheManager.set(
                `${this.CACHE_PREFIX}${key}`,
                enabled,
                this.CACHE_TTL,
            );
        } catch (error) {
            this.logger.error(`Failed to cache feature flag ${key}:`, error);
        }
    }
}
