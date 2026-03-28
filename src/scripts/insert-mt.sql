INSERT INTO "public"."conceptos_turno" 
("codigo", "nombre", "descripcion", "horas_normales", "horas_extras", "paga_salario", "paga_aux_transporte", "color", "activo", "created_at", "updated_at") 
VALUES 
('MT', 'MEDIO TIEMPO', 'Turno de Medio Tiempo (Paga mitad)', '4.00', '0.00', true, true, '#00bcd4', true, NOW(), NOW())
ON CONFLICT ("codigo") DO NOTHING;
