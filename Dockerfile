FROM node:20-slim

# Evitar la descarga manual de Chromium por parte de Puppeteer durante el build
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Instalar ffmpeg, herramientas de healthcheck, Chromium y sus dependencias necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    wget \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar package files primero para aprovechar la caché de capas de Docker
COPY package*.json ./

# Configurar reintentos de npm para conexiones de red inestables o lentas
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 15000 && \
    npm config set fetch-retry-maxtimeout 90000

# Instalar todas las dependencias (incluyendo devDependencies como TypeScript para la fase de compilación)
# Ignoramos los scripts para evitar la descarga de Chrome de Puppeteer en el postinstall
RUN npm install --include=dev --ignore-scripts

# Copiar el resto del código
COPY . .

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Healthcheck para Coolify: soporta tanto el puerto de producción (10000) como el de desarrollo (3000)
HEALTHCHECK --interval=10s --timeout=5s --start-period=180s --retries=12 CMD curl -f http://127.0.0.1:10000/ || curl -f http://127.0.0.1:3000/ || exit 1

# Comando de inicio
CMD ["npm", "run", "start:prod"]
