import { logger } from '../../components/shared/logger';
import { dispatchOutboundMessage } from '../outbound/dispatcher';

export async function enviarFollowup(input: {
  leadId: string;
  clienteId: string;
  mensagem: string;
}): Promise<boolean> {
  const { leadId, clienteId, mensagem } = input;

  try {
    await dispatchOutboundMessage({
      leadId,
      clienteId,
      mensagem,
      to: leadId,
      origem: 'followup'
    });

    logger.info(
      { leadId, clienteId },
      'Follow-up: mensagem enviada com sucesso'
    );
    return true;
  } catch (err) {
    logger.warn(
      { leadId, clienteId, erro: (err as Error).message },
      'Follow-up: falha ao enviar mensagem'
    );
    return false;
  }
}
