/**
 * Cache com Redis - Componente 2: Gerador de Perguntas
 * Klaus V2 - Componente 2
 */

import { createHash } from 'crypto';
import { GeradorPerguntasOutput } from './types';
import { CACHE_DEFAULT_TTL } from './constants';
import { logger } from '../../shared/logger';

export interface CacheConfig {
  redisUrl?: string;
  ttl?: number;
}

export class GerenciadorCachePergunta {
  private redisClient: any;
  private ttl: number;
  private disponivel: boolean = false;

  constructor(config?: CacheConfig) {
    this.ttl = config?.ttl || CACHE_DEFAULT_TTL;

    if (config?.redisUrl) {
      this.inicializarRedis(config.redisUrl);
    }
  }

  /**
   * Inicializa conexão com Redis
   */
  private inicializarRedis(url: string): void {
    try {
      const redis = require('redis');

      this.redisClient = redis.createClient({
        url,
        socket: {
          reconnectStrategy: (retries: number) => Math.min(retries * 50, 500)
        }
      });

      this.redisClient.on('error', (err: Error) => {
        logger.warn({ erro: err.message }, 'Erro ao conectar Redis - cache desativado');
        this.disponivel = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Cache Redis conectado com sucesso');
        this.disponivel = true;
      });

      this.redisClient.connect().catch((err: Error) => {
        logger.warn({ erro: err.message }, 'Falha ao conectar Redis');
        this.disponivel = false;
      });
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Redis não disponível - usando fallback');
      this.disponivel = false;
    }
  }

  /**
   * Gera chave de cache para uma pergunta
   */
  private gerarChave(tema: string, camada: 1 | 2 | 3, clienteId: string): string {
    const hash = createHash('sha256');
    hash.update(`pergunta:${tema.toLowerCase().trim()}:${camada}:${clienteId}`);
    return `pergunta:${hash.digest('hex')}`;
  }

  /**
   * Obtém pergunta do cache
   */
  async obter(tema: string, camada: 1 | 2 | 3, clienteId: string): Promise<GeradorPerguntasOutput | null> {
    if (!this.disponivel || !this.redisClient) {
      return null;
    }

    try {
      const chave = this.gerarChave(tema, camada, clienteId);
      const resultado = await this.redisClient.get(chave);

      if (resultado) {
        logger.debug({ chave }, 'Cache hit para pergunta');
        const dados = JSON.parse(resultado);

        if (dados.timestamp && typeof dados.timestamp === 'string') {
          dados.timestamp = new Date(dados.timestamp);
        }

        return dados as GeradorPerguntasOutput;
      }

      logger.debug({ chave }, 'Cache miss para pergunta');
      return null;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro ao obter do cache');
      return null;
    }
  }

  /**
   * Armazena pergunta no cache
   */
  async armazenar(
    tema: string,
    camada: 1 | 2 | 3,
    clienteId: string,
    resultado: GeradorPerguntasOutput
  ): Promise<boolean> {
    if (!this.disponivel || !this.redisClient) {
      return false;
    }

    try {
      const chave = this.gerarChave(tema, camada, clienteId);

      const dadosCache = {
        ...resultado,
        timestamp: resultado.timestamp.toISOString()
      };

      await this.redisClient.setEx(chave, this.ttl, JSON.stringify(dadosCache));

      logger.debug({ chave, ttl: this.ttl }, 'Pergunta armazenada no cache');
      return true;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro ao armazenar no cache');
      return false;
    }
  }

  /**
   * Obtém múltiplas perguntas do cache por tema
   */
  async obterPorTema(tema: string, clienteId: string): Promise<GeradorPerguntasOutput[] | null> {
    if (!this.disponivel || !this.redisClient) {
      return null;
    }

    try {
      const perguntas: GeradorPerguntasOutput[] = [];

      for (const camada of [1, 2, 3]) {
        const pergunta = await this.obter(tema, camada as 1 | 2 | 3, clienteId);
        if (pergunta) {
          perguntas.push(pergunta);
        }
      }

      return perguntas.length > 0 ? perguntas : null;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro ao obter perguntas por tema');
      return null;
    }
  }

  /**
   * Limpa cache de uma chave específica
   */
  async limparChave(tema: string, camada: 1 | 2 | 3, clienteId: string): Promise<boolean> {
    if (!this.disponivel || !this.redisClient) {
      return false;
    }

    try {
      const chave = this.gerarChave(tema, camada, clienteId);
      await this.redisClient.del(chave);
      logger.debug({ chave }, 'Chave de cache removida');
      return true;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro ao limpar cache');
      return false;
    }
  }

  /**
   * Limpa todo o cache
   */
  async limparTudo(): Promise<boolean> {
    if (!this.disponivel || !this.redisClient) {
      return false;
    }

    try {
      await this.redisClient.flushDb();
      logger.info('Cache Redis limpo completamente');
      return true;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro ao limpar cache completo');
      return false;
    }
  }

  /**
   * Verifica disponibilidade do cache
   */
  ehDisponivel(): boolean {
    return this.disponivel;
  }

  /**
   * Fecha conexão com Redis
   */
  async fechar(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        logger.info('Conexão Redis fechada');
      } catch (erro) {
        logger.warn({ erro: String(erro) }, 'Erro ao fechar Redis');
      }
    }
  }
}
