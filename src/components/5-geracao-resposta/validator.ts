// src/components/5-geracao-resposta/validator.ts
import { GeracaoInput } from './types';

export class ValidadorResposta {
  static validar(resposta: string, _input?: GeracaoInput): number {
    let score = 100;

    if (resposta.length < 150) score -= 30;
    if (!resposta.includes('?')) score -= 10; // Falta de CTA
    if (resposta.toLowerCase().includes('infelizmente')) score -= 20; // Tom negativo

    return Math.max(score, 0);
  }
}
