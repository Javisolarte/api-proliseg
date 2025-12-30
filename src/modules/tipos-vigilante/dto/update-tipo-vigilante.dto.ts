import { PartialType } from '@nestjs/swagger';
import { CreateTipoVigilanteDto } from './create-tipo-vigilante.dto';

export class UpdateTipoVigilanteDto extends PartialType(CreateTipoVigilanteDto) { }
