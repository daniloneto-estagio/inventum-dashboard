import type { Activity } from "./useInventumData";

export type ConflictPair = { a: Activity; b: Activity; dayKey: string };

// Conflito de agenda só importa pra tipos com hora/local fixos e público
// disputando o mesmo espaço — competições e palestras. Mostra/Oficina/etc
// ficam de fora pra não gerar alerta pra atividade sem relação nenhuma.
const CONFLICT_TYPES = new Set(["Competição", "Palestra"]);

function isConflictRelevant(activity: Activity): boolean {
  return CONFLICT_TYPES.has(activity.tipo);
}

function toMinutes(hours: string, minutes?: string): number | null {
  const h = Number(hours);
  const m = minutes ? Number(minutes) : 0;
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return null;
  return h * 60 + m;
}

// Horário is free text ("14h-16h", "Tempo todo", "Manhã"...). We only pull out a
// range when we find two clear time markers. Sem hora clara, não dá pra afirmar
// conflito de horário — compartilhar o dia sozinho não é problema.
function parseTimeRange(horario: string): [number, number] | null {
  const matches = Array.from(horario.matchAll(/(\d{1,2})(?:[:h]\s?(\d{2}))?/g));
  if (matches.length < 2) return null;
  const start = toMinutes(matches[0][1], matches[0][2]);
  const end = toMinutes(matches[1][1], matches[1][2]);
  if (start === null || end === null || start >= end) return null;
  return [start, end];
}

function resolveRange(horario: string): [number, number] | null {
  return horario ? parseTimeRange(horario) : null;
}

function overlaps(a: [number, number], b: [number, number]) {
  return a[0] < b[1] && b[0] < a[1];
}

// Real start/end (data_inicio/data_fim, filled for "algumas competições, palestras
// etc" — não é todo mundo). Quando as duas atividades comparadas têm isso
// preenchido, é o sinal mais confiável (data real, não só heurística de texto).
function realRange(activity: Activity): [number, number] | null {
  if (!activity.dataInicio || !activity.dataFim) return null;
  const start = Date.parse(activity.dataInicio);
  const end = Date.parse(activity.dataFim);
  if (Number.isNaN(start) || Number.isNaN(end) || start >= end) return null;
  return [start, end];
}

// Live check used by the activity form: which existing activities collide with
// what the user is currently typing (same place, overlapping time, shared day)?
export function findConflictsForDraft(draft: Activity, activities: Activity[]): Activity[] {
  if (!draft.local || !draft.local.trim()) return [];
  if (!isConflictRelevant(draft)) return [];
  const draftLocal = draft.local.trim().toLowerCase();
  const draftReal = realRange(draft);
  const draftRange = resolveRange(draft.horario);
  return activities.filter((other) => {
    if (other.id === draft.id) return false;
    if (!isConflictRelevant(other)) return false;
    if (!other.local || other.local.trim().toLowerCase() !== draftLocal) return false;
    const otherReal = realRange(other);
    if (draftReal && otherReal) return overlaps(draftReal, otherReal);
    const otherRange = resolveRange(other.horario);
    if (!draftRange || !otherRange || !overlaps(otherRange, draftRange)) return false;
    return Object.keys(draft.dias).some((dayKey) => draft.dias[dayKey] && other.dias[dayKey]);
  });
}

export function detectConflicts(activities: Activity[]): ConflictPair[] {
  const withLocation = activities.filter((item) => item.local && item.local.trim() && isConflictRelevant(item));
  const pairs: ConflictPair[] = [];
  for (let i = 0; i < withLocation.length; i++) {
    for (let j = i + 1; j < withLocation.length; j++) {
      const a = withLocation[i];
      const b = withLocation[j];
      if (a.local.trim().toLowerCase() !== b.local.trim().toLowerCase()) continue;
      const aReal = realRange(a);
      const bReal = realRange(b);
      if (aReal && bReal) {
        if (overlaps(aReal, bReal)) pairs.push({ a, b, dayKey: "periodo" });
        continue;
      }
      const aRange = resolveRange(a.horario);
      const bRange = resolveRange(b.horario);
      if (!aRange || !bRange || !overlaps(aRange, bRange)) continue;
      for (const dayKey of Object.keys(a.dias)) {
        if (a.dias[dayKey] && b.dias[dayKey]) pairs.push({ a, b, dayKey });
      }
    }
  }
  return pairs;
}
