FROM node:20-slim

# Habilitar caché para apt-get en Docker
RUN rm -f /etc/apt/apt.conf.d/docker-clean; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache

# Instalar ffmpeg y herramientas de healthcheck usando el caché de apt para evitar descargas repetidas
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y ffmpeg curl wget

# Crear directorio de trabajo
WORKDIR /app

# Copiar package files primero para aprovechar la caché de capas de Docker
COPY package*.json ./

# Configurar reintentos de npm para conexiones de red inestables o lentas en la VPS
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 15000 && \
    npm config set fetch-retry-maxtimeout 90000

# Instalar dependencias utilizando la súper caché de BuildKit para npm
RUN --mount=type=cache,target=/root/.npm,sharing=shared \
    npm install

# Copiar el resto del código
COPY . .

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "run", "start:prod"]
