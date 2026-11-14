import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MIUDOS_TOKEN_HEADER, isValidMiudosToken, mergeMiudos } from "@/lib/miudos";

export const dynamic = "force-dynamic";

// Calendário completo (base + alterações). Protegido pelo token, sem login.
export async function GET(req: Request) {
  if (!process.env.MIUDOS_TOKEN) {
    return NextResponse.json({ error: "MIUDOS_TOKEN não está definido no servidor" }, { status: 503 });
  }
  if (!isValidMiudosToken(req.headers.get(MIUDOS_TOKEN_HEADER))) {
    return NextResponse.json({ error: "Chave inválida" }, { status: 401 });
  }
  const rows = await prisma.miudosDay.findMany();
  return NextResponse.json(mergeMiudos(rows));
}
