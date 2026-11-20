import { z } from "zod";

// Pagamentos recorrentes (UIC, IMI, seguro, condomínio, cartões...). Cada
// "Obligation" repete-se conforme a frequência; cada vencimento pago fica
// registado em "ObligationPayment".

export const FREQUENCIES = { ANUAL: 12, SEMESTRAL: 6, TRIMESTRAL: 3, MENSAL: 1 } as const;
export type Frequency = keyof typeof FREQUENCIES;
export const CATEGORIES = ["Impostos", "Seguros", "Casa", "Carro", "Cartões", "Educação", "Outros"];

export const obligationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(40).default("Outros"),
  amountCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  frequency: z.enum(["ANUAL", "SEMESTRAL", "TRIMESTRAL", "MENSAL"]),
  startMonth: z.number().int().min(1).max(12),
  dueDay: z.number().int().min(1).max(31),
  notes: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional(),
});

export interface ObligationLike {
  frequency: string;
  startMonth: number;
  dueDay: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Datas de vencimento (AAAA-MM-DD) de um pagamento num dado ano.
export function occurrences(o: ObligationLike, year: number): string[] {
  const step = FREQUENCIES[o.frequency as Frequency] ?? 12;
  const out: string[] = [];
  for (let m = ((o.startMonth - 1) % step) + 1; m <= 12; m += step) {
    const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
    out.push(`${year}-${pad(m)}-${pad(Math.min(o.dueDay, last))}`);
  }
  return out;
}

export function isIsoDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function parseYear(value: string | null) {
  const y = Number(value);
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear();
}
