# ==========================================
# ETAPA 1: Compilación de la aplicación
# ==========================================
FROM node:20-slim AS builder

# Configurar variables para evitar prompts interactivos durante el build
ARG DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copiar archivos de dependencias primero para cachear la instalación de npm
COPY package*.json ./

# Configurar reintentos en npm por si la conexión del servidor es inestable
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 15000 && \
    npm config set fetch-retry-maxtimeout 90000

# Instalar TODAS las dependencias (necesitamos devDependencies como typescript y nest-cli)
RUN npm install --include=dev --ignore-scripts

# Copiar el código fuente
COPY . .

# Compilar la aplicación NestJS a JavaScript
RUN npm run build

# Eliminar dependencias de desarrollo y limpiar la caché de npm para aligerar la imagen
RUN npm prune --production && npm cache clean --force


# ==========================================
# ETAPA 2: Entorno de ejecución de producción
# ==========================================
FROM node:20-slim AS runner

# Configurar variables de entorno requeridas por Puppeteer y Node
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ARG DEBIAN_FRONTEND=noninteractive

# Instalar ffmpeg, herramientas de healthcheck y Chromium en la etapa final
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    wget \
    chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar solo el código compilado y los módulos de producción desde el builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copiar el archivo de Firebase si existe (usando truco de wildcard opcional con package.json)
COPY --from=builder /app/package.json /app/*-firebase-adminsdk-*.json ./

# Exponer el puerto
EXPOSE 3000

# Healthcheck optimizado para Coolify
HEALTHCHECK --interval=10s --timeout=5s --start-period=180s --retries=12 CMD curl -f http://127.0.0.1:10000/ || curl -f http://127.0.0.1:3000/ || exit 1

# Comando de inicio
CMD ["npm", "run", "start:prod"]
