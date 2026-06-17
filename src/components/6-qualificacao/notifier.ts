// src/components/6-qualificacao/notifier.ts

export interface WhasenderClient {
  sendMessage(params: { phone: string; message: string }): Promise<unknown>;
}

export interface DadosNotificacao {
  nome: string;
  telefone: string;
  prioridade: number;
}

export class NotificadorWhatsApp {
  constructor(private whasender: WhasenderClient) {}

  async enviar(numero: string, dados: DadosNotificacao): Promise<unknown> {
    const mensagem = `🔥 *LEAD QUALIFICADO*

${dados.nome}
${dados.telefone}

⭐ Prioridade: ${dados.prioridade}/10

📍 Lead interessado no agendamento

Qualificado em: ${new Date().toLocaleString('pt-BR')}`;

    return await this.whasender.sendMessage({
      phone: numero,
      message: mensagem
    });
  }
}
