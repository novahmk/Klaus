/**
 * Gerador de Perguntas - Componente Principal
 * Klaus V2 - Componente 2
 */

import {
  GeradorPerguntasInput,
  GeradorPerguntasOutput,
  GeradorConfig,
  TemplatoPergunta,
  CamadaPergunta
} from './types';
import {
  TEMPLATES_PERGUNTAS,
  determinarCamada,
  CACHE_DEFAULT_TTL,
  GPT_MODEL,
  GPT_TEMPERATURE,
  GPT_MAX_TOKENS
} from './constants';
import { ValidadorPergunta } from './validators';
import { GerenciadorCachePergunta } from './cache';
import {
  gerarPromptSistema,
  gerarPromptUsuario,
  gerarTemplateAlternativo
} from './prompts';
import { logger } from '../shared/logger';

export class GeradorPerguntas {
  private cache: GerenciadorCachePergunta;
  private openaiClient: any;
  private config: GeradorConfig;

  constructor(config: GeradorConfig = {}) {
    this.config = {
      enableCache: config.enableCache !== false,
      enableFallback: config.enableFallback !== false,
      enableGpt: config.enableGpt !== false,
      maxSimilaridade: config.maxSimilaridade || 0.7,
      ...config
    };

    // Inicializar cache
    this.cache = new GerenciadorCachePergunta({
      redisUrl: config.redisUrl,
      ttl: config.cacheExpireSec || CACHE_DEFAULT_TTL
    });

    // Inicializar OpenAI (lazy load)
    if (this.config.enableGpt && config.openaiApiKey) {
      try {
        const OpenAI = require('openai');
        this.openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
        logger.info('OpenAI cliente inicializado');
      } catch (erro) {
        logger.warn({ erro: String(erro) }, 'OpenAI não disponível - usando fallback');
        this.config.enableGpt = false;
      }
    }
  }

  /**
   * Gera uma pergunta adaptativa
   */
  async gerar(input: GeradorPerguntasInput): Promise<GeradorPerguntasOutput> {
    const inicioTempo = Date.now();

    try {
      // Validar entrada
      const validacao = ValidadorPergunta.validarEntrada(
        input.tema,
        input.historico,
        input.perguntasJaFeitas
      );

      if (!validacao.valido) {
        logger.error({ erro: validacao.erro }, 'Entrada inválida no gerador');

        return {
          pergunta: 'Desculpe, não consegui gerar uma pergunta adequada.',
          contextoEsperado: 'Sistema retornou erro',
          camada: 1,
          timestamp: new Date(),
          origem: 'template'
        };
      }

      // Determinar camada
      const numeroPerguntasFeitas = input.perguntasJaFeitas?.length || 0;
      const camada = determinarCamada(numeroPerguntasFeitas);

      logger.debug(
        { camada, numeroPerguntasFeitas },
        'Camada determinada para pergunta'
      );

      // 1. Verificar cache
      if (this.config.enableCache) {
        const resultadoCache = await this.cache.obter(
          input.tema,
          camada,
          input.clienteId
        );

        if (resultadoCache) {
          logger.info(
            { tempo: Date.now() - inicioTempo, origem: 'cache' },
            'Pergunta gerada via cache'
          );

          return resultadoCache;
        }
      }

      // 2. Tentar GPT
      if (this.config.enableGpt && this.openaiClient) {
        const resultadoGpt = await this.gerarComGpt(input, camada);

        if (resultadoGpt) {
          // Armazenar no cache
          if (this.config.enableCache) {
            await this.cache.armazenar(input.tema, camada, input.clienteId, resultadoGpt);
          }

          logger.info(
            { tempo: Date.now() - inicioTempo, origem: 'gpt' },
            'Pergunta gerada via GPT'
          );

          return resultadoGpt;
        }
      }

      // 3. Usar fallback por template
      if (this.config.enableFallback) {
        const resultadoTemplate = await this.gerarComTemplate(input, camada);

        if (resultadoTemplate) {
          // Armazenar no cache
          if (this.config.enableCache) {
            await this.cache.armazenar(input.tema, camada, input.clienteId, resultadoTemplate);
          }

          logger.info(
            { tempo: Date.now() - inicioTempo, origem: 'template' },
            'Pergunta gerada via template'
          );

          return resultadoTemplate;
        }
      }

      // 4. Último recurso: pergunta genérica
      const resultadoGenerico: GeradorPerguntasOutput = {
        pergunta: 'Como posso ajudá-lo melhor?',
        contextoEsperado: 'Lead responde com necessidade genérica',
        camada,
        timestamp: new Date(),
        origem: 'template'
      };

      logger.warn(
        { tempo: Date.now() - inicioTempo },
        'Nenhum método conseguiu gerar pergunta, retornando genérica'
      );

      return resultadoGenerico;
    } catch (erro) {
      logger.error(
        { erro: String(erro), tempo: Date.now() - inicioTempo },
        'Erro ao gerar pergunta'
      );

      return {
        pergunta: 'Como posso ajudá-lo?',
        contextoEsperado: 'Sistema retornou erro',
        camada: 1,
        timestamp: new Date(),
        origem: 'template'
      };
    }
  }

