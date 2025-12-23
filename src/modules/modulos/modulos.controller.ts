import { Controller, Get, Post, Body } from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { CreateModuloDto } from './dto/create-modulo.dto';

@Controller('modulos')
export class ModulosController {
    constructor(private readonly modulosService: ModulosService) { }

    @Get()
    findAll() {
        return this.modulosService.findAll();
    }

    @Post()
    create(@Body() createModuloDto: CreateModuloDto) {
        return this.modulosService.create(createModuloDto);
    }
}
