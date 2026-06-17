// src/components/3-busca-banco/searcher.ts
import { Pool } from 'pg';
import Redis from 'ioredis';
import { OpenAIClient } from '../../integrations/openai/client';
import {
  BuscaBancoInput,
  BuscaBancoOutput,
  RespostaEncontrada
} from './types';
import { MAPEAMENTO_INTENCAO_TIPO } from './constants';
import { QUERIES } from './queries';
import { GeradorEmbeddings } from './embeddings';
import { CacheBusca } from './cache';
import { ValidadorResultados } from './validators';
import { LIMITES_BUSCA } from './constants';

export class BuscadorBanco {
  private gerador: GeradorEmbeddings;
  private cache: CacheBusca;
  private validador: ValidadorResultados;

  constructor(
    private pool: Pool,
    private redis: Redis,
    private openaiClient: OpenAIClient
  ) {
    this.gerador = new GeradorEmbeddings(openaiClient);
    this.cache = new CacheBusca(redis);
    this.validador = new ValidadorResultados();
  }

  async buscar(input: BuscaBancoInput): Promise<BuscaBancoOutput> {
    const inicio = Date.now();

    // 1. Verifica cache
    const emCache = await this.cache.buscar(
      input.clienteId,
      input.intencao,
      input.objecao
    );

    if (emCache) {
      console.log(`[CACHE HIT] Busca encontrada no cache`);
      return emCache;
    }

    try {
      // 2. Busca por palavra-chave
      let respostas = await this.buscarPorPalavraChave(input);
      console.log(
        `[BUSCA] Encontradas ${respostas.length} respostas por palavra-chave`
      );

      // 3. Se poucos resultados, tenta busca semântica
      if (respostas.length < 3) {
        const respostasSemanticas = await this.buscarSemantica(input);
        respostas = [...respostas, ...respostasSemanticas];
        console.log(
          `[BUSCA] Adicionadas ${respostasSemanticas.length} respostas semânticas`
        );
      }

      // 4. Valida e ordena
      const respostasValidas = this.validador.filtrar(respostas);
      const respostasOrdenadas = this.ordenarPorScore(respostasValidas);

      const tempo = Date.now() - inicio;

      const resultado: BuscaBancoOutput = {
        respostas: respostasOrdenadas,
        totalEncontrado: respostasOrdenadas.length,
        tempoExecucao: tempo,
        origem: 'banco',
        timestamp: new Date()
      };

      // 5. Salva no cache
      await this.cache.salvar(
        input.clienteId,
        input.intencao,
        resultado,
        input.objecao
      );

      console.log(
        `[BUSCA] Concluída em ${tempo}ms. Encontradas ${respostasOrdenadas.length} respostas`
      );

      return resultado;
    } catch (erro) {
      console.error(`[ERRO BUSCA] ${(erro as Error).message}`);
      return {
        respostas: [],
        totalEncontrado: 0,
        tempoExecucao: Date.now() - inicio,
        origem: 'banco',
        timestamp: new Date()
      };
    }
  }

