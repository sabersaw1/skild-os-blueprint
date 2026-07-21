// Public entry point for the Knowledge module.
// Consumers import types + the register function from here.

export { registerKnowledgeModule } from "./manifest";
export { KNOWLEDGE_CAPABILITIES } from "./capabilities";
export { KNOWLEDGE_EVENTS } from "./activity";
export {
  KNOWLEDGE_REPOSITORY,
  type KnowledgeRepository,
} from "./data/repository";
export {
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_STATUSES,
  type KnowledgeDocument,
  type KnowledgeDocumentCreateInput,
  type KnowledgeDocumentListQuery,
  type KnowledgeDocumentType,
  type KnowledgeDocumentUpdateInput,
  type KnowledgeLink,
  type KnowledgeLinkCreateInput,
  type KnowledgeLinkListQuery,
  type KnowledgeStatus,
  type KnowledgeVersion,
  type PricingRulePayload,
} from "./data/schemas";
export {
  useKnowledgeDocument,
  useKnowledgeDocuments,
  useKnowledgeLinks,
  useKnowledgeRepository,
  useKnowledgeVersions,
} from "./hooks";
