import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import {
  SwaggerModule,
  DocumentBuilder,
  SwaggerCustomOptions,
} from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as Sentry from "@sentry/nestjs";
import compression from "compression";
import "dotenv/config";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    Sentry.nestIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
  });

  app.use(compression());
  app.set("trust proxy", true);

  // 📁 Almacenamiento Local SSD de Alta Velocidad (/storage)
  const express = require('express');
  const fs = require('fs');
  const path = require('path');
  const storageDir = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // 1. Servir desde el SSD local con caché inmutable y streaming
  app.use(
    '/storage',
    express.static(storageDir, {
      maxAge: '30d',
      immutable: true,
      fallthrough: true, // Si el archivo no existe aún en disco local, salta al fallback
    })
  );

  // 2. Fallback transparente a Supabase Storage: CERO imágenes rotas durante la transición
  app.use('/storage', (req: any, res: any) => {
    const supabaseUrl = (process.env.SUPABASE_URL || 'https://ttkubmwrwgqxjdafpgji.supabase.co').replace(/\/+$/, '');
    const cleanPath = req.path.replace(/^\/+/, '');
    const targetUrl = `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
    res.redirect(307, targetUrl);
  });

  // 3. Endpoint de sincronización seguro para migración
  app.use('/api/storage-sync/upload', express.json({ limit: '50mb' }), async (req: any, res: any) => {
    const secret = req.headers['x-sync-secret'];
    const expectedSecret = process.env.STORAGE_SYNC_SECRET || 'proliseg-sync-storage-secret-2026';
    if (secret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { bucket, filePath, base64 } = req.body;
    if (!bucket || !filePath || !base64) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
      const cleanPath = filePath.replace(/^\/+/, '');
      const fullPath = path.join(storageDir, bucket, cleanPath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await fs.promises.writeFile(fullPath, Buffer.from(base64, 'base64'));
      return res.json({ success: true, path: `${bucket}/${cleanPath}` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ✅ Configurar límites de carga para permitir fotos
  app.use(require('body-parser').json({ limit: '10mb' }));
  app.use(require('body-parser').urlencoded({ limit: '10mb', extended: true }));

  app.setGlobalPrefix("api", { exclude: ["/", "storage"] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ✅ CORS abierto para desarrollo
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
    .addTag("Vigilancia", "Gestión de cursos y tipos de vigilantes")
    .addTag("Webhooks", "Suscripciones y notificaciones externas")
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
