import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class SubmitRespuestaDto {
    @ApiProperty({ description: 'ID de la pregunta que se responde', example: 105 })
    @IsInt()
    @IsNotEmpty()
    pregunta_id: number;

    @ApiProperty({ description: 'ID de la opción seleccionada', example: 450 })
    @IsInt()
    @IsNotEmpty()
    opcion_id: number;
}
