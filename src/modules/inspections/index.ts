// Public entry point for the Inspections module.
// Consumers import types + the register function from here.

export { registerInspectionsModule } from "./manifest";
export { INSPECTIONS_CAPABILITIES } from "./capabilities";
export { INSPECTION_EVENTS } from "./activity";
export {
  INSPECTIONS_REPOSITORY,
  type InspectionsRepository,
} from "./data/repository";
export {
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  INSPECTION_STATUSES,
  type FindingSeverity,
  type FindingStatus,
  type Inspection,
  type InspectionCreateInput,
  type InspectionFinding,
  type InspectionFindingCreateInput,
  type InspectionFindingUpdateInput,
  type InspectionListQuery,
  type InspectionPhoto,
  type InspectionPhotoQueueInput,
  type InspectionStatus,
  type InspectionTemplate,
  type InspectionTemplateCreateInput,
  type InspectionTemplateSection,
  type InspectionTemplateUpdateInput,
  type InspectionUpdateInput,
  type PhotoUploadStatus,
} from "./data/schemas";
export {
  useFindings,
  useInspection,
  useInspectionPhotos,
  useInspections,
  useInspectionsRepository,
  useInspectionTemplates,
} from "./hooks";
