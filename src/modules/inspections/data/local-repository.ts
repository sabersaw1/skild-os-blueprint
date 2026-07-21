// Local in-memory + localStorage implementation of InspectionsRepository.
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.inspections.templates.v1
//   skildos.inspections.inspections.v1
//   skildos.inspections.findings.v1
//   skildos.inspections.photos.v1
//
// Mutation ordering rule (Phase 4): validate → persist → emit → return.
// Photos additionally hand off to the Upload Queue before emission.

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { enqueueUpload } from "@/storage/uploadQueue";
import { INSPECTION_EVENTS } from "../activity";
import {
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  INSPECTION_STATUSES,
  type Inspection,
  type InspectionCreateInput,
  type InspectionFinding,
  type InspectionFindingCreateInput,
  type InspectionFindingUpdateInput,
  type InspectionListQuery,
  type InspectionPhoto,
  type InspectionPhotoQueueInput,
  type InspectionTemplate,
  type InspectionTemplateCreateInput,
  type InspectionTemplateUpdateInput,
  type InspectionUpdateInput,
} from "./schemas";
import type { InspectionsRepository } from "./repository";
import {
  readEnvelope,
  registerVersionedKey,
  writeEnvelope,
} from "./storage";

const K_TEMPLATES = "skildos.inspections.templates.v1";
const K_INSPECTIONS = "skildos.inspections.inspections.v1";
const K_FINDINGS = "skildos.inspections.findings.v1";
const K_PHOTOS = "skildos.inspections.photos.v1";

// Register versioned keys + migration hooks BEFORE any read/write.
// v0 (legacy bare array) → v1 (envelope). Pass-through migrations reserve
// the hook path for future schema changes.
registerVersionedKey<InspectionTemplate>({
  key: K_TEMPLATES,
  currentVersion: 1,
  migrations: { 0: (records) => records as InspectionTemplate[] },
});
registerVersionedKey<Inspection>({
  key: K_INSPECTIONS,
  currentVersion: 1,
  migrations: { 0: (records) => records as Inspection[] },
});
registerVersionedKey<InspectionFinding>({
  key: K_FINDINGS,
  currentVersion: 1,
  migrations: { 0: (records) => records as InspectionFinding[] },
});
registerVersionedKey<InspectionPhoto>({
  key: K_PHOTOS,
  currentVersion: 1,
  migrations: { 0: (records) => records as InspectionPhoto[] },
});

// ---- Validation ---------------------------------------------------------

function validateTemplateCreate(input: InspectionTemplateCreateInput): void {
  if (!input.name?.trim()) throw new Error("Template name is required.");
}

function validateInspectionCreate(input: InspectionCreateInput): void {
  if (!input.vehicleId?.trim()) throw new Error("vehicleId is required.");
  if (!input.customerId?.trim()) throw new Error("customerId is required.");
  if (input.status && !INSPECTION_STATUSES.includes(input.status)) {
    throw new Error(`invalid status "${input.status}".`);
  }
}

function validateInspectionUpdate(patch: InspectionUpdateInput): void {
  if (patch.status && !INSPECTION_STATUSES.includes(patch.status)) {
    throw new Error(`invalid status "${patch.status}".`);
  }
}

function validateFindingCreate(input: InspectionFindingCreateInput): void {
  if (!input.inspectionId?.trim()) throw new Error("inspectionId is required.");
  if (!input.title?.trim()) throw new Error("Finding title is required.");
  if (!input.category?.trim()) throw new Error("Finding category is required.");
  if (!FINDING_SEVERITIES.includes(input.severity)) {
    throw new Error(`invalid severity "${input.severity}".`);
  }
  if (input.status && !FINDING_STATUSES.includes(input.status)) {
    throw new Error(`invalid status "${input.status}".`);
  }
}

function validateFindingUpdate(patch: InspectionFindingUpdateInput): void {
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new Error("title cannot be empty.");
  }
  if (patch.severity && !FINDING_SEVERITIES.includes(patch.severity)) {
    throw new Error(`invalid severity "${patch.severity}".`);
  }
  if (patch.status && !FINDING_STATUSES.includes(patch.status)) {
    throw new Error(`invalid status "${patch.status}".`);
  }
}

// ---- Factory ------------------------------------------------------------

