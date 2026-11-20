import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyIfUnauthorized } from "@/lib/pagamentosAuth";
import { SEED_OBLIGATIONS } from "@/lib/pagamentosSeed";

export const dynamic = "force-dynamic";

// Cria os pagamentos iniciais que ainda não existem (pelo nome). Repetível.
export async function POST(req: Request) {
  const denied = denyIfUnauthorized(req);
  if (denied) return denied;
  const existing = new Set((await prisma.obligation.findMany({ select: { name: true } })).map((o) => o.name));
  const toCreate = SEED_OBLIGATIONS.filter((o) => !existing.has(o.name));
  if (toCreate.length) await prisma.obligation.createMany({ data: toCreate });
  return NextResponse.json({ created: toCreate.length });
}
