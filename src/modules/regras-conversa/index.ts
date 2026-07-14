// src/modules/regras-conversa/index.ts
export * from './types';
export { avaliarCondicao } from './evaluator';
export {
  obterRegrasConversa,
  avaliarRegrasContra,
  avaliarRegras
} from './service';