export function createLocalInspectionsRepository(): InspectionsRepository {
  let templates: InspectionTemplate[] =
    readEnvelope<InspectionTemplate>(K_TEMPLATES);
  let inspections: Inspection[] = readEnvelope<Inspection>(K_INSPECTIONS);
  let findings: InspectionFinding[] =
    readEnvelope<InspectionFinding>(K_FINDINGS);
  let photos: InspectionPhoto[] = readEnvelope<InspectionPhoto>(K_PHOTOS);

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const persistTemplates = () => writeEnvelope(K_TEMPLATES, templates);
  const persistInspections = () => writeEnvelope(K_INSPECTIONS, inspections);
  const persistFindings = () => writeEnvelope(K_FINDINGS, findings);
  const persistPhotos = () => writeEnvelope(K_PHOTOS, photos);

  const findInspection = (id: string) => inspections.find((i) => i.id === id);

  const repo: InspectionsRepository = {
    // ---- Templates ------------------------------------------------------
    async listTemplates() {
      return templates
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async getTemplate(id) {
      return templates.find((t) => t.id === id);
    },

    async createTemplate(input) {
      validateTemplateCreate(input);
      const now = Date.now();
      const tpl: InspectionTemplate = {
        id: newId(),
        name: input.name.trim(),
        description: input.description?.trim() ?? "",
        sections: input.sections ?? [],
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };
      templates = [tpl, ...templates];
      persistTemplates();
      notify();
      emit({
        type: INSPECTION_EVENTS.templateCreated,
        moduleId: "inspections",
        summary: `Created inspection template "${tpl.name}"`,
        payload: { templateId: tpl.id, name: tpl.name },
      });
      return tpl;
    },

    async updateTemplate(id, patch) {
      const existing = templates.find((t) => t.id === id);
      if (!existing) throw new Error(`Inspection template ${id} not found.`);
      if (patch.name !== undefined && !patch.name.trim()) {
        throw new Error("Template name cannot be empty.");
      }
      const next: InspectionTemplate = {
        ...existing,
        name: patch.name?.trim() ?? existing.name,
        description: patch.description?.trim() ?? existing.description,
        sections: patch.sections ?? existing.sections,
        updatedAt: Date.now(),
      };
      templates = templates.map((t) => (t.id === id ? next : t));
      persistTemplates();
      notify();
      emit({
        type: INSPECTION_EVENTS.templateUpdated,
        moduleId: "inspections",
        summary: `Updated inspection template "${next.name}"`,
        payload: { templateId: id, fields: Object.keys(patch) },
      });
      return next;
    },

    // ---- Inspections ----------------------------------------------------
    async listInspections(q: InspectionListQuery = {}) {
      let items = inspections.slice();
      if (q.vehicleId) items = items.filter((i) => i.vehicleId === q.vehicleId);
      if (q.customerId)
        items = items.filter((i) => i.customerId === q.customerId);
      if (q.status) items = items.filter((i) => i.status === q.status);
      if (q.search) {
        const s = q.search.toLowerCase();
        items = items.filter((i) => i.notes.toLowerCase().includes(s));
      }
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      return q.limit ? items.slice(0, q.limit) : items;
    },

    async getInspection(id) {
      return findInspection(id);
    },

    async createInspection(input) {
      validateInspectionCreate(input);
      if (input.templateId && !templates.find((t) => t.id === input.templateId)) {
        throw new Error(`Inspection template ${input.templateId} not found.`);
      }
      const now = Date.now();
      const inspection: Inspection = {
        id: newId(),
        vehicleId: input.vehicleId,
        customerId: input.customerId,
        templateId: input.templateId,
        status: input.status ?? "draft",
        findings: [],
        notes: input.notes?.trim() ?? "",
        createdBy: getIdentity().id,
        createdAt: now,
        updatedAt: now,
      };
      inspections = [inspection, ...inspections];
      persistInspections();
      notify();
      emit({
        type: INSPECTION_EVENTS.inspectionCreated,
        moduleId: "inspections",
        summary: `Started inspection`,
        payload: {
          inspectionId: inspection.id,
          vehicleId: inspection.vehicleId,
          customerId: inspection.customerId,
          templateId: inspection.templateId,
        },
      });
      return inspection;
    },

    async updateInspection(id, patch) {
      const existing = findInspection(id);
      if (!existing) throw new Error(`Inspection ${id} not found.`);
      validateInspectionUpdate(patch);
      if (patch.templateId && !templates.find((t) => t.id === patch.templateId)) {
        throw new Error(`Inspection template ${patch.templateId} not found.`);
      }
      const next: Inspection = {
        ...existing,
        status: patch.status ?? existing.status,
        notes: patch.notes !== undefined ? patch.notes : existing.notes,
        templateId:
          patch.templateId !== undefined ? patch.templateId : existing.templateId,
        updatedAt: Date.now(),
      };
      inspections = inspections.map((i) => (i.id === id ? next : i));
      persistInspections();
      notify();
      emit({
        type: INSPECTION_EVENTS.inspectionUpdated,
        moduleId: "inspections",
        summary: `Updated inspection`,
        payload: { inspectionId: id, fields: Object.keys(patch) },
      });
      return next;
    },

    // ---- Findings -------------------------------------------------------
    async listFindings(inspectionId) {
      return findings
        .filter((f) => f.inspectionId === inspectionId)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async createFinding(input) {
      validateFindingCreate(input);
      const inspection = findInspection(input.inspectionId);
      if (!inspection) {
        throw new Error(`Inspection ${input.inspectionId} not found.`);
      }
      const now = Date.now();
      const finding: InspectionFinding = {
        id: newId(),
        inspectionId: input.inspectionId,
        category: input.category.trim(),
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        severity: input.severity,
        status: input.status ?? "open",
        mediaKeys: [],
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };
      findings = [...findings, finding];
      persistFindings();

      const updatedInspection: Inspection = {
        ...inspection,
        findings: [...inspection.findings, finding.id],
        updatedAt: now,
      };
      inspections = inspections.map((i) =>
        i.id === inspection.id ? updatedInspection : i,
      );
      persistInspections();
      notify();
      emit({
        type: INSPECTION_EVENTS.findingCreated,
        moduleId: "inspections",
        summary: `Added finding "${finding.title}"`,
        payload: {
          findingId: finding.id,
          inspectionId: finding.inspectionId,
          severity: finding.severity,
        },
      });
      return finding;
    },

    async updateFinding(id, patch) {
      const existing = findings.find((f) => f.id === id);
      if (!existing) throw new Error(`Finding ${id} not found.`);
      validateFindingUpdate(patch);
      const next: InspectionFinding = {
        ...existing,
        category: patch.category?.trim() ?? existing.category,
        title: patch.title?.trim() ?? existing.title,
        description:
          patch.description !== undefined
            ? patch.description.trim()
            : existing.description,
        severity: patch.severity ?? existing.severity,
        status: patch.status ?? existing.status,
        updatedAt: Date.now(),
      };
      findings = findings.map((f) => (f.id === id ? next : f));
      persistFindings();
      notify();
      emit({
        type: INSPECTION_EVENTS.findingUpdated,
        moduleId: "inspections",
        summary: `Updated finding "${next.title}"`,
        payload: {
          findingId: id,
          inspectionId: next.inspectionId,
          fields: Object.keys(patch),
        },
      });
      return next;
    },

    // ---- Photos ---------------------------------------------------------
    async listPhotos(inspectionId) {
      return photos
        .filter((p) => p.inspectionId === inspectionId)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async queuePhoto(input) {
      const inspection = findInspection(input.inspectionId);
      if (!inspection) {
        throw new Error(`Inspection ${input.inspectionId} not found.`);
      }
      if (input.findingId) {
        const f = findings.find(
          (x) => x.id === input.findingId && x.inspectionId === input.inspectionId,
        );
        if (!f) {
          throw new Error(
            `Finding ${input.findingId} not found on inspection ${input.inspectionId}.`,
          );
        }
      }
      const photoId = newId();
      const logicalKey =
        input.logicalKey?.trim() ||
        `inspections/${input.inspectionId}/photos/${photoId}.jpg`;

      // Hand off to the Upload Queue (no real upload in Phase 4).
      enqueueUpload({
        logicalKey,
        size: input.size ?? 0,
        checksum: input.checksum,
      });

      const photo: InspectionPhoto = {
        id: photoId,
        inspectionId: input.inspectionId,
        findingId: input.findingId,
        logicalKey,
        uploadStatus: "queued",
        createdAt: Date.now(),
      };
      photos = [...photos, photo];
      persistPhotos();

      if (input.findingId) {
        findings = findings.map((f) =>
          f.id === input.findingId
            ? { ...f, mediaKeys: [...f.mediaKeys, logicalKey], updatedAt: Date.now() }
            : f,
        );
        persistFindings();
      }
      notify();
      emit({
        type: INSPECTION_EVENTS.photoQueued,
        moduleId: "inspections",
        summary: `Queued inspection photo`,
        payload: {
          photoId: photo.id,
          inspectionId: photo.inspectionId,
          findingId: photo.findingId,
          logicalKey: photo.logicalKey,
        },
      });
      return photo;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return repo;
}
