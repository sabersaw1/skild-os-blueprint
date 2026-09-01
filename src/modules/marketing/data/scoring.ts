// Deterministic, explainable scoring rules (Phase 11).
//
// HARD RULE: no AI, no randomness, no opaque weights. Every point added is
// accompanied by a human-readable reason string, and the same input always
// produces the same output. A score is a RECOMMENDATION for ordering work —
// never an autonomous decision, never a gate on any action.
//
// Documented in docs/marketing/lead-scoring.md.

import type {
  Lead,
  LeadCreateInput,
  SearchOpportunityRecord,
} from "./schemas";

export interface ScoreResult {
  score: number;
  reasons: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

type ScorableLead = Pick<
  Lead,
  | "serviceRequested"
  | "requestSummary"
  | "vehicleId"
  | "customerId"
  | "location"
  | "urgency"
  | "qualification"
  | "lastContactAt"
  | "status"
> & { attribution?: Lead["attribution"] };

/**
 * Lead score = base 30, plus fixed additions for signals that historically
 * indicate real, workable business. Rules are listed in the docs and are
 * the ONLY thing that moves the number.
 */
export function scoreLead(lead: ScorableLead): ScoreResult {
  let score = 30;
  const reasons: string[] = ["base 30"];

  const add = (points: number, why: string) => {
    score += points;
    reasons.push(`${points > 0 ? "+" : ""}${points} ${why}`);
  };

  if (lead.serviceRequested?.trim()) add(15, "named a specific service");
  if ((lead.requestSummary?.trim().length ?? 0) >= 40)
    add(5, "described the problem in detail");
  if (lead.vehicleId) add(10, "vehicle already on file");
  if (lead.customerId) add(10, "known customer");
  if (lead.location?.trim()) add(5, "location provided");

  switch (lead.urgency) {
    case "emergency":
      add(15, "emergency urgency");
      break;
    case "high":
      add(10, "high urgency");
      break;
    case "normal":
      add(5, "normal urgency");
      break;
    default:
      break;
  }

  switch (lead.qualification) {
    case "qualified":
      add(15, "qualified by a human");
      break;
    case "needs_information":
      add(-5, "information still missing");
      break;
    case "not_a_fit":
      add(-25, "not a fit");
      break;
    case "out_of_area":
      add(-25, "outside service area");
      break;
    case "duplicate":
      add(-30, "duplicate lead");
      break;
    default:
      break;
  }

  if (lead.lastContactAt) add(5, "customer contact recorded");

  const source = lead.attribution?.lastTouch.source;
  if (source === "referral" || source === "existing_customer")
    add(10, "referral or existing customer");

  return { score: clamp(score), reasons };
}

export function scoreLeadInput(input: LeadCreateInput): ScoreResult {
  return scoreLead({
    serviceRequested: input.serviceRequested,
    requestSummary: input.requestSummary,
    vehicleId: input.vehicleId,
    customerId: input.customerId,
    location: input.location,
    urgency: input.urgency,
    qualification: input.qualification ?? "unknown",
    status: input.status ?? "new",
  });
}

/**
 * Search opportunity score. Only measured inputs move it; a record with no
 * measurements scores 0 with an explicit reason.
 */
export function scoreSearchOpportunity(
  record: Pick<
    SearchOpportunityRecord,
    "impressions" | "clicks" | "ctr" | "position" | "targetPage" | "service"
  >,
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, why: string) => {
    score += points;
    reasons.push(`${points > 0 ? "+" : ""}${points} ${why}`);
  };

  const impressions = record.impressions ?? 0;
  const clicks = record.clicks ?? 0;
  const ctr =
    record.ctr ?? (impressions > 0 ? clicks / impressions : undefined);

  if (impressions === 0 && record.position === undefined) {
    return { score: 0, reasons: ["no measured data"] };
  }

  if (impressions >= 1000) add(30, "1000+ impressions");
  else if (impressions >= 250) add(20, "250+ impressions");
  else if (impressions >= 50) add(10, "50+ impressions");

  if (ctr !== undefined && impressions >= 50 && ctr < 0.02)
    add(20, "high impressions, low click-through");

  if (record.position !== undefined) {
    if (record.position > 10 && record.position <= 20)
      add(25, "near page one (position 11–20)");
    else if (record.position > 3 && record.position <= 10)
      add(15, "on page one but below the top three");
  }

  if (!record.targetPage) add(15, "no page targets this query");
  if (record.service) add(10, "maps to a service Skild performs");

  return { score: clamp(score), reasons };
}
