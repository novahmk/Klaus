/**
 * Detector de Intenção - Componente Principal
 * Klaus V2 - Componente 1
 */

import { DeteccaoIntencaoResult, DetectorInput, Intencao, DetectorConfig } from './types';
import { AnalisadorFallback } from './fallback';
import { GerenciadorCache } from './cache';
import { ValidadorIntencao } from './validator';
import { gerarPromptSistema, gerarPromptUsuario } from './prompts';
import { CONFIDENCE_MULTIPLIERS } from './constants';
import { logger } from '../../shared/logger';
import { OpenAIClient } from '../../integrations/openai';

export class DetectorIntencao {
  private cache: GerenciadorCache;
  private openaiClient: OpenAIClient | null = null;
  private config: DetectorConfig;

  constructor(config: DetectorConfig = {}) {
    this.config = {
      enableCache: config.enableCache !== false,
      enableFallback: config.enableFallback !== false,
      enableGpt: config.enableGpt !== false,
      ...config
    };

    // Inicializar cache
    this.cache = new GerenciadorCache({
      redisUrl: config.redisUrl,
      ttl: config.cacheExpireSec
    });

    // Inicializar OpenAI (lazy load)
    if (this.config.enableGpt && config.openaiApiKey) {
      try {
        this.openaiClient = new OpenAIClient(config.openaiApiKey);
        logger.info('OpenAI cliente inicializado');
      } catch (erro) {
        logger.warn({ erro: String(erro) }, 'OpenAI não disponível - usando fallback');
        this.config.enableGpt = false;
      }
    }
  }

  /**
   * Detecta intenção de uma mensagem
   */
  async detectar(input: DetectorInput): Promise<DeteccaoIntencaoResult> {
    const inicioTempo = Date.now();

    try {
      // Validar entrada
      const validacao = ValidadorIntencao.validarEntrada(
        input.mensagem,
        input.historico,
        input.contexto
      );

      if (!validacao.valido) {
        logger.error({ erro: validacao.erro }, 'Entrada inválida no detector');
        
        return {
          intencao: Intencao.NAO_RESPONDEU,
          confianca: 0,
          motivo: validacao.erro || 'Entrada inválida',
          timestamp: new Date(),
          origem: 'fallback'
        };
      }

      // 1. Verificar cache
      if (this.config.enableCache) {
        const resultadoCache = await this.cache.obter(
          input.mensagem,
          input.contexto
        );

        if (resultadoCache) {
          logger.info(
            { tempo: Date.now() - inicioTempo, origem: 'cache' },
            'Intenção detectada via cache'
          );
          
          return resultadoCache;
        }
      }

      // 2. Tentar GPT
      if (this.config.enableGpt && this.openaiClient) {
        const resultadoGpt = await this.detectarComGpt(input);
        
        if (resultadoGpt && resultadoGpt.confianca >= 70) {
          // Armazenar no cache se confiança aceitável
          if (this.config.enableCache) {
            await this.cache.armazenar(input.mensagem, resultadoGpt, input.contexto);
          }

          logger.info(
            { tempo: Date.now() - inicioTempo, origem: 'gpt', confianca: resultadoGpt.confianca },
            'Intenção detectada via GPT'
          );
          
          return resultadoGpt;
        }
      }

      // 3. Usar fallback por palavras-chave
      if (this.config.enableFallback) {
        const resultadoFallback = this.detectarComFallback(input);

        if (resultadoFallback) {
          // Armazenar no cache
          if (this.config.enableCache) {
            await this.cache.armazenar(input.mensagem, resultadoFallback, input.contexto);
          }

          logger.info(
            { tempo: Date.now() - inicioTempo, origem: 'fallback', confianca: resultadoFallback.confianca },
            'Intenção detectada via fallback'
          );
          
          return resultadoFallback;
        }
      }

      // 4. Último recurso: NAO_RESPONDEU
      const resultadoFinal: DeteccaoIntencaoResult = {
        intencao: Intencao.NAO_RESPONDEU,
        confianca: 30,
        motivo: 'Não foi possível detectar intenção com confiança',
        timestamp: new Date(),
        origem: 'fallback'
      };

      logger.warn(
        { tempo: Date.now() - inicioTempo },
        'Nenhum método conseguiu detectar intenção, retornando NAO_RESPONDEU'
      );

      return resultadoFinal;
    } catch (erro) {
      logger.error(
        { erro: String(erro), tempo: Date.now() - inicioTempo },
        'Erro ao detectar intenção'
      );

      return {
        intencao: Intencao.NAO_RESPONDEU,
        confianca: 0,
        motivo: `Erro no detector: ${erro instanceof Error ? erro.message : String(erro)}`,
        timestamp: new Date(),
        origem: 'fallback'
      };
    }
  }

