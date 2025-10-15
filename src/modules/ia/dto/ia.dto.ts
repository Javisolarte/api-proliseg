import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class IaDto {
  @ApiProperty({
    example: 'Muéstrame todos los empleados activos',
    description: 'Consulta en lenguaje natural para convertir a SQL.',
  })
  @IsString()
  @MinLength(3)
  query: string;
}
