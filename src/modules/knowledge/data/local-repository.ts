// Local in-memory + localStorage implementation of KnowledgeRepository.
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.knowledge.documents.v1
//   skildos.knowledge.versions.v1
//   skildos.knowledge.links.v1
//
// Mutation ordering rule (Phase 3):
//   validate → persist → emit exactly one activity event → return

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { KNOWLEDGE_EVENTS } from "../activity";
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_STATUSES,
  type KnowledgeDocument,
  type KnowledgeDocumentCreateInput,
  type KnowledgeDocumentListQuery,
  type KnowledgeDocumentUpdateInput,
  type KnowledgeLink,
  type KnowledgeLinkCreateInput,
  type KnowledgeLinkListQuery,
  type KnowledgeVersion,
  type PricingRulePayload,
} from "./schemas";
import type { KnowledgeRepository } from "./repository";
import {
  readEnvelope,
  registerVersionedKey,
  writeEnvelope,
} from "./storage";
import { assertPersisted } from "@/core/storage/persistence";
import { withCapabilityEnforcement } from "@/core/auth/authorize";

const K_DOCUMENTS = "skildos.knowledge.documents.v1";
const K_VERSIONS = "skildos.knowledge.versions.v1";
const K_LINKS = "skildos.knowledge.links.v1";

// Register versioned keys + migration hooks BEFORE any read/write.
// v0 (legacy bare array) → v1 (envelope). No shape change, so migrations
// are pass-through, but the hook path is exercised.
registerVersionedKey<KnowledgeDocument>({
  key: K_DOCUMENTS,
  currentVersion: 1,
  migrations: { 0: (records) => records as KnowledgeDocument[] },
});
registerVersionedKey<KnowledgeVersion>({
  key: K_VERSIONS,
  currentVersion: 1,
  migrations: { 0: (records) => records as KnowledgeVersion[] },
});
registerVersionedKey<KnowledgeLink>({
  key: K_LINKS,
  currentVersion: 1,
  migrations: { 0: (records) => records as KnowledgeLink[] },
});

// ---- Validation ---------------------------------------------------------

function validatePricingRule(p: PricingRulePayload): void {
  if (!p.name?.trim()) throw new Error("Pricing rule name is required.");
  if (!p.category?.trim()) throw new Error("Pricing rule category is required.");
  if (!Number.isFinite(p.baseLabor) || p.baseLabor < 0) {
    throw new Error("baseLabor must be a non-negative number.");
  }
  if (!Number.isFinite(p.markupPercent) || p.markupPercent < 0) {
    throw new Error("markupPercent must be a non-negative number.");
  }
  if (!Number.isFinite(p.minimumMargin) || p.minimumMargin < 0) {
    throw new Error("minimumMargin must be a non-negative number.");
  }
}

function validateCreate(input: KnowledgeDocumentCreateInput): void {
  if (!input.title?.trim()) throw new Error("title is required.");
  if (!input.content?.trim()) throw new Error("content is required.");
  if (!KNOWLEDGE_DOCUMENT_TYPES.includes(input.type)) {
    throw new Error(`invalid type "${input.type}".`);
  }
  if (input.status && !KNOWLEDGE_STATUSES.includes(input.status)) {
    throw new Error(`invalid status "${input.status}".`);
  }
  if (input.type === "pricing_rule") {
    if (!input.pricingRule) {
      throw new Error("pricing_rule documents require a pricingRule payload.");
    }
    validatePricingRule(input.pricingRule);
  }
}

function validateUpdate(patch: KnowledgeDocumentUpdateInput): void {
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new Error("title cannot be empty.");
  }
  if (patch.content !== undefined && !patch.content.trim()) {
    throw new Error("content cannot be empty.");
  }
  if (patch.status && !KNOWLEDGE_STATUSES.includes(patch.status)) {
    throw new Error(`invalid status "${patch.status}".`);
  }
  if (patch.pricingRule) validatePricingRule(patch.pricingRule);
}

// ---- Factory ------------------------------------------------------------

