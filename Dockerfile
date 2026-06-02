FROM node:20-slim

# Instalar ffmpeg y curl (requerido para el healthcheck de Coolify)
RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Configurar reintentos de npm para conexiones de red inestables o lentas en la VPS
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 15000 && \
    npm config set fetch-retry-maxtimeout 90000

# Instalar dependencias
RUN npm install

# Copiar el código
COPY . .

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "run", "start:prod"]
