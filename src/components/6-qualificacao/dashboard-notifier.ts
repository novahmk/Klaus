// src/components/6-qualificacao/dashboard-notifier.ts

export interface SocketServer {
  to(room: string): { emit(evento: string, payload: unknown): void };
}

export class NotificadorDashboard {
  constructor(private io: SocketServer) {}

  enviar(clienteId: string, payload: unknown): boolean {
    this.io.to(`cliente-${clienteId}`).emit('lead-qualificado', payload);
    return true;
  }
}
