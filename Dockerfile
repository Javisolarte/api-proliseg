FROM node:20-slim

# Instalar ffmpeg y herramientas de healthcheck
RUN apt-get update && apt-get install -y ffmpeg curl wget

# Crear directorio de trabajo
WORKDIR /app

# Copiar package files primero para aprovechar la caché de capas de Docker
COPY package*.json ./

# Configurar reintentos de npm para conexiones de red inestables o lentas
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 15000 && \
    npm config set fetch-retry-maxtimeout 90000

# Instalar todas las dependencias (incluyendo devDependencies como TypeScript para la fase de compilación)
RUN npm install --include=dev

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
