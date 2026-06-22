import { logger } from '../../components/shared/logger';
import { getSupabaseServiceClient } from '../../lib/supabase';
import { enviarFollowup } from './sender';

let followupHandle: NodeJS.Timeout | null = null;

type FollowupConfig = {
  cliente_id: string;
  intervalo_dias: number;
  horario_inicio: number;
  horario_fim: number;
  parar_fins_semana?: boolean;
  parar_aos_fins_de_semana?: boolean;
  max_envios: number;
  ativo: boolean;
};

type LeadElegivel = {
  lead_id: string;
  status: string;
  controle_manual: boolean;
  ultima_interacao: string | null;
};

type FollowupModelo = {
  ordem: number;
  texto: string;
  ativo: boolean;
};

function dentroJanelaHorario(config: FollowupConfig): boolean {
  const agora = new Date();
  const horaAtual = agora.getHours();
  return horaAtual >= config.horario_inicio && horaAtual <= config.horario_fim;
}

function ehFimDeSemana(): boolean {
  const dia = new Date().getDay();
  return dia === 0 || dia === 6;
}

async function carregarConfigAtiva(clienteId: string): Promise<FollowupConfig | null> {
  const client = getSupabaseServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from('followup_config')
    .select('*')
    .eq('cliente_id', clienteId)
    .eq('ativo', true)
    .single();

  if (error || !data) {
    logger.warn(
      { clienteId, erro: error?.message },
      'Follow-up: configuração ativa não encontrada'
    );
    return null;
  }

  return data as FollowupConfig;
}

async function carregarModelosAtivos(clienteId: string): Promise<FollowupModelo[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const { data, error } = await client
    .from('followup_modelos')
    .select('ordem, texto, ativo')
    .eq('cliente_id', clienteId)
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error || !data) {
    logger.warn(
      { clienteId, erro: error?.message },
      'Follow-up: falha ao carregar modelos ativos'
    );
    return [];
  }

  return data as FollowupModelo[];
}

async function carregarLeadsElegiveis(input: {
  clienteId: string;
  intervaloDias: number;
}): Promise<LeadElegivel[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const { clienteId, intervaloDias } = input;
  const limiteIso = new Date(
    Date.now() - intervaloDias * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await client
    .from('leads_dashboard')
    .select('lead_id, status, controle_manual, ultima_interacao')
    .eq('status', 'aguardando')
    .eq('controle_manual', false)
    .or(`ultima_interacao.is.null,ultima_interacao.lt.${limiteIso}`)
    .limit(100);

  if (error || !data) {
    logger.warn(
      { clienteId, erro: error?.message },
      'Follow-up: falha ao carregar leads elegíveis'
    );
    return [];
  }

  return data as LeadElegivel[];
}

async function obterIndiceProximoModelo(input: {
  leadId: string;
  totalModelos: number;
}): Promise<number> {
  const client = getSupabaseServiceClient();
  if (!client || input.totalModelos <= 1) return 0;

  const { data, error, count } = await client
    .from('mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', input.leadId)
    .eq('remetente', 'ia');

  if (error) {
    logger.debug(
      { leadId: input.leadId, erro: error.message },
      'Follow-up: fallback para primeiro modelo'
    );
    return 0;
  }

  const iaMsgs = count || 0;
  return iaMsgs % input.totalModelos;
}

async function executarCicloFollowup(): Promise<void> {
  if (process.env.FOLLOWUP_ENABLED !== 'true') {
    return;
  }

  if (process.env.SUPABASE_ENABLED !== 'true') {
    logger.debug('Follow-up: SUPABASE_ENABLED=false, ciclo ignorado');
    return;
  }

  const clienteId = process.env.DEFAULT_CLIENTE_ID || 'default';
  const config = await carregarConfigAtiva(clienteId);
  if (!config) return;

  const pararFimSemana =
    config.parar_fins_semana ?? config.parar_aos_fins_de_semana ?? false;

  if (pararFimSemana && ehFimDeSemana()) {
    logger.info({ clienteId }, 'Follow-up: ciclo ignorado em fim de semana');
    return;
  }

  if (!dentroJanelaHorario(config)) {
    logger.debug({ clienteId }, 'Follow-up: fora da janela de horário');
    return;
  }

  const modelos = await carregarModelosAtivos(clienteId);
  if (modelos.length === 0) {
    logger.warn({ clienteId }, 'Follow-up: sem modelos ativos');
    return;
  }

  const leads = await carregarLeadsElegiveis({
    clienteId,
    intervaloDias: config.intervalo_dias
  });

  if (leads.length === 0) {
    logger.debug({ clienteId }, 'Follow-up: nenhum lead elegível no ciclo');
    return;
  }

  let enviados = 0;
  for (const lead of leads) {
    if (enviados >= config.max_envios) break;

    const idx = await obterIndiceProximoModelo({
      leadId: lead.lead_id,
      totalModelos: modelos.length
    });

    const modelo = modelos[idx] || modelos[0];
    const ok = await enviarFollowup({
      leadId: lead.lead_id,
      clienteId,
      mensagem: modelo.texto
    });

    if (ok) enviados += 1;
  }

  logger.info(
    { clienteId, elegiveis: leads.length, enviados },
    'Follow-up: ciclo finalizado'
  );
}

export function iniciarFollowupScheduler(): void {
  if (process.env.FOLLOWUP_ENABLED !== 'true') {
    logger.info('Follow-up: scheduler desabilitado (FOLLOWUP_ENABLED=false)');
    return;
  }

  if (followupHandle) {
    logger.info('Follow-up: scheduler já iniciado');
    return;
  }

  const intervaloMs = 30 * 60 * 1000;

  followupHandle = setInterval(() => {
    void executarCicloFollowup();
  }, intervaloMs);

  followupHandle.unref();
  void executarCicloFollowup();

  logger.info(
    { intervaloMs },
    'Follow-up: scheduler iniciado (a cada 30 minutos)'
  );
}

export function pararFollowupScheduler(): void {
  if (!followupHandle) return;
  clearInterval(followupHandle);
  followupHandle = null;
  logger.info('Follow-up: scheduler parado');
}
