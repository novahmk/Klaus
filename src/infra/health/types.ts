export type OverallStatus = 'ok' | 'degraded' | 'down';

export type CheckStatus = 'ok' | 'fail' | 'skipped';

export interface CheckRunResult {
  detail?: string;
  skipped?: boolean;
}

export interface HealthCheck {
  name: string;
  timeout?: number;
  fn: () => Promise<CheckRunResult | void>;
}

export interface CheckResult {
  name: string;
  status: CheckStatus;
  ms: number;
  detail?: string;
  error?: string;
}

export interface HealthReport {
  overall: OverallStatus;
  results: CheckResult[];
  ts: string;
}

export interface RunAllChecksOptions {
  defaultTimeout?: number;
}
