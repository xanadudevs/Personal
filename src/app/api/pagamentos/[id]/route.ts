import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyIfUnauthorized } from "@/lib/pagamentosAuth";
import { obligationSchema } from "@/lib/pagamentos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const denied = denyIfUnauthorized(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = obligationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const exists = await prisma.obligation.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const row = await prisma.obligation.update({ where: { id }, data: parsed.data });
  return NextResponse.json(row);
}

// Apaga o pagamento e o histórico dos seus vencimentos.
export async function DELETE(req: Request, ctx: Ctx) {
  const denied = denyIfUnauthorized(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  await prisma.obligation.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
