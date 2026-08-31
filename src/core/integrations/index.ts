// Integration layer public surface.
// Business modules import from here — never from adapters/ or
// local-repository.ts.

export * from "./types";
export * from "./errors";
export * from "./adapter";
export * from "./activity";
export * from "./connection-state";
export {
  INTEGRATIONS_REPOSITORY,
  type IntegrationRepository,
} from "./repository";
export {
  getIntegrationAdapter,
  hasIntegrationAdapter,
  listIntegrationAdapters,
  registerIntegrationAdapter,
  useIntegrationAdapters,
  clearIntegrationAdapters,
} from "./registry";
export {
  type CredentialResolver,
  type ResolvedCredential,
  getCredentialResolver,
  setCredentialResolver,
  createNullCredentialResolver,
  makeCredentialRef,
  assertNoSecretMaterial,
} from "./credentials";
export { INTEGRATION_CAPABILITIES } from "./capabilities";
export {
  connectConnection,
  disconnectConnection,
  testConnection,
  runSync,
} from "./service";
export { registerIntegrationsModule } from "./module";
export { useIntegrationConnections, useIntegrationRepository } from "./hooks";
