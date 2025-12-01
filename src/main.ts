import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import {
  SwaggerModule,
  DocumentBuilder,
  SwaggerCustomOptions,
} from "@nestjs/swagger";
import { AppModule } from "./app.module";
import * as bodyParser from "body-parser";
import { NestExpressApplication } from "@nestjs/platform-express";
import "dotenv/config";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
  });

  app.set("trust proxy", true);

  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ✅ CORS abierto para desarrollo (puedes limitar luego)
  app.enableCors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // ✅ Swagger
  const config = new DocumentBuilder()
    .setTitle("🔒 Sistema de Gestión de Seguridad - PROLISEG LTDA")
    .setDescription(
      "API REST con autenticación Supabase y gestión de usuarios, roles y módulos de seguridad"
    )
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        in: "header",
      },
      "JWT-auth"
    )
    .addTag("Auth", "Endpoints de autenticación y registro")
    .addTag("Empleados", "Gestión de empleados y puestos")
    .addTag("Clientes", "Gestión de clientes y contratos")
    .addTag("Seguridad", "Módulos de turnos, asistencias e incidentes")
    .addTag("Configuración", "Gestión de roles, usuarios y permisos")
    .addTag("Salarios", "Gestión de salarios")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const swaggerOptions: SwaggerCustomOptions = {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: "list",
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: "🔐 PROLISEG API Docs",
  };

  SwaggerModule.setup("api/docs", app, document, swaggerOptions);

  // 🚀 Servidor
  const port = parseInt(process.env.PORT || "3000", 10);
  await app.listen(port, "0.0.0.0");

  console.log(`🚀 Servidor corriendo en puerto ${port}`);
  console.log(`📚 Swagger: /api/docs`);
}

bootstrap();
