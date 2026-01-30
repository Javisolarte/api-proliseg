import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto/feature-flag.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('api/features')
@UseGuards(JwtAuthGuard)
export class FeatureFlagsController {
    constructor(private readonly featureFlagsService: FeatureFlagsService) { }

    @Get()
    @RequirePermissions('ver_feature_flags')
    findAll() {
        return this.featureFlagsService.findAll();
    }

    @Get(':key')
    @RequirePermissions('ver_feature_flags')
    findOne(@Param('key') key: string) {
        return this.featureFlagsService.findOne(key);
    }

    @Post()
    @RequirePermissions('crear_feature_flags')
    create(@Body() createDto: CreateFeatureFlagDto) {
        return this.featureFlagsService.create(createDto);
    }

    @Patch(':key')
    @RequirePermissions('editar_feature_flags')
    update(@Param('key') key: string, @Body() updateDto: UpdateFeatureFlagDto) {
        return this.featureFlagsService.update(key, updateDto);
    }
}
