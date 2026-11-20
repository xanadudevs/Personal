import { NextResponse } from "next/server";
import { MIUDOS_TOKEN_HEADER, isValidMiudosToken } from "@/lib/miudos";

// Mesma chave partilhada da app Miúdos (MIUDOS_TOKEN), sem login.
export function denyIfUnauthorized(req: Request) {
  if (!process.env.MIUDOS_TOKEN) {
    return NextResponse.json({ error: "MIUDOS_TOKEN não está definido no servidor" }, { status: 503 });
  }
  if (!isValidMiudosToken(req.headers.get(MIUDOS_TOKEN_HEADER))) {
    return NextResponse.json({ error: "Chave inválida" }, { status: 401 });
  }
  return null;
}
