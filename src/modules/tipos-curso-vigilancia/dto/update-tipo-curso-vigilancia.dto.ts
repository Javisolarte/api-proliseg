import { PartialType } from '@nestjs/swagger';
import { CreateTipoCursoVigilanciaDto } from './create-tipo-curso-vigilancia.dto';

export class UpdateTipoCursoVigilanciaDto extends PartialType(CreateTipoCursoVigilanciaDto) { }
