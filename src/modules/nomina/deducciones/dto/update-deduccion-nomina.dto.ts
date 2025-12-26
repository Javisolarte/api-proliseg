import { PartialType } from '@nestjs/swagger';
import { CreateDeduccionNominaDto } from './create-deduccion-nomina.dto';

export class UpdateDeduccionNominaDto extends PartialType(CreateDeduccionNominaDto) { }
