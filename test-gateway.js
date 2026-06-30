const net = require('net');

// Configuración del simulador
const HOST = '147.93.189.87'; // Cambiar a la IP de tu VPS (ej. '147.93.189.87') para probar en producción
const PORT = 9008;       // Puerto del Gateway TCP de comandos
const CUENTA = '2002';    // Cuenta del panel de Villa Rica

console.log(`🤖 Iniciando simulador de panel físico Intelbras AMT (Cuenta: ${CUENTA})...`);
console.log(`📡 Conectando al Gateway TCP en ${HOST}:${PORT}...`);

const client = net.createConnection({ port: PORT, host: HOST }, () => {
  console.log('✅ Conectado al Gateway TCP!');
  
  // 1. Enviar trama de login para asociar la conexión a la cuenta 2002
  const loginPacket = `[LOGIN#${CUENTA}]`;
  console.log(`📤 Enviando login: ${loginPacket}`);
  client.write(loginPacket);

  // 2. Programar envío periódico de Heartbeats (Keep-Alive) cada 15 segundos
  setInterval(() => {
    console.log('💓 Enviando Heartbeat: [PING]');
    client.write('[PING]');
  }, 15000);
});

// Escuchar tramas y comandos enviados desde Proli Control
client.on('data', (data) => {
  const command = data.toString('utf-8').trim();
  console.log(`\n📥 [Comando Recibido de Proli Control]: ${command}`);

  // Simular respuesta física del panel (ACK de comando recibido y ejecutado)
  if (command.startsWith('[ARM_PART_')) {
    console.log('⚡ [Simulador Panel]: Ejecutando armado físico de relé...');
    console.log('📤 Enviando confirmación de Armado.');
    client.write('[ACK_ARMADO_OK]');
  } else if (command.startsWith('[DISARM_PART_')) {
    console.log('⚡ [Simulador Panel]: Ejecutando desarmado físico...');
    console.log('📤 Enviando confirmación de Desarmado.');
    client.write('[ACK_DESARMADO_OK]');
  } else if (command.startsWith('[SIREN_ON]')) {
    console.log('⚡ [Simulador Panel]: 🚨 ¡SIRENA FÍSICA ACTIVADA! (Ruido encendido)');
    client.write('[ACK_SIRENA_ON]');
  } else if (command.startsWith('[SIREN_OFF]')) {
    console.log('⚡ [Simulador Panel]: 🔇 Sirena silenciada.');
    client.write('[ACK_SIRENA_OFF]');
  } else if (command.startsWith('[SYNC_USER_')) {
    console.log('⚡ [Simulador Panel]: Guardando clave PIN en la memoria del teclado...');
    client.write('[ACK_USER_SYNC]');
  }
});

client.on('end', () => {
  console.log('🔌 Conexión cerrada por el servidor.');
  process.exit(0);
});

client.on('error', (err) => {
  console.error('❌ Error de conexión:', err.message);
  console.log('Asegúrate de que el backend de api-proliseg esté corriendo y escuchando en el puerto 9008.');
  process.exit(1);
});
