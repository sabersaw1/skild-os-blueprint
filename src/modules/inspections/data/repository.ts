// Inspections repository — public interface only.
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under INSPECTIONS_REPOSITORY. Consumers (route
// components, hooks, other modules) import ONLY from this file.

import type {
  Inspection,
  InspectionCreateInput,
  InspectionFinding,
  InspectionFindingCreateInput,
  InspectionFindingUpdateInput,
  InspectionListQuery,
  InspectionPhoto,
  InspectionPhotoQueueInput,
  InspectionTemplate,
  InspectionTemplateCreateInput,
  InspectionTemplateUpdateInput,
  InspectionUpdateInput,
} from "./schemas";

export const INSPECTIONS_REPOSITORY = "inspections.repository";

export interface InspectionsRepository {
  // Templates
  listTemplates(): Promise<InspectionTemplate[]>;
  getTemplate(id: string): Promise<InspectionTemplate | undefined>;
  createTemplate(input: InspectionTemplateCreateInput): Promise<InspectionTemplate>;
  updateTemplate(
    id: string,
    patch: InspectionTemplateUpdateInput,
  ): Promise<InspectionTemplate>;

  // Inspections
  listInspections(query?: InspectionListQuery): Promise<Inspection[]>;
  getInspection(id: string): Promise<Inspection | undefined>;
  createInspection(input: InspectionCreateInput): Promise<Inspection>;
  updateInspection(id: string, patch: InspectionUpdateInput): Promise<Inspection>;

  // Findings
  listFindings(inspectionId: string): Promise<InspectionFinding[]>;
  createFinding(input: InspectionFindingCreateInput): Promise<InspectionFinding>;
  updateFinding(
    id: string,
    patch: InspectionFindingUpdateInput,
  ): Promise<InspectionFinding>;

  // Photos
  listPhotos(inspectionId: string): Promise<InspectionPhoto[]>;
  queuePhoto(input: InspectionPhotoQueueInput): Promise<InspectionPhoto>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
