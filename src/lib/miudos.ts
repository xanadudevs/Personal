import { timingSafeEqual } from "crypto";
import { BASE_NOTES, BASE_S, HOLIDAYS, MIUDOS_YEAR } from "@/lib/miudosData";

// Chave de acesso à app /miudos (sem login). Define MIUDOS_TOKEN na Vercel;
// sem ela a app fica desligada. Vai no cabeçalho x-miudos-token.
export const MIUDOS_TOKEN_HEADER = "x-miudos-token";

export function isValidMiudosToken(candidate: string | null | undefined) {
  const expected = process.env.MIUDOS_TOKEN;
  if (!expected || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isMiudosDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso && d.getUTCFullYear() === MIUDOS_YEAR;
}

export interface MiudosOverride {
  date: string;
  who: string | null;
  notes: string | null;
}

// Calendário base + alterações manuais.
export function mergeMiudos(overrides: MiudosOverride[]) {
  const d0 = Date.UTC(MIUDOS_YEAR, 0, 1);
  const S = BASE_S.split("");
  const notes: Record<string, string> = { ...BASE_NOTES };
  for (const o of overrides) {
    if (o.who === "B" || o.who === "R") {
      const i = Math.round((Date.parse(`${o.date}T00:00:00Z`) - d0) / 86400000);
      if (i >= 0 && i < S.length) S[i] = o.who;
    }
    if (o.notes !== null) {
      if (o.notes) notes[o.date] = o.notes;
      else delete notes[o.date];
    }
  }
  return { year: MIUDOS_YEAR, S: S.join(""), notes, holidays: HOLIDAYS, manual: overrides.map((o) => o.date) };
}
