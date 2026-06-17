// src/infra/memory/lead-memory.ts
import { query } from '../database/pool';
import { logger } from '../../components/shared/logger';
import { Lead, LeadState } from './lead-state';

const STRUCTURED_FIELDS: Array<keyof Lead | string> = [
  'etapa_funil',
  'status',
  'intencao',
  'score',
  'lead_score',
  'temperatura',
  'nivel_qualificacao',
  'interesse_principal',
  'motivo_recusa',
  'segmento_remarketing',
  'tentativas_remarketing',
  'convertido_via_remarketing',
  'data_conversao',
  'procedimento_interesse',
  'resumo_conversa',
  'agendado_em',
  'follow_up_count',
  'follow_up_proximo',
  'redirecionado_comercial',
  'nome'
];

const MAX_CONTEXTO = 12;

/**
 * Camada de memória de médio/longo prazo do lead, persistida em `leads`
 * (blob JSONB `data` + colunas estruturadas para consultas rápidas).
 */
export class LeadMemory {
  /**
   * Busca o lead no banco ou cria um novo estado padrão.
   */
  async getOrCreateLead(phone: string, name = 'Cliente'): Promise<Lead> {
    const base = LeadState.createNew(phone, name);

    let persistido: Partial<Lead> | null = null;
    try {
      const result = await query<{ data: Partial<Lead> }>(
        'SELECT data FROM leads WHERE lead_id = $1',
        [phone]
      );
      if (result.rows.length > 0) {
        persistido = result.rows[0].data;
      } else {
        await query(
          'INSERT INTO leads (lead_id, data, telefone, nome) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [phone, JSON.stringify(base), phone, name]
        );
      }
    } catch (e) {
      logger.warn(
        { erro: (e as Error).message },
        'lead-memory: getOrCreateLead falhou'
      );
    }

    const merged: Lead = {
      ...base,
      ...(persistido || {}),
      telefone: phone,
      lead_id: phone
    };

    if (name && name !== 'Cliente' && !merged.nome) {
      merged.nome = name;
    }

    return merged;
  }

  /**
   * Aplica updates ao lead: persiste o blob JSONB e as colunas estruturadas.
   */
  async updateLead(phone: string, updates: Partial<Lead>): Promise<Lead> {
    const lead = await this.getOrCreateLead(phone);
    const updated: Lead = {
      ...lead,
      ...updates,
      ultima_interacao: new Date().toISOString()
    };

    try {
      await query('UPDATE leads SET data = $1, atualizado_em = NOW() WHERE lead_id = $2', [
        JSON.stringify(updated),
        phone
      ]);

      const cols: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      for (const field of STRUCTURED_FIELDS) {
        if (field in updates) {
          cols.push(`${String(field)} = $${i++}`);
          vals.push((updates as Record<string, unknown>)[String(field)]);
        }
      }
      if (cols.length > 0) {
        vals.push(phone);
        await query(
          `UPDATE leads SET ${cols.join(', ')} WHERE lead_id = $${i}`,
          vals
        );
      }
    } catch (e) {
      logger.warn(
        { erro: (e as Error).message },
        'lead-memory: updateLead falhou'
      );
    }

    return updated;
  }

  /**
   * Anexa uma mensagem ao contexto de conversa do lead (janela de 12 turnos).
   */
  async saveContext(
    phone: string,
    message: string,
    isUser = true
  ): Promise<void> {
    const lead = await this.getOrCreateLead(phone);
    const contexto = lead.contexto_conversa || [];

    contexto.push({
      role: isUser ? 'user' : 'assistant',
      content: message.substring(0, 500),
      timestamp: new Date().toISOString()
    });

    while (contexto.length > MAX_CONTEXTO) {
      contexto.shift();
    }

    const updates: Partial<Lead> = {
      contexto_conversa: contexto,
      ultimo_mensagem: message.substring(0, 500)
    };

    if (isUser) {
      updates.total_mensagens_usuario =
        (lead.total_mensagens_usuario || 0) + 1;
    } else {
      updates.total_mensagens_assistente =
        (lead.total_mensagens_assistente || 0) + 1;
    }

    await this.updateLead(phone, updates);
  }
}

export const leadMemory = new LeadMemory();
