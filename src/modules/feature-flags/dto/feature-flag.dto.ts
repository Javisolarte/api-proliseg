export class CreateFeatureFlagDto {
    flag_key: string;
    enabled: boolean;
    description?: string;
    metadata?: Record<string, any>;
}

export class UpdateFeatureFlagDto {
    enabled?: boolean;
    description?: string;
    metadata?: Record<string, any>;
}

export class FeatureFlagResponseDto {
    flag_key: string;
    enabled: boolean;
    description?: string;
    metadata?: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}
