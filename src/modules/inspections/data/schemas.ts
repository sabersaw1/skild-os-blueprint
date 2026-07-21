// Inspections domain types.
// Interfaces + constant unions only. Validation lives in the repository
// (see ./local-repository.ts) — no Zod dependency in Phase 4.

// ---- Templates ----------------------------------------------------------

export interface InspectionTemplateItem {
  id: string;
  label: string;
  description?: string;
}

export interface InspectionTemplateSection {
  id: string;
  title: string;
  items: InspectionTemplateItem[];
}

export interface InspectionTemplate {
  id: string;
  name: string;
  description: string;
  sections: InspectionTemplateSection[];
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface InspectionTemplateCreateInput {
  name: string;
  description?: string;
  sections?: InspectionTemplateSection[];
}

export interface InspectionTemplateUpdateInput {
  name?: string;
  description?: string;
  sections?: InspectionTemplateSection[];
}

// ---- Inspections --------------------------------------------------------

export type InspectionStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "archived";

export const INSPECTION_STATUSES: InspectionStatus[] = [
  "draft",
  "in_progress",
  "completed",
  "archived",
];

export interface Inspection {
  id: string;
  vehicleId: string;
  customerId: string;
  templateId?: string;
  status: InspectionStatus;
  /** Finding ids in creation order. Full records live in the findings collection. */
  findings: string[];
  notes: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface InspectionCreateInput {
  vehicleId: string;
  customerId: string;
  templateId?: string;
  status?: InspectionStatus;
  notes?: string;
}

export interface InspectionUpdateInput {
  status?: InspectionStatus;
  notes?: string;
  templateId?: string;
}

export interface InspectionListQuery {
  vehicleId?: string;
  customerId?: string;
  status?: InspectionStatus;
  search?: string;
  limit?: number;
}

// ---- Findings -----------------------------------------------------------

export type FindingSeverity = "info" | "advisory" | "required" | "safety";
export const FINDING_SEVERITIES: FindingSeverity[] = [
  "info",
  "advisory",
  "required",
  "safety",
];

export type FindingStatus = "open" | "resolved" | "deferred";
export const FINDING_STATUSES: FindingStatus[] = [
  "open",
  "resolved",
  "deferred",
];

export interface InspectionFinding {
  id: string;
  inspectionId: string;
  category: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  status: FindingStatus;
  /** Logical upload-queue keys — never provider URLs. */
  mediaKeys: string[];
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface InspectionFindingCreateInput {
  inspectionId: string;
  category: string;
  title: string;
  description?: string;
  severity: FindingSeverity;
  status?: FindingStatus;
}

export interface InspectionFindingUpdateInput {
  category?: string;
  title?: string;
  description?: string;
  severity?: FindingSeverity;
  status?: FindingStatus;
}

// ---- Photos -------------------------------------------------------------

export type PhotoUploadStatus = "queued" | "uploading" | "failed" | "done";

export interface InspectionPhoto {
  id: string;
  inspectionId: string;
  findingId?: string;
  logicalKey: string;
  uploadStatus: PhotoUploadStatus;
  createdAt: number;
}

export interface InspectionPhotoQueueInput {
  inspectionId: string;
  findingId?: string;
  /** Logical key template; the repository fills a UUID segment when omitted. */
  logicalKey?: string;
  size?: number;
  checksum?: string;
}
