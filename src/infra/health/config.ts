export const healthConfig = {
  pingInterval: Number(process.env.HEALTH_PING_INTERVAL_MS) || 60_000,
  defaultTimeout: 5_000,
  healthRoute: '/health'
};
