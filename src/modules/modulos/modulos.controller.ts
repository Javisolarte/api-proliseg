import { Controller, Get } from '@nestjs/common';
import { ModulosService } from './modulos.service';

@Controller('modulos')
export class ModulosController {
    constructor(private readonly modulosService: ModulosService) { }

    @Get()
    findAll() {
        return this.modulosService.findAll();
    }
}
