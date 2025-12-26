import { PartialType } from '@nestjs/swagger';
import { CreateParametroNominaDto } from './create-parametro-nomina.dto';

export class UpdateParametroNominaDto extends PartialType(CreateParametroNominaDto) { }
