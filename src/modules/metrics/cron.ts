import { logger } from '../../components/shared/logger';
import { getSupabaseServiceClient } from '../../lib/supabase';

let metricsHandle: NodeJS.Timeout | null = null;

function msParaProximaExecucao005(): number {
  const agora = new Date();
  const proxima = new Date(agora);
  proxima.setHours(0, 5, 0, 0);
  if (proxima <= agora) {
    proxima.setDate(proxima.getDate() + 1);
  }
  return proxima.getTime() - agora.getTime();
}

function dataRefDiaAnterior(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function contar(input: {
  table: string;
  filters?: Array<{ col: string; op: 'eq' | 'gte' | 'lt'; value: string | boolean }>;
}): Promise<number> {
  const client = getSupabaseServiceClient();
  if (!client) return 0;

  let query = client.from(input.table).select('*', { count: 'exact', head: true });

  for (const filter of input.filters || []) {
    if (filter.op === 'eq') query = query.eq(filter.col, filter.value);
    if (filter.op === 'gte') query = query.gte(filter.col, filter.value as string);
    if (filter.op === 'lt') query = query.lt(filter.col, filter.value as string);
  }

  const { count, error } = await query;
  if (error) {
    logger.warn({ table: input.table, erro: error.message }, 'Metrics: falha em contagem');
    return 0;
  }

  return count || 0;
}

async function executarMetricsCron(): Promise<void> {
  if (process.env.METRICS_CRON_ENABLED !== 'true') {
    return;
  }

  if (process.env.SUPABASE_ENABLED !== 'true') {
    logger.debug('Metrics: SUPABASE_ENABLED=false, ciclo ignorado');
    return;
  }

  const client = getSupabaseServiceClient();
  if (!client) return;

  const clienteId = process.env.DEFAULT_CLIENTE_ID || 'default';
  const dataRef = dataRefDiaAnterior();
  const start = `${dataRef}T00:00:00.000Z`;
  const end = `${dataRef}T23:59:59.999Z`;

  const [
    totalLeads,
    leadsAtivos,
    leadsControleManual,
    totalMensagens,
    totalIaRespostas,
    totalFollowups,
    leadsConvertidos
  ] = await Promise.all([
    contar({ table: 'leads_dashboard' }),
    contar({ table: 'leads_dashboard', filters: [{ col: 'status', op: 'eq', value: 'ativo' }] }),
    contar({ table: 'leads_dashboard', filters: [{ col: 'controle_manual', op: 'eq', value: true }] }),
    contar({
      table: 'mensagens',
      filters: [
        { col: 'created_at', op: 'gte', value: start },
        { col: 'created_at', op: 'lt', value: end }
      ]
    }),
    contar({
      table: 'mensagens',
      filters: [
        { col: 'remetente', op: 'eq', value: 'ia' },
        { col: 'created_at', op: 'gte', value: start },
        { col: 'created_at', op: 'lt', value: end }
      ]
    }),
    contar({
      table: 'mensagens',
      filters: [
        { col: 'remetente', op: 'eq', value: 'ia' },
        { col: 'created_at', op: 'gte', value: start },
        { col: 'created_at', op: 'lt', value: end }
      ]
    }),
    contar({ table: 'leads_dashboard', filters: [{ col: 'status', op: 'eq', value: 'convertido' }] })
  ]);

  const { error } = await client.from('metricas_diarias').upsert(
    {
      cliente_id: clienteId,
      data_referencia: dataRef,
      total_leads: totalLeads,
      leads_ativos: leadsAtivos,
      leads_em_controle_manual: leadsControleManual,
      total_mensagens: totalMensagens,
      total_ia_respostas: totalIaRespostas,
      total_followups_enviados: totalFollowups,
      leads_convertidos: leadsConvertidos,
      atualizado_em: new Date().toISOString()
    },
    { onConflict: 'cliente_id,data_referencia' }
  );

  if (error) {
    logger.warn(
      { clienteId, dataRef, erro: error.message },
      'Metrics: falha no upsert de metricas_diarias'
    );
    return;
  }

  logger.info(
    {
      clienteId,
      dataRef,
      totalLeads,
      totalMensagens,
      totalIaRespostas
    },
    'Metrics: agregação diária concluída'
  );
}

function agendarProximaExecucao(): void {
  const waitMs = msParaProximaExecucao005();

  metricsHandle = setTimeout(async () => {
    await executarMetricsCron();
    agendarProximaExecucao();
  }, waitMs);

  metricsHandle.unref();
}

export function iniciarMetricsCron(): void {
  if (process.env.METRICS_CRON_ENABLED !== 'true') {
    logger.info('Metrics: cron desabilitado (METRICS_CRON_ENABLED=false)');
    return;
  }

  if (metricsHandle) {
    logger.info('Metrics: cron já iniciado');
    return;
  }

  agendarProximaExecucao();
  logger.info('Metrics: cron diário agendado para 00:05');
}

export function pararMetricsCron(): void {
  if (!metricsHandle) return;
  clearTimeout(metricsHandle);
  metricsHandle = null;
  logger.info('Metrics: cron parado');
}
