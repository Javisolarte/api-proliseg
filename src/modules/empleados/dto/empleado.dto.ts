import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNumber,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";

export class CreateEmpleadoDto {
  @ApiProperty({ example: 1, required: false, description: "FK a usuarios_externos.id (opcional)" })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  usuario_id?: number;

  @ApiProperty({ example: "Juan Pérez García", description: "Nombre completo del empleado" })
  @IsString()
  nombre_completo: string;

  @ApiProperty({ example: "1234567890", description: "Número de cédula" })
  @IsString()
  cedula: string;

  @ApiProperty({ example: "2020-01-15", required: false })
  @IsOptional()
  @IsDateString()
  fecha_expedicion?: string;

  @ApiProperty({ example: "1990-05-20", required: false })
  @IsOptional()
  @IsDateString()
  fecha_nacimiento?: string;

  @ApiProperty({ example: "3001234567", required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ example: "juan.perez@ejemplo.com", required: false })
  @IsOptional()
  @IsEmail()
  correo?: string;

  @ApiProperty({ example: "Calle 123 #45-67", required: false })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ example: "Cundinamarca", required: false })
  @IsOptional()
  @IsString()
  departamento?: string;

  @ApiProperty({ example: "Bogotá", required: false })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiProperty({ example: "Soltero", required: false })
  @IsOptional()
  @IsString()
  estado_civil?: string;

  @ApiProperty({ example: "Masculino", required: false })
  @IsOptional()
  @IsString()
  genero?: string;

  @ApiProperty({ example: 1, required: false, description: "ID del contrato personal (FK a contratos_personal)" })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  contrato_personal_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  eps_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  arl_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  fondo_pension_id?: number;

  @ApiProperty({ example: "2023-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_afiliacion_eps?: string;

  @ApiProperty({ example: "2024-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin_eps?: string;

  @ApiProperty({ example: "2023-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_afiliacion_arl?: string;

  @ApiProperty({ example: "2024-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin_arl?: string;

  @ApiProperty({ example: "2023-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_afiliacion_pension?: string;

  @ApiProperty({ example: "2024-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin_pension?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  activo?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  verificado_documentos?: boolean;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  verificado_por?: number;

  @ApiProperty({ example: "2023-01-01T10:00:00Z", required: false })
  @IsOptional()
  @IsDateString()
  fecha_verificacion?: string;

  @ApiProperty({ example: "empleado", required: false, description: "Rol como texto (ej: 'empleado', 'supervisor')" })
  @IsOptional()
  @IsString()
  rol?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  asignado?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  nivel_confianza?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  riesgo_ausencia?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  rendimiento_promedio?: number;

  @ApiProperty({ example: "2023-01-01T10:00:00Z", required: false })
  @IsOptional()
  @IsDateString()
  ultima_evaluacion?: string;

  @ApiProperty({ example: 1, required: false, description: "ID del tipo de vigilante (Requerido solo si rol es 'vigilante')" })
  @IsOptional()
  @ValidateIf((o) => o.rol === 'vigilante')
  @IsInt()
  @Transform(({ value }) => {
    if (value === null || value === 'null' || value === '') return null;
    return parseInt(value);
  })
  tipo_vigilante_id?: number | null;

  @ApiProperty({
    example: "Bachiller",
    required: false,
    description: "Nivel de formación académica (ej: Bachiller, Técnico, Tecnólogo, Profesional, Especialización, Maestría, Doctorado)"
  })
  @IsOptional()
  @IsString()
  formacion_academica?: string;

  @ApiProperty({ example: "O+", required: false, description: "Grupo sanguíneo y RH (ej: O+, A-, etc)" })
  @IsOptional()
  @IsString()
  rh?: string;

  @ApiProperty({ example: "Bogotá", required: false, description: "Lugar de expedición del documento" })
  @IsOptional()
  @IsString()
  lugar_expedicion?: string;

  @ApiProperty({ example: "3109876543", required: false, description: "Teléfono alternativo" })
  @IsOptional()
  @IsString()
  telefono_2?: string;

  @ApiProperty({ example: "url/foto.jpg", required: false })
  @IsOptional()
  @IsString()
  foto_perfil_url?: string;

  @ApiProperty({ example: "url/cedula.pdf", required: false })
  @IsOptional()
  @IsString()
  cedula_pdfurl?: string;

  @ApiProperty({ example: "url/hv.pdf", required: false })
  @IsOptional()
  @IsString()
  hoja_de_vida_url?: string;

  @ApiProperty({ example: ["url1.pdf", "url2.pdf"], required: false })
  @IsOptional()
  certificados_urls?: string[];

  @ApiProperty({ example: ["url1.pdf", "url2.pdf"], required: false })
  @IsOptional()
  documentos_adicionales_urls?: string[];

  @ApiProperty({ example: false, required: false, description: "Indica si tiene alguna discapacidad" })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  tiene_discapacidad?: boolean;

  @ApiProperty({ example: "Ninguna", required: false, description: "Descripción de la discapacidad si aplica" })
  @IsOptional()
  @IsString()
  descripcion_discapacidad?: string;

  @ApiProperty({ example: "5 años de experiencia en seguridad", required: false, description: "Resumen de experiencia laboral" })
  @IsOptional()
  @IsString()
  experiencia?: string;

  @ApiProperty({ example: "Observaciones generales", required: false, description: "Observaciones adicionales" })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ example: false, required: false, description: "Indica si tiene curso de vigilancia" })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  tiene_curso_vigilancia?: boolean;

  @ApiProperty({ example: 1, required: false, description: "ID del tipo de curso de vigilancia" })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => {
    if (value === null || value === 'null' || value === '') return null;
    return parseInt(value);
  })
  tipo_curso_vigilancia_id?: number | null;

  @ApiProperty({ example: "2025-12-31", required: false, description: "Fecha de vencimiento del curso de vigilancia" })
  @IsOptional()
  @IsDateString()
  fecha_vencimiento_curso?: string;

  @ApiProperty({ example: "123456789", required: false, description: "Número de cuenta bancaria" })
  @IsOptional()
  @IsString()
  numero_cuenta?: string;

  @ApiProperty({ example: "Bancolombia", required: false, description: "Entidad bancaria" })
  @IsOptional()
  @IsString()
  entidad_bancaria?: string;

  @ApiProperty({ example: "Ahorros", required: false, description: "Tipo de cuenta" })
  @IsOptional()
  @IsString()
  tipo_cuenta?: string;

  @ApiProperty({ example: "url/certificado.pdf", required: false })
  @IsOptional()
  @IsString()
  certificado_bancario_url?: string;

  @ApiProperty({ example: "data:image/png;base64,iVBORw0K...", required: false, description: "Firma digital en formato base64" })
  @IsOptional()
  @IsString()
  firma_digital_base64?: string;

  @ApiProperty({ example: 1, required: false, description: "ID de la sede" })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => {
    if (value === null || value === 'null' || value === '') return null;
    return parseInt(value);
  })
  sede_id?: number | null;

  @ApiProperty({ example: "Guarda de Seguridad", required: false, description: "Cargo Oficial del Empleado" })
  @IsOptional()
  @IsString()
  cargo_oficial?: string;
}

export class UpdateEmpleadoDto extends PartialType(CreateEmpleadoDto) { }
