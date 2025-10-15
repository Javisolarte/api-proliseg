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
import 'dotenv/config';

async function bootstrap() {
  // 👇 Usa NestExpressApplication para poder acceder a métodos específicos de Express
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
  });

  // ✅ Permitir obtener IP real si estás detrás de proxy (nginx, cPanel, etc.)
  app.set("trust proxy", true);

  // 📦 Parseo de JSON y formularios
  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

  // 🌐 Prefijo global
  app.setGlobalPrefix("api");

  // 🧹 Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 🔓 CORS
  app.enableCors({
    origin: [
      "http://localhost:3001", // ✅ tu web
      "http://192.168.1.37:3001", // ✅ si la web corre desde otra IP local
      "http://192.168.1.37:3000", // ✅ tu app Flutter en red local
      "*" // (opcional) para desarrollo abierto
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // 🧾 Swagger
  const config = new DocumentBuilder()
    .setTitle("🔒 Sistema de Gestión de Seguridad - PROLISEG LTDA")
    .setDescription(
      "API REST con autenticación Supabase y gestión de usuarios, roles y módulos de seguridad",
    )
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Token JWT de Supabase",
        in: "header",
      },
      "JWT-auth",
    )
    .addTag("Auth", "Endpoints de autenticación y registro")
    .addTag("Empleados", "Gestión de empleados y puestos")
    .addTag("Clientes", "Gestión de clientes y contratos")
    .addTag("Seguridad", "Módulos de turnos, asistencias e incidentes")
    .addTag("Configuración", "Gestión de roles, usuarios y permisos")
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
  const port = process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0"); // 👈 Esto permite conexiones desde otras IPs (tu app móvil)

  const url = await app.getUrl();
  console.log(`🚀 Servidor corriendo en: ${url}/api`);
  console.log(`📚 Swagger disponible en: ${url}/api/docs`);
  console.log("🌍 También accesible desde tu red local (por ejemplo):");
  console.log(`👉 http://192.168.1.37:${port}/api`);
}

bootstrap();
