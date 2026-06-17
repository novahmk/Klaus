// src/components/3-busca-banco/validators.ts
import { RespostaEncontrada } from './types';
import { LIMITES_BUSCA } from './constants';

export class ValidadorResultados {
  validar(resposta: RespostaEncontrada): boolean {
    if (resposta.relevancia < LIMITES_BUSCA.MIN_RELEVANCIA) {
      return false;
    }

    if (resposta.efetividade < LIMITES_BUSCA.MIN_EFETIVIDADE) {
      return false;
    }

    if (!resposta.conteudo || resposta.conteudo.trim().length === 0) {
      return false;
    }

    return true;
  }

  filtrar(respostas: RespostaEncontrada[]): RespostaEncontrada[] {
    return respostas
      .filter((r) => this.validar(r))
      .slice(0, LIMITES_BUSCA.MAX_RESULTADOS);
  }

  temResultadosSuficientes(respostas: RespostaEncontrada[]): boolean {
    return respostas.length > 0;
  }

  calcularScore(resposta: RespostaEncontrada): number {
    return resposta.relevancia * 0.5 + resposta.efetividade * 0.5;
  }
}
