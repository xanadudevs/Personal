import type { Metadata } from "next";
import PagamentosApp from "@/components/PagamentosApp";

export const metadata: Metadata = { title: "Pagamentos" };

export default function PagamentosPage() {
  // Fundo creme só nesta página (o layout global é partilhado com a app Miúdos).
  return (
    <>
      <style>{"body{background:#f4f0e8 !important}"}</style>
      <PagamentosApp />
    </>
  );
}
