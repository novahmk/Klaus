// src/infra/memory/index.ts
export {
  createAdapter,
  chatHistoriesAdapter,
  customerIntentsAdapter
} from './state-adapter';
export type { StateAdapter } from './state-adapter';
export { LeadState } from './lead-state';
export type {
  Lead,
  QualificacaoLead,
  ContextoTurno,
  EtapaFunil,
  Temperatura
} from './lead-state';
export { LeadMemory, leadMemory } from './lead-memory';
export {
  carregarHistorico,
  salvarMensagem,
  jaFoiProcessada,
  marcarComoProcessada,
  getUltimaMensagem,
  getHorasDeContextoFrio,
  injetarContextoFrio
} from './conversation-repo';
export type { TurnoHistorico } from './conversation-repo';