  /**
   * Detecta intenção usando GPT
   */
  private async detectarComGpt(input: DetectorInput): Promise<DeteccaoIntencaoResult | null> {
    try {
      if (!this.openaiClient) return null;

      const promptSistema = gerarPromptSistema();
      const promptUsuario = gerarPromptUsuario(
        input.mensagem,
        input.historico?.map(m => ({
          papel: m.papel,
          conteudo: m.conteudo
        })),
        input.contexto
      );

      logger.debug('Enviando requisição para GPT');

      const conteudoResposta = await this.openaiClient.chat({
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: promptUsuario }
        ],
        temperature: 0.3,
        maxTokens: 500
      });

      if (!conteudoResposta) {
        logger.warn('GPT retornou resposta vazia');
        return null;
      }

      // Validar resposta
      const validacao = ValidadorIntencao.validarRespostaGpt(conteudoResposta);

      if (!validacao.valido) {
        logger.warn({ erro: validacao.erro }, 'Resposta GPT inválida');
        return null;
      }

      const confianca = ValidadorIntencao.normalizarConfianca(
        (validacao.dados?.confianca as number) * CONFIDENCE_MULTIPLIERS.gpt
      );

      const resultado: DeteccaoIntencaoResult = {
        intencao: validacao.dados?.intencao as Intencao,
        confianca,
        motivo: validacao.dados?.motivo as string,
        timestamp: new Date(),
        origem: 'gpt'
      };

      // Validar resultado final
      if (!ValidadorIntencao.validarResultado(resultado)) {
        logger.warn('Resultado final após GPT não passou na validação');
        return null;
      }

      return resultado;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro ao chamar GPT');
      return null;
    }
  }

  /**
   * Detecta intenção usando fallback por palavras-chave
   */
  private detectarComFallback(input: DetectorInput): DeteccaoIntencaoResult | null {
    try {
      const resultadoFallback = AnalisadorFallback.analisar(
        input.mensagem,
        input.historico
      );

      if (!resultadoFallback) {
        return null;
      }

      const confianca = ValidadorIntencao.normalizarConfianca(
        resultadoFallback.confianca * CONFIDENCE_MULTIPLIERS.fallback
      );

      const resultado: DeteccaoIntencaoResult = {
        intencao: resultadoFallback.intencao,
        confianca,
        motivo: resultadoFallback.motivo,
        timestamp: new Date(),
        origem: 'fallback'
      };

      // Validar resultado
      if (!ValidadorIntencao.validarResultado(resultado)) {
        logger.warn('Resultado do fallback não passou na validação');
        return null;
      }

      return resultado;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro no fallback');
      return null;
    }
  }

  /**
   * Limpa cache
   */
  async limparCache(): Promise<void> {
    if (this.config.enableCache) {
      await this.cache.limparTudo();
      logger.info('Cache limpo');
    }
  }

  /**
   * Fecha recursos
   */
  async fechar(): Promise<void> {
    await this.cache.fechar();
    logger.info('Detector de intenção fechado');
  }
}

// Exportar para uso direto
export { Intencao, DeteccaoIntencaoResult, DetectorInput, DetectorConfig } from './types';
