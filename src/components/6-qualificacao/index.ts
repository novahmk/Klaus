// src/components/6-qualificacao/index.ts
export { ComponenteQualificacao } from './component';
export { CalculadorScore } from './calculator';
export { AnalisadorHistorico } from './analyzer';
export { NotificadorWhatsApp } from './notifier';
export { NotificadorDashboard } from './dashboard-notifier';
export { CacheQualificacao } from './cache';
export { PESOS, SCORES_INTENCAO } from './constants';
export {
  QualificacaoInput,
  QualificacaoOutput,
  ContextoLead
} from './types';
export type { WhasenderClient, DadosNotificacao } from './notifier';
export type { SocketServer } from './dashboard-notifier';
