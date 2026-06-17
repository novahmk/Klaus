// src/components/7-orquestracao/state-machine.ts
import { EstadoConversa } from './types';

export class StateMachine {
  private transicoesValidas: Record<EstadoConversa, EstadoConversa[]> = {
    [EstadoConversa.INICIAL]: [
      EstadoConversa.ANALISANDO_INTENCAO,
      EstadoConversa.ERRO
    ],
    [EstadoConversa.ANALISANDO_INTENCAO]: [
      EstadoConversa.BUSCANDO_CONHECIMENTO,
      EstadoConversa.GERANDO_RESPOSTA,
      EstadoConversa.ERRO
    ],
    [EstadoConversa.BUSCANDO_CONHECIMENTO]: [
      EstadoConversa.GERANDO_RESPOSTA,
      EstadoConversa.ERRO
    ],
    [EstadoConversa.GERANDO_RESPOSTA]: [
      EstadoConversa.QUALIFICANDO_LEAD,
      EstadoConversa.ERRO
    ],
    [EstadoConversa.QUALIFICANDO_LEAD]: [
      EstadoConversa.AGUARDANDO_LEAD,
      EstadoConversa.FINALIZADO,
      EstadoConversa.ERRO
    ],
    [EstadoConversa.AGUARDANDO_LEAD]: [
      EstadoConversa.ANALISANDO_INTENCAO,
      EstadoConversa.FINALIZADO,
      EstadoConversa.ERRO
    ],
    [EstadoConversa.FINALIZADO]: [EstadoConversa.INICIAL],
    [EstadoConversa.ERRO]: [
      EstadoConversa.INICIAL,
      EstadoConversa.AGUARDANDO_LEAD
    ]
  };

  validarTransicao(atual: EstadoConversa, proximo: EstadoConversa): boolean {
    return this.transicoesValidas[atual].includes(proximo);
  }
}
