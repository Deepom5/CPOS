/**
 * UUID v7: time-sortable, unique id usable as primary key on both client and server.
 * Spec: https://datatracker.ietf.org/doc/rfc9562/
 *
 * Layout (128 bits):
 *   48 bits  unix_ts_ms
 *    4 bits  version (= 0b0111)
 *   12 bits  rand_a
 *    2 bits  variant (= 0b10)
 *   62 bits  rand_b
 */

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  const g: any = globalThis as any;
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
    return bytes;
  }
  // Fallback for environments without crypto. Not cryptographically strong,
  // but acceptable for collision-resistance at the scale of a single POS device.
  for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

export function uuidv7(now: number = Date.now()): string {
  const rand = randomBytes(10);
  const ts = BigInt(now);

  // 48-bit timestamp into 6 bytes (big-endian)
  const b0 = Number((ts >> 40n) & 0xffn);
  const b1 = Number((ts >> 32n) & 0xffn);
  const b2 = Number((ts >> 24n) & 0xffn);
  const b3 = Number((ts >> 16n) & 0xffn);
  const b4 = Number((ts >> 8n) & 0xffn);
  const b5 = Number(ts & 0xffn);

  // version (4 bits = 0111) + 12 bits rand_a
  const b6 = 0x70 | (rand[0] & 0x0f);
  const b7 = rand[1];
  // variant (2 bits = 10) + 6 bits rand_b
  const b8 = 0x80 | (rand[2] & 0x3f);
  const b9 = rand[3];
  const b10 = rand[4];
  const b11 = rand[5];
  const b12 = rand[6];
  const b13 = rand[7];
  const b14 = rand[8];
  const b15 = rand[9];

  const hex = [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15]
    .map(toHex)
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function uuidv4(): string {
  const r = randomBytes(16);
  r[6] = (r[6] & 0x0f) | 0x40;
  r[8] = (r[8] & 0x3f) | 0x80;
  const hex = Array.from(r, toHex).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
