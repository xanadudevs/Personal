import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MIUDOS_TOKEN_HEADER, isMiudosDate, isValidMiudosToken } from "@/lib/miudos";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    who: z.enum(["B", "R"]).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((b) => b.who !== undefined || b.notes !== undefined, "Nada para guardar");

type Ctx = { params: Promise<{ date: string }> };

async function guard(req: Request, ctx: Ctx) {
  if (!isValidMiudosToken(req.headers.get(MIUDOS_TOKEN_HEADER))) {
    return { error: NextResponse.json({ error: "Chave inválida" }, { status: 401 }) } as const;
  }
  const { date } = await ctx.params;
  if (!isMiudosDate(date)) {
    return { error: NextResponse.json({ error: "Data inválida (só 2026)" }, { status: 400 }) } as const;
  }
  return { date } as const;
}

// Altera com quem ficam e/ou as notas de um dia.
export async function PUT(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx);
  if ("error" in g) return g.error;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { who, notes } = parsed.data;
  const data = {
    ...(who !== undefined ? { who } : {}),
    ...(notes !== undefined ? { notes: (notes ?? "").trim() } : {}),
  };
  const row = await prisma.miudosDay.upsert({
    where: { date: g.date },
    create: { date: g.date, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true, date: row.date });
}

// Volta ao calendário base para este dia.
export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx);
  if ("error" in g) return g.error;
  await prisma.miudosDay.deleteMany({ where: { date: g.date } });
  return NextResponse.json({ ok: true, date: g.date });
}