  /**
   * Gera pergunta usando GPT
   */
  private async gerarComGpt(
    input: GeradorPerguntasInput,
    camada: 1 | 2 | 3
  ): Promise<GeradorPerguntasOutput | null> {
    try {
      const promptSistema = gerarPromptSistema();
      // Garantir que tema nunca é vazio
      const inputComTema = {
        ...input,
        tema: input.tema || 'Geral'
      };
      const promptUsuario = gerarPromptUsuario(inputComTema, camada);

      logger.debug('Enviando requisição para GPT');

      const resposta = await this.openaiClient.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: promptUsuario }
        ],
        temperature: GPT_TEMPERATURE,
        max_tokens: GPT_MAX_TOKENS
      });

      const conteudoResposta = resposta.choices[0]?.message?.content;

      if (!conteudoResposta) {
        logger.warn('GPT retornou resposta vazia');
        return null;
      }

      // Parsear resposta JSON
      const validacao = this.parseRespostaGpt(conteudoResposta as string);

      if (!validacao.valido) {
        logger.warn({ erro: validacao.erro }, 'Resposta GPT inválida');
        return null;
      }

      // Validar pergunta completa
      const validacaoPergunta = ValidadorPergunta.validarCompleto(
        validacao.pergunta || '',
        input.perguntasJaFeitas || []
      );

      if (!validacaoPergunta.valido) {
        logger.warn(
          { erros: validacaoPergunta.erros },
          'Pergunta GPT falhou na validação'
        );
        return null;
      }

      const resultado: GeradorPerguntasOutput = {
        pergunta: validacao.pergunta || '',
        contextoEsperado: validacao.contextoEsperado || '',
        camada,
        timestamp: new Date(),
        origem: 'gpt'
      };

      // Validar resultado final
      if (!ValidadorPergunta.validarResultado(resultado)) {
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
   * Gera pergunta usando template
   */
  private async gerarComTemplate(
    input: GeradorPerguntasInput,
    camada: 1 | 2 | 3
  ): Promise<GeradorPerguntasOutput | null> {
    try {
      // 1. Tentar templates específicos por intenção
      const templateEspecifico = this.selecionarTemplateEspecifico(
        input,
        camada
      );

      if (templateEspecifico) {
        // Validar se não é muito similar
        const validacao = ValidadorPergunta.validarCompleto(
          templateEspecifico.pergunta,
          input.perguntasJaFeitas || []
        );

        if (validacao.valido) {
          return {
            pergunta: templateEspecifico.pergunta,
            contextoEsperado: templateEspecifico.contextoEsperado,
            camada,
            timestamp: new Date(),
            origem: 'template'
          };
        }
      }

      // 2. Tentar templates genéricos da camada
      const templates = TEMPLATES_PERGUNTAS.filter(t => t.camada === camada);

      for (const template of templates) {
        const validacao = ValidadorPergunta.validarCompleto(
          template.pergunta,
          input.perguntasJaFeitas || []
        );

        if (validacao.valido) {
          return {
            pergunta: template.pergunta,
            contextoEsperado: template.contextoEsperado,
            camada,
            timestamp: new Date(),
            origem: 'template'
          };
        }
      }

      // 3. Último recurso: gerar alternativo por intenção
      const perguntaAlternativa = gerarTemplateAlternativo(input, camada);

      if (perguntaAlternativa) {
        const validacao = ValidadorPergunta.validarCompleto(
          perguntaAlternativa,
          input.perguntasJaFeitas || []
        );

        if (validacao.valido) {
          return {
            pergunta: perguntaAlternativa,
            contextoEsperado: `Resposta sobre ${input.tema} na camada ${camada}`,
            camada,
            timestamp: new Date(),
            origem: 'template'
          };
        }
      }

      return null;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro no fallback de template');
      return null;
    }
  }

  /**
   * Seleciona template específico por intenção
   */
  private selecionarTemplateEspecifico(
    input: GeradorPerguntasInput,
    camada: 1 | 2 | 3
  ): TemplatoPergunta | null {
    const templates = TEMPLATES_PERGUNTAS.filter(
      t =>
        t.camada === camada &&
        (!t.intencoes || t.intencoes.includes(input.intencao))
    );

    if (templates.length === 0) {
      return null;
    }

    // Selecionar aleatoriamente para variedade
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Parseia resposta JSON do GPT
   */
  private parseRespostaGpt(resposta: string): {
    valido: boolean;
    pergunta?: string;
    contextoEsperado?: string;
    erro?: string;
  } {
    try {
      const jsonMatch = resposta.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { valido: false, erro: 'Nenhum JSON encontrado' };
      }

      const dados = JSON.parse(jsonMatch[0]);

      if (!dados.pergunta || !dados.contextoEsperado) {
        return { valido: false, erro: 'Campos obrigatórios ausentes' };
      }

      return {
        valido: true,
        pergunta: String(dados.pergunta).substring(0, 150),
        contextoEsperado: String(dados.contextoEsperado).substring(0, 200)
      };
    } catch (erro) {
      return {
        valido: false,
        erro: `Erro ao parsear JSON: ${erro instanceof Error ? erro.message : String(erro)}`
      };
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
    logger.info('Gerador de perguntas fechado');
  }
}

// Exportar para uso direto
export {
  GeradorPerguntasInput,
  GeradorPerguntasOutput,
  GeradorConfig,
  CamadaPergunta
} from './types';
