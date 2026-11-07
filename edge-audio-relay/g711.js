'use strict';

/**
 * Tablas ITU-T G.711 precomputadas (O(1) por muestra, 0.01 ms por trama de 40 ms)
 */
const MULAW_TO_PCM16 = new Int16Array(256);
const MULAW_TO_ALAW = new Uint8Array(256);

function decodeMulawByte(uVal) {
  uVal = (~uVal) & 0xff;
  const sign = uVal & 0x80;
  const exponent = (uVal >> 4) & 0x07;
  const mantissa = uVal & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign ? -sample : sample;
}

function encodeAlawSample(pcmVal) {
  let mask = 0x55;
  let pcm = pcmVal;
  if (pcm >= 0) {
    mask |= 0x80;
  } else {
    pcm = -pcm - 1;
    if (pcm < 0) pcm = 0;
  }
  if (pcm > 32767) pcm = 32767;

  let seg = 0;
  const segEnd = [0x1f, 0x3f, 0x7f, 0xff, 0x1ff, 0x3ff, 0x7ff, 0xfff];
  const shifted = pcm >> 3;
  while (seg < 8 && shifted > segEnd[seg]) seg++;
  if (seg >= 8) return 0x7f ^ mask;

  let aval = seg << 4;
  if (seg < 2) {
    aval |= (pcm >> 4) & 0x0f;
  } else {
    aval |= (pcm >> (seg + 3)) & 0x0f;
  }
  return aval ^ mask;
}

for (let i = 0; i < 256; i++) {
  const pcm = decodeMulawByte(i);
  MULAW_TO_PCM16[i] = pcm;
  MULAW_TO_ALAW[i] = encodeAlawSample(pcm);
}

function mulawToAlawBuffer(mulawBuf) {
  const out = Buffer.allocUnsafe(mulawBuf.length);
  for (let i = 0; i < mulawBuf.length; i++) {
    out[i] = MULAW_TO_ALAW[mulawBuf[i]];
  }
  return out;
}

module.exports = {
  MULAW_TO_PCM16,
  MULAW_TO_ALAW,
  mulawToAlawBuffer,
};
