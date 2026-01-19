import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, IsInt, IsBoolean, IsArray, ValidateNested, IsEnum } from "class-validator";
import { Type } from "class-transformer";

// Detalle de configuración (reglas del turno)
class DetalleConfiguracionDto {
  @ApiProperty({ example: 1, description: "Orden de la regla en el ciclo" })
  @IsInt()
  orden: number;

  @ApiProperty({ example: "DIURNO", description: "Tipo de turno: DIURNO, NOCTURNO, DESCANSO, etc." })
  @IsString()
  tipo: string;

  @ApiProperty({ example: "07:00:00", description: "Hora de inicio del turno" })
  @IsString()
  hora_inicio: string;

  @ApiProperty({ example: "19:00:00", description: "Hora de fin del turno" })
  @IsString()
  hora_fin: string;

  @ApiProperty({ example: 1, description: "Cantidad de plazas para esta regla", required: false })
  @IsOptional()
  @IsInt()
  plazas?: number;

  // --- NUEVOS CAMPOS FLEXIBLES ---
  @ApiProperty({
    example: [1, 2, 3, 4, 5],
    description: "Días de la semana que aplica esta regla (0=Dom, 1=Lun, ..., 6=Sab)",
    required: false
  })
  @IsOptional()
  @IsArray()
  dias_semana?: number[];

  @ApiProperty({
    example: "indiferente",
    description: "Comportamiento en festivos: indiferente, no_aplica, solo_festivos",
    required: false,
    enum: ['indiferente', 'no_aplica', 'solo_festivos']
  })
  @IsOptional()
  @IsEnum(['indiferente', 'no_aplica', 'solo_festivos'])
  aplica_festivos?: 'indiferente' | 'no_aplica' | 'solo_festivos';
}

export class CreateTurnoConfiguracionDto {
  @ApiProperty({ example: "Turno Mixto Jácome" })
  @IsString()
  nombre: string;

  @ApiProperty({ example: "L-V 12h, Sab 5h, Noches Finde", required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: 7, description: "Días del ciclo (para cíclico) o referencia semanal (para semanal)" })
  @IsInt()
  dias_ciclo: number;

  @ApiProperty({ example: 8, required: false })
  @IsOptional()
  @IsInt()
  horas_dia?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // --- NUEVO CAMPO CLAVE ---
  @ApiProperty({
    example: "semanal_reglas",
    description: "Estrategia de proyección: ciclico (2x2, 2x2x2) o semanal_reglas (flexible por días)",
    required: false,
    enum: ['ciclico', 'semanal_reglas']
  })
  @IsOptional()
  @IsEnum(['ciclico', 'semanal_reglas'])
  tipo_proyeccion?: 'ciclico' | 'semanal_reglas';

  // --- DETALLES/REGLAS ---
  @ApiProperty({
    type: [DetalleConfiguracionDto],
    description: "Lista de reglas/detalles del turno",
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleConfiguracionDto)
  detalles?: DetalleConfiguracionDto[];
}

export class UpdateTurnoConfiguracionDto extends PartialType(CreateTurnoConfiguracionDto) { }
