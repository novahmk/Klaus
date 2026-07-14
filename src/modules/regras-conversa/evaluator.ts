/**
 * Sprint 8: Avaliador seguro de condições de regras de conversa.
 *
 * SEGURANÇA: esta função NUNCA executa código arbitrário (sem `eval`,
 * sem `new Function`, sem interpolação de string em JS). Ela apenas
 * compara valores de um whitelist fixo de campos (`CampoCondicao`) usando
 * um whitelist fixo de operadores (`OperadorCondicao`). Qualquer condição
 * com campo/operador fora do whitelist é tratada como "não corresponde"
 * (retorna false), nunca lança exceção nem executa a condição.
 */

import { logger } from '../../components/shared/logger';
import {
  CampoCondicao,
  CondicaoRegra,
  ContextoAvaliacaoRegra,
  OperadorCondicao
} from './types';

const CAMPOS_VALIDOS: readonly CampoCondicao[] = [
  'score',
  'estagio',
  'tentativas'
];

const OPERADORES_VALIDOS: readonly OperadorCondicao[] = [
  '>',
  '>=',
  '<',
  '<=',
  '==',
  '!='
];

function comparar(
  valorContexto: number | string,
  operador: OperadorCondicao,
  valorCondicao: number | string
): boolean {
  switch (operador) {
    case '>':
      return valorContexto > valorCondicao;
    case '>=':
      return valorContexto >= valorCondicao;
    case '<':
      return valorContexto < valorCondicao;
    case '<=':
      return valorContexto <= valorCondicao;
    case '==':
      return valorContexto === valorCondicao;
    case '!=':
      return valorContexto !== valorCondicao;
    default:
      return false;
  }
}

/**
 * Avalia uma condição estruturada contra o contexto do lead/conversa.
 * Retorna `false` (nunca lança) para qualquer entrada inválida ou
 * fora do whitelist de campos/operadores.
 */
export function avaliarCondicao(
  condicao: CondicaoRegra,
  contexto: ContextoAvaliacaoRegra
): boolean {
  if (!condicao || typeof condicao !== 'object') return false;

  const { campo, operador, valor } = condicao;

  if (!CAMPOS_VALIDOS.includes(campo)) {
    logger.warn({ campo }, 'RegrasConversa: campo de condição fora do whitelist');
    return false;
  }

  if (!OPERADORES_VALIDOS.includes(operador)) {
    logger.warn(
      { operador },
      'RegrasConversa: operador de condição fora do whitelist'
    );
    return false;
  }

  const valorContexto = contexto[campo];

  try {
    return comparar(valorContexto, operador, valor);
  } catch (erro) {
    logger.warn(
      { campo, operador, erro: (erro as Error).message },
      'RegrasConversa: falha ao comparar condição'
    );
    return false;
  }
}
