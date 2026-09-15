import type { Activity } from "./useInventumData";

export type ConflictPair = { a: Activity; b: Activity; dayKey: string };

const FULL_DAY: [number, number] = [0, 24 * 60];

function toMinutes(hours: string, minutes?: string): number | null {
  const h = Number(hours);
  const m = minutes ? Number(minutes) : 0;
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return null;
  return h * 60 + m;
}

// Horário is free text ("14h-16h", "Tempo todo", "Manhã"...). We only pull out a
// range when we find two clear time markers; anything else is treated as covering
// the full day so we never silently miss a real conflict.
function parseTimeRange(horario: string): [number, number] | null {
  const matches = Array.from(horario.matchAll(/(\d{1,2})(?:[:h]\s?(\d{2}))?/g));
  if (matches.length < 2) return null;
  const start = toMinutes(matches[0][1], matches[0][2]);
  const end = toMinutes(matches[1][1], matches[1][2]);
  if (start === null || end === null || start >= end) return null;
  return [start, end];
}

function resolveRange(horario: string): [number, number] {
  return (horario && parseTimeRange(horario)) || FULL_DAY;
}

function overlaps(a: [number, number], b: [number, number]) {
  return a[0] < b[1] && b[0] < a[1];
}

// Live check used by the activity form: which existing activities collide with
// what the user is currently typing (same place, overlapping time, shared day)?
export function findConflictsForDraft(draft: Activity, activities: Activity[]): Activity[] {
  if (!draft.local || !draft.local.trim()) return [];
  const draftLocal = draft.local.trim().toLowerCase();
  const draftRange = resolveRange(draft.horario);
  return activities.filter((other) => {
    if (other.id === draft.id) return false;
    if (!other.local || other.local.trim().toLowerCase() !== draftLocal) return false;
    if (!overlaps(resolveRange(other.horario), draftRange)) return false;
    return Object.keys(draft.dias).some((dayKey) => draft.dias[dayKey] && other.dias[dayKey]);
  });
}

export function detectConflicts(activities: Activity[]): ConflictPair[] {
  const withLocation = activities.filter((item) => item.local && item.local.trim());
  const pairs: ConflictPair[] = [];
  for (let i = 0; i < withLocation.length; i++) {
    for (let j = i + 1; j < withLocation.length; j++) {
      const a = withLocation[i];
      const b = withLocation[j];
      if (a.local.trim().toLowerCase() !== b.local.trim().toLowerCase()) continue;
      if (!overlaps(resolveRange(a.horario), resolveRange(b.horario))) continue;
      for (const dayKey of Object.keys(a.dias)) {
        if (a.dias[dayKey] && b.dias[dayKey]) pairs.push({ a, b, dayKey });
      }
    }
  }
  return pairs;
}