export function createLocalKnowledgeRepository(): KnowledgeRepository {
  let documents: KnowledgeDocument[] = readEnvelope<KnowledgeDocument>(K_DOCUMENTS);
  let versions: KnowledgeVersion[] = readEnvelope<KnowledgeVersion>(K_VERSIONS);
  let links: KnowledgeLink[] = readEnvelope<KnowledgeLink>(K_LINKS);

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const persistDocuments = () => assertPersisted(K_DOCUMENTS, writeEnvelope(K_DOCUMENTS, documents));
  const persistVersions = () => assertPersisted(K_VERSIONS, writeEnvelope(K_VERSIONS, versions));
  const persistLinks = () => assertPersisted(K_LINKS, writeEnvelope(K_LINKS, links));

  const findDoc = (id: string) => documents.find((d) => d.id === id);

  function appendVersion(
    doc: KnowledgeDocument,
    changeReason: string,
  ): KnowledgeVersion {
    const version: KnowledgeVersion = {
      id: newId(),
      knowledgeDocumentId: doc.id,
      versionNumber: doc.versionNumber,
      content: doc.content,
      changedBy: getIdentity().id,
      changeReason,
      createdAt: Date.now(),
    };
    versions = [...versions, version];
    persistVersions();
    return version;
  }

  const repo: KnowledgeRepository = {
    async listDocuments(q: KnowledgeDocumentListQuery = {}) {
      let items = documents.slice();
      if (q.type) items = items.filter((d) => d.type === q.type);
      if (q.status) items = items.filter((d) => d.status === q.status);
      if (q.tag) items = items.filter((d) => d.tags.includes(q.tag!));
      if (q.search) {
        const s = q.search.toLowerCase();
        items = items.filter(
          (d) =>
            d.title.toLowerCase().includes(s) ||
            d.summary.toLowerCase().includes(s) ||
            d.content.toLowerCase().includes(s) ||
            d.tags.some((t) => t.toLowerCase().includes(s)),
        );
      }
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      return q.limit ? items.slice(0, q.limit) : items;
    },

    async getDocument(id) {
      return findDoc(id);
    },

    async createDocument(input) {
      validateCreate(input);
      const now = Date.now();
      const doc: KnowledgeDocument = {
        id: newId(),
        type: input.type,
        title: input.title.trim(),
        summary: input.summary?.trim() ?? "",
        content: input.content,
        tags: (input.tags ?? [])
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        status: input.status ?? "draft",
        versionNumber: 1,
        ownerId: input.ownerId,
        pricingRule: input.pricingRule,
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };
      documents = [doc, ...documents];
      persistDocuments();

      const version = appendVersion(doc, "Initial version");
      notify();

      // One primary event per mutation. Version creation event follows.
      emit({
        type: KNOWLEDGE_EVENTS.documentCreated,
        moduleId: "knowledge",
        summary: `Created "${doc.title}"`,
        payload: { knowledgeId: doc.id, type: doc.type, versionId: version.id },
      });
      return doc;
    },

    async updateDocument(id, patch, changeReason) {
      const existing = findDoc(id);
      if (!existing) throw new Error(`Knowledge document ${id} not found.`);
      validateUpdate(patch);
      if (!changeReason?.trim()) {
        throw new Error("changeReason is required for updates.");
      }

      const wasPricingRule = existing.type === "pricing_rule";
      const next: KnowledgeDocument = {
        ...existing,
        title: patch.title?.trim() ?? existing.title,
        summary: patch.summary?.trim() ?? existing.summary,
        content: patch.content ?? existing.content,
        tags: patch.tags
          ? patch.tags.map((t) => t.trim()).filter(Boolean)
          : existing.tags,
        status: patch.status ?? existing.status,
        ownerId: patch.ownerId ?? existing.ownerId,
        pricingRule: patch.pricingRule ?? existing.pricingRule,
        versionNumber: existing.versionNumber + 1,
        updatedAt: Date.now(),
      };
      documents = documents.map((d) => (d.id === id ? next : d));
      persistDocuments();

      const version = appendVersion(next, changeReason.trim());
      notify();

      // Emit the version-created event first, then the primary mutation
      // event. Both are required by the immutable event catalog; ordering
      // reflects causality (version stored before document update signal).
      emit({
        type: KNOWLEDGE_EVENTS.documentVersionCreated,
        moduleId: "knowledge",
        summary: `Version ${next.versionNumber} of "${next.title}"`,
        payload: {
          knowledgeId: next.id,
          versionId: version.id,
          versionNumber: next.versionNumber,
          changeReason: version.changeReason,
        },
      });

      if (wasPricingRule && patch.pricingRule) {
        emit({
          type: KNOWLEDGE_EVENTS.pricingRuleUpdated,
          moduleId: "knowledge",
          summary: `Pricing rule "${next.title}" updated`,
          payload: { knowledgeId: next.id, versionNumber: next.versionNumber },
        });
      } else {
        emit({
          type: KNOWLEDGE_EVENTS.documentUpdated,
          moduleId: "knowledge",
          summary: `Updated "${next.title}"`,
          payload: {
            knowledgeId: next.id,
            versionNumber: next.versionNumber,
            fields: Object.keys(patch),
          },
        });
      }
      return next;
    },

    async archiveDocument(id) {
      const existing = findDoc(id);
      if (!existing) throw new Error(`Knowledge document ${id} not found.`);
      if (existing.status === "archived") return existing;
      const next: KnowledgeDocument = {
        ...existing,
        status: "archived",
        updatedAt: Date.now(),
      };
      documents = documents.map((d) => (d.id === id ? next : d));
      persistDocuments();
      notify();
      emit({
        type: KNOWLEDGE_EVENTS.documentArchived,
        moduleId: "knowledge",
        summary: `Archived "${next.title}"`,
        payload: { knowledgeId: id },
      });
      return next;
    },

    async listVersions(documentId) {
      return versions
        .filter((v) => v.knowledgeDocumentId === documentId)
        .slice()
        .sort((a, b) => b.versionNumber - a.versionNumber);
    },

    async getVersion(id) {
      return versions.find((v) => v.id === id);
    },

    async listLinks(query = {}) {
      let items = links.slice();
      if (query.knowledgeId)
        items = items.filter((l) => l.knowledgeId === query.knowledgeId);
      if (query.targetType)
        items = items.filter((l) => l.targetType === query.targetType);
      if (query.targetId)
        items = items.filter((l) => l.targetId === query.targetId);
      return items.sort((a, b) => b.createdAt - a.createdAt);
    },

    async createLink(input) {
      if (!input.knowledgeId?.trim()) throw new Error("knowledgeId is required.");
      if (!input.targetType?.trim()) throw new Error("targetType is required.");
      if (!input.targetId?.trim()) throw new Error("targetId is required.");
      if (!findDoc(input.knowledgeId)) {
        throw new Error(`Knowledge document ${input.knowledgeId} not found.`);
      }
      const link: KnowledgeLink = {
        id: newId(),
        knowledgeId: input.knowledgeId,
        targetType: input.targetType.trim(),
        targetId: input.targetId.trim(),
        createdAt: Date.now(),
      };
      links = [link, ...links];
      persistLinks();
      notify();
      emit({
        type: KNOWLEDGE_EVENTS.linkCreated,
        moduleId: "knowledge",
        summary: `Linked knowledge to ${link.targetType}`,
        payload: {
          knowledgeId: link.knowledgeId,
          linkId: link.id,
          targetType: link.targetType,
          targetId: link.targetId,
        },
      });
      return link;
    },

    async removeLink(id) {
      const before = links.length;
      links = links.filter((l) => l.id !== id);
      if (links.length === before) return;
      persistLinks();
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

    // Authorization boundary — see src/core/auth/authorize.ts. Enforced at the
  // repository so a non-UI caller (agent, adapter, command) cannot bypass it.
  return withCapabilityEnforcement(repo, {
    createDocument: "knowledge.write",
    updateDocument: "knowledge.write",
    archiveDocument: "knowledge.write",
    createLink: "knowledge.write",
    removeLink: "knowledge.write",
  });
}
