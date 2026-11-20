import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyIfUnauthorized } from "@/lib/pagamentosAuth";
import { SEED_OBLIGATIONS } from "@/lib/pagamentosSeed";

export const dynamic = "force-dynamic";

// Cria os pagamentos iniciais que ainda não existem (pelo nome). Repetível.
export async function POST(req: Request) {
  const denied = denyIfUnauthorized(req);
  if (denied) return denied;
  const rows = await prisma.obligation.findMany({ select: { id: true, name: true, amountCents: true } });
  const toCreate = SEED_OBLIGATIONS.filter((o) => !rows.some((r) => r.name === o.name));
  if (toCreate.length) await prisma.obligation.createMany({ data: toCreate });
  // Preenche só valores que estavam em branco; nunca altera um valor já definido.
  let filled = 0;
  for (const o of SEED_OBLIGATIONS) {
    const row = rows.find((r) => r.name === o.name);
    if (row && row.amountCents === null && o.amountCents !== null) {
      await prisma.obligation.update({ where: { id: row.id }, data: { amountCents: o.amountCents } });
      filled++;
    }
  }
  return NextResponse.json({ created: toCreate.length, filled });
}
