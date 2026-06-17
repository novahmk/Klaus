// src/components/6-qualificacao/exemplo.ts
/**
 * Exemplo de uso do Componente 6 - Qualificação de Leads
 * Klaus V2
 *
 * NOTA: Requer PostgreSQL, integração Whasender (WhatsApp) e Socket.io.
 * Enquanto a integração não estiver disponível, use como referência.
 */

import { Pool } from 'pg';
import { ComponenteQualificacao } from './component';
import {
  NotificadorWhatsApp,
  WhasenderClient
} from './notifier';
import {
  NotificadorDashboard,
  SocketServer
} from './dashboard-notifier';
import { QualificacaoInput } from './types';

async function exemploQualificacao() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Cliente Whasender (placeholder) e servidor Socket.io (placeholder)
  const whasender: WhasenderClient = {
    async sendMessage(params) {
      console.log('WhatsApp →', params.phone);
      return { status: 'enviado' };
    }
  };
  const io: SocketServer = {
    to(room: string) {
      return {
        emit(evento: string, payload: unknown) {
          console.log(`Socket [${room}] ${evento}`, payload);
        }
      };
    }
  };

  const whatsapp = new NotificadorWhatsApp(whasender);
  const dashboard = new NotificadorDashboard(io);

  const componente = new ComponenteQualificacao(pool, whatsapp, dashboard);

  const input: QualificacaoInput = {
    clienteId: 'cliente-123',
    leadId: 'lead-456',
    intencao: 'QUER_AGENDAR',
    historico: [
      { remetente: 'lead', texto: 'Quero agendar uma demonstração' }
    ],
    contextoLead: {
      nome: 'João Silva',
      telefone: '11999999999',
      email: 'joao@empresa.com',
      cargo: 'CEO',
      empresa: 'Clínica Vida',
      nicho: 'saude'
    }
  };

  const resultado = await componente.executar(input);

  console.log(`Score: ${resultado.scoreQualificacao}`);
  console.log(`Prioridade: ${resultado.prioridade}/10`);
  console.log(`Estágio: ${resultado.estagio}`);

  await pool.end();
}

(async () => {
  try {
    await exemploQualificacao();
    console.log('\n✅ Exemplo executado com sucesso!');
  } catch (erro) {
    console.error('Erro:', (erro as Error).message);
    process.exit(1);
  }
})();
