import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyIfUnauthorized } from "@/lib/pagamentosAuth";
import { obligationSchema, occurrences, parseYear } from "@/lib/pagamentos";

export const dynamic = "force-dynamic";

// Pagamentos e respetivos vencimentos (pagos ou não) de um ano.
export async function GET(req: Request) {
  const denied = denyIfUnauthorized(req);
  if (denied) return denied;
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  const obligations = await prisma.obligation.findMany({
    orderBy: [{ startMonth: "asc" }, { name: "asc" }],
    include: { payments: { where: { dueDate: { startsWith: `${year}-` } } } },
  });
  const items = obligations.flatMap((o) =>
    !o.active
      ? []
      : occurrences(o, year).map((dueDate) => {
          const p = o.payments.find((x) => x.dueDate === dueDate);
          return { obligationId: o.id, dueDate, paid: !!p, paidAt: p?.paidAt ?? null, paidCents: p?.amountCents ?? null };
        }),
  );
  return NextResponse.json({
    year,
    obligations: obligations.map(({ payments: _p, ...o }) => o),
    items,
  });
}

export async function POST(req: Request) {
  const denied = denyIfUnauthorized(req);
  if (denied) return denied;
  const parsed = obligationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const row = await prisma.obligation.create({ data: parsed.data });
  return NextResponse.json(row, { status: 201 });
}
