// src/integrations/wasender/rate-limit.ts

const rateLimitsPorTelefone: Record<string, number[]> = {};
const rateLimitsPorIp: Record<string, number[]> = {};

/** Máximo de mensagens por telefone em 60 segundos */
const MAX_MSG_POR_TELEFONE = 10;
/** Máximo de requisições por IP em 60 segundos */
const MAX_REQ_POR_IP = 100;

export function checarRateLimitTelefone(phone: string): boolean {
  const now = Date.now();
  if (!rateLimitsPorTelefone[phone]) rateLimitsPorTelefone[phone] = [];
  rateLimitsPorTelefone[phone] = rateLimitsPorTelefone[phone].filter(
    (t) => now - t < 60000
  );
  if (rateLimitsPorTelefone[phone].length >= MAX_MSG_POR_TELEFONE) return false;
  rateLimitsPorTelefone[phone].push(now);
  return true;
}

export function checarRateLimitIp(ip: string): boolean {
  const now = Date.now();
  if (!rateLimitsPorIp[ip]) rateLimitsPorIp[ip] = [];
  rateLimitsPorIp[ip] = rateLimitsPorIp[ip].filter((t) => now - t < 60000);
  if (rateLimitsPorIp[ip].length >= MAX_REQ_POR_IP) return false;
  rateLimitsPorIp[ip].push(now);
  return true;
}
