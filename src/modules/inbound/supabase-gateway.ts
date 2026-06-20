import { logger } from '../../components/shared/logger';
import { getSupabaseServiceClient } from '../../lib/supabase';

function isSupabaseEnabled(): boolean {
  return process.env.SUPABASE_ENABLED === 'true';
}

export async function isControleManualAtivo(
  leadId: string
): Promise<boolean> {
  if (!isSupabaseEnabled() || process.env.CONTROL_MANUAL_ENABLED !== 'true') {
    return false;
  }

  const client = getSupabaseServiceClient();
  if (!client) return false;

  try {
    const dashboardQuery = await client
      .from('leads_dashboard')
      .select('controle_manual')
      .eq('lead_id', leadId)
      .single();

    if (!dashboardQuery.error && dashboardQuery.data) {
      return Boolean(dashboardQuery.data.controle_manual);
    }

    const leadsQuery = await client
      .from('leads')
      .select('controle_manual')
      .eq('lead_id', leadId)
      .single();

    if (!leadsQuery.error && leadsQuery.data) {
      return Boolean((leadsQuery.data as { controle_manual?: boolean }).controle_manual);
    }

    return false;
  } catch (err) {
    logger.warn(
      { leadId, erro: (err as Error).message },
      'Inbound Supabase: falha ao verificar controle_manual'
    );
    return false;
  }
}

export async function registrarMensagemInboundSupabase(input: {
  leadId: string;
  conteudo: string;
  clienteId: string;
  messageId: string;
}): Promise<void> {
  if (!isSupabaseEnabled() || process.env.INBOUND_SUPABASE_WRITE_ENABLED !== 'true') {
    return;
  }

  const client = getSupabaseServiceClient();
  if (!client) return;

  const { leadId, conteudo, clienteId, messageId } = input;

  try {
    await Promise.race([
      client.from('mensagens').insert({
        lead_id: leadId,
        remetente: 'lead',
        conteudo: String(conteudo).substring(0, 4000)
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout ao gravar inbound no Supabase')), 2500)
      )
    ]);
  } catch (err) {
    logger.warn(
      { leadId, clienteId, messageId, erro: (err as Error).message },
      'Inbound Supabase: falha ao gravar mensagem (fluxo principal mantido)'
    );
  }
}

export async function registrarMensagemOutboundSupabase(input: {
  leadId: string;
  conteudo: string;
  clienteId: string;
  messageId?: string;
}): Promise<void> {
  if (!isSupabaseEnabled()) {
    return;
  }

  const client = getSupabaseServiceClient();
  if (!client) return;

  const { leadId, conteudo, clienteId, messageId } = input;

  try {
    await Promise.race([
      client.from('mensagens').insert({
        lead_id: leadId,
        remetente: 'ia',
        conteudo: String(conteudo).substring(0, 4000)
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('timeout ao gravar outbound no Supabase')),
          2500
        )
      )
    ]);
  } catch (err) {
    logger.warn(
      { leadId, clienteId, messageId, erro: (err as Error).message },
      'Outbound Supabase: falha ao gravar mensagem IA (fluxo principal mantido)'
    );
  }
}

export async function atualizarUltimaInteracaoSupabase(input: {
  leadId: string;
  ultimaMensagem: string;
  clienteId: string;
}): Promise<void> {
  if (!isSupabaseEnabled()) {
    return;
  }

  const client = getSupabaseServiceClient();
  if (!client) return;

  const { leadId, ultimaMensagem, clienteId } = input;
  const agora = new Date().toISOString();

  try {
    await Promise.race([
      client.from('leads_dashboard').upsert(
        {
          lead_id: leadId,
          ultima_mensagem: String(ultimaMensagem).substring(0, 4000),
          ultima_interacao: agora,
          atualizado_em: agora
        },
        { onConflict: 'lead_id' }
      ),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('timeout ao atualizar lead no Supabase')),
          2500
        )
      )
    ]);
  } catch (err) {
    logger.warn(
      { leadId, clienteId, erro: (err as Error).message },
      'Outbound Supabase: falha ao atualizar ultima interação (fluxo principal mantido)'
    );
  }
}
