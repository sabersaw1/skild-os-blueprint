// Knowledge repository — public interface only.
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under KNOWLEDGE_REPOSITORY. Consumers (route
// components, hooks, other modules) import ONLY from this file.

import type {
  KnowledgeDocument,
  KnowledgeDocumentCreateInput,
  KnowledgeDocumentListQuery,
  KnowledgeDocumentUpdateInput,
  KnowledgeLink,
  KnowledgeLinkCreateInput,
  KnowledgeLinkListQuery,
  KnowledgeVersion,
} from "./schemas";

export const KNOWLEDGE_REPOSITORY = "knowledge.repository";

export interface KnowledgeRepository {
  // Documents
  listDocuments(query?: KnowledgeDocumentListQuery): Promise<KnowledgeDocument[]>;
  getDocument(id: string): Promise<KnowledgeDocument | undefined>;
  createDocument(input: KnowledgeDocumentCreateInput): Promise<KnowledgeDocument>;
  updateDocument(
    id: string,
    patch: KnowledgeDocumentUpdateInput,
    changeReason: string,
  ): Promise<KnowledgeDocument>;
  archiveDocument(id: string): Promise<KnowledgeDocument>;

  // Versions (immutable, append-only)
  listVersions(documentId: string): Promise<KnowledgeVersion[]>;
  getVersion(id: string): Promise<KnowledgeVersion | undefined>;

  // Links
  listLinks(query?: KnowledgeLinkListQuery): Promise<KnowledgeLink[]>;
  createLink(input: KnowledgeLinkCreateInput): Promise<KnowledgeLink>;
  removeLink(id: string): Promise<void>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
