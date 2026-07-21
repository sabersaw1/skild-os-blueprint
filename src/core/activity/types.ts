export type ActivityEvent = {
  id: string;
  at: number; // epoch ms
  actorId: string;
  type: string; // e.g. "navigation", "settings.change", "command.run"
  moduleId: string;
  summary: string;
  payload?: Record<string, unknown>;
};