  private async buscarPorPalavraChave(
    input: BuscaBancoInput
  ): Promise<RespostaEncontrada[]> {
    const respostas: RespostaEncontrada[] = [];
    const tiposPermitidos = MAPEAMENTO_INTENCAO_TIPO[input.intencao] || [];

    // Busca em base de conhecimento
    if (tiposPermitidos.includes('base_conhecimento')) {
      const resultados = await this.pool.query<any>(
        QUERIES.BUSCA_BASE_CONHECIMENTO,
        [
          `%${input.contexto.tema}%`,
          input.clienteId,
          LIMITES_BUSCA.MAX_RESULTADOS
        ]
      );

      respostas.push(
        ...resultados.rows.map((row) => ({
          id: row.id,
          tipo: 'base_conhecimento' as const,
          conteudo: row.descricao,
          relevancia: row.relevancia,
          efetividade: 0.8,
          palavrasChave: [row.tema, ...row.beneficios],
          clienteId: row.cliente_id,
          criadoEm: row.criado_em,
          atualizadoEm: row.atualizado_em
        }))
      );
    }

    // Busca em objeções padrões
    if (tiposPermitidos.includes('objecao_padrao') && input.objecao) {
      const resultados = await this.pool.query<any>(QUERIES.BUSCA_OBJECOES_PADRAO, [
        `%${input.objecao}%`,
        LIMITES_BUSCA.MAX_RESULTADOS
      ]);

      respostas.push(
        ...resultados.rows.map((row) => ({
          id: row.id,
          tipo: 'objecao_padrao' as const,
          conteudo: row.resposta,
          relevancia: row.relevancia,
          efetividade: row.taxa_efetividade,
          palavrasChave: row.palavras_chave,
          clienteId: 'sistema',
          criadoEm: row.criado_em,
          atualizadoEm: row.atualizado_em
        }))
      );
    }

    // Busca em objeções personalizadas
    if (tiposPermitidos.includes('objecao_personalizada') && input.objecao) {
      const resultados = await this.pool.query<any>(
        QUERIES.BUSCA_OBJECOES_PERSONALIZADAS,
        [
          `%${input.objecao}%`,
          input.clienteId,
          LIMITES_BUSCA.MAX_RESULTADOS
        ]
      );

      respostas.push(
        ...resultados.rows.map((row) => ({
          id: row.id,
          tipo: 'objecao_personalizada' as const,
          conteudo: row.resposta,
          relevancia: row.relevancia,
          efetividade: row.taxa_efetividade,
          palavrasChave: row.palavras_chave,
          clienteId: row.cliente_id,
          criadoEm: row.criado_em,
          atualizadoEm: row.atualizado_em
        }))
      );
    }

    return respostas;
  }

  private async buscarSemantica(
    input: BuscaBancoInput
  ): Promise<RespostaEncontrada[]> {
    try {
      const textoParaBuscar = `${input.contexto.tema} ${input.objecao || ''}`;
      const embedding = await this.gerador.gerar(textoParaBuscar);

      const respostas: RespostaEncontrada[] = [];

      const resultadosBase = await this.pool.query<any>(
        QUERIES.BUSCA_SEMANTICA_BASE,
        [
          JSON.stringify(embedding),
          input.clienteId,
          0.6,
          LIMITES_BUSCA.MAX_RESULTADOS
        ]
      );

      respostas.push(
        ...resultadosBase.rows.map((row) => ({
          id: row.id,
          tipo: 'base_conhecimento' as const,
          conteudo: row.descricao,
          relevancia: row.relevancia,
          efetividade: 0.8,
          palavrasChave: [row.tema, ...row.beneficios],
          clienteId: row.cliente_id,
          criadoEm: row.criado_em,
          atualizadoEm: row.atualizado_em
        }))
      );

      const resultadosObjecoes = await this.pool.query<any>(
        QUERIES.BUSCA_SEMANTICA_OBJECOES,
        [
          JSON.stringify(embedding),
          input.clienteId,
          0.6,
          LIMITES_BUSCA.MAX_RESULTADOS
        ]
      );

      respostas.push(
        ...resultadosObjecoes.rows.map((row) => ({
          id: row.id,
          tipo: 'objecao_personalizada' as const,
          conteudo: row.resposta,
          relevancia: row.relevancia,
          efetividade: row.taxa_efetividade,
          palavrasChave: row.palavras_chave,
          clienteId: row.cliente_id,
          criadoEm: row.criado_em,
          atualizadoEm: row.atualizado_em
        }))
      );

      return respostas;
    } catch (erro) {
      console.error(`[ERRO BUSCA SEMÂNTICA] ${(erro as Error).message}`);
      return [];
    }
  }

  private ordenarPorScore(
    respostas: RespostaEncontrada[]
  ): RespostaEncontrada[] {
    return respostas.sort((a, b) => {
      const scoreA = this.validador.calcularScore(a);
      const scoreB = this.validador.calcularScore(b);
      return scoreB - scoreA;
    });
  }

  async registrarUso(
    clienteId: string,
    leadId: string,
    respostaId: string,
    tipoResposta: string,
    resultado: boolean
  ): Promise<void> {
    try {
      await this.pool.query(QUERIES.REGISTRA_USO_RESPOSTA, [
        clienteId,
        leadId,
        respostaId,
        tipoResposta,
        resultado
      ]);

      if (resultado && tipoResposta === 'objecao_personalizada') {
        await this.pool.query(QUERIES.ATUALIZA_EFETIVIDADE, [
          respostaId,
          clienteId
        ]);
      }
    } catch (erro) {
      console.error(`[ERRO REGISTRAR USO] ${(erro as Error).message}`);
    }
  }
}
