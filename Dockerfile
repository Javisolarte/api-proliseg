FROM node:20-slim

# Evitar la descarga manual de Chromium por parte de Puppeteer durante el build
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Configurar explícitamente NODE_ENV a desarrollo durante el build para evitar que npm u otras herramientas omitan cosas
ENV NODE_ENV=development

# Configurar variable para evitar prompts interactivos
ARG DEBIAN_FRONTEND=noninteractive

# 1. Instalar dependencias del sistema operativo (Paso pesado - Secuencial y Cacheado)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    wget \
    chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 2. Crear directorio de trabajo
WORKDIR /app

# 3. Copiar archivos de dependencias primero para aprovechar la caché de Docker
COPY package*.json ./

# 4. Configurar reintentos en npm y nivel de log silencioso para conexiones inestables
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 15000 && \
    npm config set fetch-retry-maxtimeout 90000 && \
    npm config set loglevel warn

# 5. Instalar dependencias (incluyendo devDependencies para poder compilar NestJS/TypeScript)
# Usamos --no-audit y --no-fund para acelerar la descarga y evitar sobrecargar la red/CPU
RUN npm install --include=dev --ignore-scripts --no-audit --no-fund

# 6. Copiar el resto de archivos del código fuente
COPY . .

# 7. Compilar TypeScript
RUN npm run build

# 8. Eliminar dependencias de desarrollo y limpiar caché de npm
RUN npm prune --production && npm cache clean --force

# 9. Copiar el archivo de Firebase si existe (opcional con truco de wildcard)
COPY package.json *-firebase-adminsdk-*.json ./

# Configurar NODE_ENV a producción para el tiempo de ejecución
ENV NODE_ENV=production

# Exponer puerto
EXPOSE 3000

# Healthcheck para Coolify
HEALTHCHECK --interval=10s --timeout=5s --start-period=180s --retries=12 CMD curl -f http://127.0.0.1:10000/ || curl -f http://127.0.0.1:3000/ || exit 1

# Comando de inicio
CMD ["npm", "run", "start:prod"]
