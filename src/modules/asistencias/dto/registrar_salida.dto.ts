// 📁 src/modules/asistencias/dto/registrar_salida.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class RegistrarSalidaDto {
  @ApiProperty({ example: 12 })
  asistencia_id: number;

  @ApiProperty({ example: 5 })
  turno_id: number; // ✅ Necesario para buscar el lugar

  @ApiProperty({ example: '3.4516' })
  latitud: string;

  @ApiProperty({ example: '-76.5320' })
  longitud: string;

  @ApiProperty({ required: false })
  observacion?: string;
}
