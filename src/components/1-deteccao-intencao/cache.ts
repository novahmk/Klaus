/**
 * Sistema de cache com Redis
 * Klaus V2 - Componente 1
 */

import { createHash } from 'crypto';
import { DeteccaoIntencaoResult } from './types';
import { CACHE_DEFAULT_TTL } from './constants';
import { logger } from '../../shared/logger';

export interface CacheConfig {
  redisUrl?: string;
  ttl?: number;
}

export class GerenciadorCache {
  private redisClient: any;
  private ttl: number;
  private disponivel: boolean = false;

  constructor(config?: CacheConfig) {
    this.ttl = config?.ttl || CACHE_DEFAULT_TTL;
    
    // Inicializar cliente Redis apenas se URL fornecida
    if (config?.redisUrl) {
      this.inicializarRedis(config.redisUrl);
    }
  }

  /**
   * Inicializa conexão com Redis
   */
  private inicializarRedis(url: string): void {
    try {
      // Lazy load de Redis
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
   * Gera chave de cache para uma mensagem
   */
  private gerarChave(mensagem: string, contexto?: Record<string, unknown>): string {
    const hash = createHash('sha256');
    hash.update(mensagem.toLowerCase().trim());
    
    if (contexto) {
      hash.update(JSON.stringify(contexto));
    }

    return `intencao:${hash.digest('hex')}`;
  }

  /**
   * Obtém resultado do cache
   */
  async obter(mensagem: string, contexto?: Record<string, unknown>): Promise<DeteccaoIntencaoResult | null> {
    if (!this.disponivel || !this.redisClient) {
      return null;
    }

    try {
      const chave = this.gerarChave(mensagem, contexto);
      const resultado = await this.redisClient.get(chave);

      if (resultado) {
        logger.debug({ chave }, 'Cache hit para detecção de intenção');
        const dados = JSON.parse(resultado);
        
        // Converter timestamp de volta para Date
        if (dados.timestamp && typeof dados.timestamp === 'string') {
          dados.timestamp = new Date(dados.timestamp);
        }
        
        return dados as DeteccaoIntencaoResult;
      }

      logger.debug({ chave }, 'Cache miss para detecção de intenção');
      return null;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro ao obter do cache');
      return null;
    }
  }

  /**
   * Armazena resultado no cache
   */
  async armazenar(
    mensagem: string,
    resultado: DeteccaoIntencaoResult,
    contexto?: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.disponivel || !this.redisClient) {
      return false;
    }

    try {
      const chave = this.gerarChave(mensagem, contexto);
      
      // Converter Date para string para JSON
      const dadosCache = {
        ...resultado,
        timestamp: resultado.timestamp.toISOString()
      };

      await this.redisClient.setEx(
        chave,
        this.ttl,
        JSON.stringify(dadosCache)
      );

      logger.debug({ chave, ttl: this.ttl }, 'Resultado armazenado no cache');
      return true;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro ao armazenar no cache');
      return false;
    }
  }

  /**
   * Limpa cache de uma chave específica
   */
  async limparChave(mensagem: string, contexto?: Record<string, unknown>): Promise<boolean> {
    if (!this.disponivel || !this.redisClient) {
      return false;
    }

    try {
      const chave = this.gerarChave(mensagem, contexto);
      await this.redisClient.del(chave);
      logger.debug({ chave }, 'Chave de cache removida');
      return true;
    } catch (erro) {
      logger.warn({ erro: String(erro) }, 'Erro ao limpar cache');
      return false;
    }
  }

  /**
   * Limpa todo o cache (com cuidado!)
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
