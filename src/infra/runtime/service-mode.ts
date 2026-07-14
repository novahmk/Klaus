export type ServiceMode = 'wasender' | 'validator-only';

const DEFAULT_SERVICE_MODE: ServiceMode = 'wasender';

export function getServiceMode(): ServiceMode {
  const raw = (process.env.SERVICE_MODE || DEFAULT_SERVICE_MODE).trim();

  return raw === 'validator-only' ? 'validator-only' : 'wasender';
}

export function isValidatorOnlyService(): boolean {
  return getServiceMode() === 'validator-only';
}