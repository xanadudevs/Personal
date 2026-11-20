import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { denyIfUnauthorized } from "@/lib/pagamentosAuth";
import { isIsoDate, occurrences } from "@/lib/pagamentos";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  dueDate: z.string(),
  paid: z.boolean(),
  amountCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

// Marca (ou desmarca) um vencimento como pago.
export async function PUT(req: Request, ctx: Ctx) {
  const denied = denyIfUnauthorized(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isIsoDate(parsed.data.dueDate)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const { dueDate, paid, amountCents } = parsed.data;
  const o = await prisma.obligation.findUnique({ where: { id } });
  if (!o) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (!occurrences(o, Number(dueDate.slice(0, 4))).includes(dueDate)) {
    return NextResponse.json({ error: "Esse vencimento não existe neste pagamento" }, { status: 400 });
  }
  if (!paid) {
    await prisma.obligationPayment.deleteMany({ where: { obligationId: id, dueDate } });
    return NextResponse.json({ ok: true, paid: false });
  }
  const data = { amountCents: amountCents ?? o.amountCents, paidAt: new Date() };
  await prisma.obligationPayment.upsert({
    where: { obligationId_dueDate: { obligationId: id, dueDate } },
    create: { obligationId: id, dueDate, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true, paid: true });
}
