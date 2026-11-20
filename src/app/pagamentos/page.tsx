import type { Metadata } from "next";
import PagamentosApp from "@/components/PagamentosApp";

export const metadata: Metadata = { title: "Pagamentos" };

export default function PagamentosPage() {
  return <PagamentosApp />;
}
