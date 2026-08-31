// Provider-agnostic integration errors.
//
// Rules:
//   * Error codes are stable and provider-neutral.
//   * Messages are safe to display and safe to log — adapters must never
//     put tokens, keys, passwords, or raw provider payloads into them.
//   * Retryability is explicit so future backoff logic has a contract.

export const INTEGRATION_ERROR_CODES = [
  "authentication_failed",
  "authorization_revoked",
  "rate_limited",
  "provider_unavailable",
  "invalid_request",
  "sync_failed",
  "unsupported_operation",
  "configuration_missing",
] as const;

export type IntegrationErrorCode = (typeof INTEGRATION_ERROR_CODES)[number];

const RETRYABLE: IntegrationErrorCode[] = [
  "rate_limited",
  "provider_unavailable",
  "sync_failed",
];

export function isRetryableCode(code: IntegrationErrorCode): boolean {
  return RETRYABLE.includes(code);
}

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode;
  readonly provider?: string;
  readonly retryable: boolean;

  constructor(
    code: IntegrationErrorCode,
    message: string,
    options: { provider?: string; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.provider = options.provider;
    this.retryable = options.retryable ?? isRetryableCode(code);
  }

  /** Safe, serializable shape for UI, activity payloads, and logs. */
  toSafeJSON(): {
    code: IntegrationErrorCode;
    message: string;
    provider?: string;
    retryable: boolean;
  } {
    return {
      code: this.code,
      message: this.message,
      provider: this.provider,
      retryable: this.retryable,
    };
  }
}

export function toIntegrationError(
  err: unknown,
  fallbackCode: IntegrationErrorCode = "sync_failed",
): IntegrationError {
  if (err instanceof IntegrationError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new IntegrationError(fallbackCode, message);
}
