/**
 * Módulo ia-config — API pública
 * Klaus V2
 *
 * Exporta funções e tipos para consumo pelos componentes de IA.
 *
 * Uso básico:
 *   import { obterConfigIA } from '../../modules/ia-config';
 *   const config = await obterConfigIA(clienteId);
 *   // config.parametros.temperature, config.parametros.max_tokens, etc.
 */

export { obterConfigIA, invalidarCacheConfigIA, limparCacheConfigIA, loadConfigFromSupabase } from './loader';
export { buildDefaultConfigIA, DEFAULT_PARAMETROS, DEFAULT_VALIDACAO, DEFAULT_TOM_VOZ, DEFAULT_REGRAS, DEFAULT_DISPAROS, DEFAULT_APRENDIZADO } from './defaults';
export type {
  ConfigIA,
  CfgIaParametros,
  CfgIaValidacao,
  CfgIaTomVoz,
  CfgIaRegras,
  CfgIaDisparos,
  CfgIaAprendizado
} from './types';
