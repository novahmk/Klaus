// src/components/3-busca-banco/cache.ts
import Redis from 'ioredis';
import { BuscaBancoOutput } from './types';
import { CACHE_TTL } from './constants';

export class CacheBusca {
  constructor(private redis: Redis) {}

  private gerarChave(
    clienteId: string,
    intencao: string,
    objecao?: string
  ): string {
    const objecaoStr = objecao ? `:${objecao}` : '';
    return `busca:${clienteId}:${intencao}${objecaoStr}`;
  }

  async buscar(
    clienteId: string,
    intencao: string,
    objecao?: string
  ): Promise<BuscaBancoOutput | null> {
    const chave = this.gerarChave(clienteId, intencao, objecao);
    const resultado = await this.redis.get(chave);

    if (resultado) {
      const parsed = JSON.parse(resultado);
      return {
        ...parsed,
        origem: 'cache'
      };
    }

    return null;
  }

  async salvar(
    clienteId: string,
    intencao: string,
    resultado: BuscaBancoOutput,
    objecao?: string
  ): Promise<void> {
    const chave = this.gerarChave(clienteId, intencao, objecao);
    const ttl = objecao
      ? CACHE_TTL.BUSCA_PERSONALIZADA
      : CACHE_TTL.BUSCA_PADRAO;

    await this.redis.setex(chave, ttl, JSON.stringify(resultado));
  }

  async limpar(clienteId: string): Promise<void> {
    const pattern = `busca:${clienteId}:*`;
    const chaves = await this.redis.keys(pattern);

    if (chaves.length > 0) {
      await this.redis.del(...chaves);
    }
  }

  async invalidarPorIntencao(
    clienteId: string,
    intencao: string
  ): Promise<void> {
    const pattern = `busca:${clienteId}:${intencao}*`;
    const chaves = await this.redis.keys(pattern);

    if (chaves.length > 0) {
      await this.redis.del(...chaves);
    }
  }
}
