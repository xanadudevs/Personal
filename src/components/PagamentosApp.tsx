"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Pagamentos anuais (UIC, IMI, seguro, condomínio, cartões...). Usa a mesma
// chave guardada no dispositivo que a app Miúdos.

interface Obligation {
  id: string;
  name: string;
  category: string;
  amountCents: number | null;
  frequency: string;
  startMonth: number;
  dueDay: number;
  notes: string | null;
  active: boolean;
}
interface Item {
  obligationId: string;
  dueDate: string;
  paid: boolean;
  paidCents: number | null;
}
interface Data {
  obligations: Obligation[];
  items: Item[];
}

const KEY_TOKEN = "miudos:token";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CATEGORIES = ["Impostos", "Seguros", "Casa", "Carro", "Cartões", "Educação", "Outros"];
const COLORS: Record<string, string> = {
  Impostos: "#1f7a8c",
  Seguros: "#c2571a",
  Casa: "#5a7d2a",
  Carro: "#a63d2f",
  Cartões: "#6a4c9c",
  Educação: "#b7791f",
  Outros: "#6b7280",
};
const colorOf = (c: string) => COLORS[c] ?? COLORS.Outros;
const FREQS = [
  ["ANUAL", "Anual"],
  ["SEMESTRAL", "Semestral"],
  ["TRIMESTRAL", "Trimestral"],
  ["MENSAL", "Mensal"],
];
const RECUR: Record<string, string> = {
  ANUAL: "todos os anos",
  SEMESTRAL: "de 6 em 6 meses",
  TRIMESTRAL: "de 3 em 3 meses",
  MENSAL: "todos os meses",
};
const INK = "#1d2530";
const MUTED = "#6b7280";
const AMBER = "#c2571a";
const LATE = "#c0392b";

const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const money = (cents: number) => eur.format(cents / 100);
const localToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const dayDiff = (iso: string, today: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
const dateLabel = (iso: string) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${iso.slice(0, 4)}`;
const when = (d: number) => (d === 0 ? "hoje" : d === 1 ? "amanhã" : d > 1 ? `daqui a ${d} dias` : d === -1 ? "ontem" : `há ${-d} dias`);
const parseEuros = (s: string) => {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
};

function readToken() {
  try {
    return localStorage.getItem(KEY_TOKEN) || "";
  } catch {
    return "";
  }
}

type Row = Item & { o: Obligation; diff: number };

export default function PagamentosApp() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"lista" | "gerir">("lista");
  const [filter, setFilter] = useState("Todos");
  const [editing, setEditing] = useState<Obligation | "novo" | null>(null);
  const today = useMemo(localToday, []);

  const api = useCallback(
    async (method: string, path: string, body?: unknown) => {
      const res = await fetch(path, {
        method,
        headers: { "x-miudos-token": token ?? "", ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      if (res.status === 401) {
        try {
          localStorage.removeItem(KEY_TOKEN);
        } catch {}
        setToken("");
        setData(null);
        throw new Error("Chave inválida.");
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erro no servidor");
      return json;
    },
    [token],
  );

  // Este ano e o próximo: a lista é sempre "o que vem a seguir".
  const load = useCallback(async () => {
    try {
      const y = Number(today.slice(0, 4));
      const [a, b] = await Promise.all([api("GET", `/api/pagamentos?year=${y}`), api("GET", `/api/pagamentos?year=${y + 1}`)]);
      setData({ obligations: a.obligations, items: [...a.items, ...b.items] });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }, [api, today]);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    if (fromUrl) {
      try {
        localStorage.setItem(KEY_TOKEN, fromUrl);
      } catch {}
      window.history.replaceState(null, "", window.location.pathname);
    }
    setToken(fromUrl || readToken());
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  };

  const toggle = (r: Row) => run(() => api("PUT", `/api/pagamentos/${r.obligationId}/pago`, { dueDate: r.dueDate, paid: !r.paid }));

  const byId = useMemo(() => new Map((data?.obligations ?? []).map((o) => [o.id, o])), [data]);
  const all: Row[] = useMemo(
    () =>
      (data?.items ?? [])
        .flatMap((it) => {
          const o = byId.get(it.obligationId);
          return o ? [{ ...it, o, diff: dayDiff(it.dueDate, today) }] : [];
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.o.name.localeCompare(b.o.name)),
    [data, byId, today],
  );
  const cents = (r: Row) => r.paidCents ?? r.o.amountCents ?? 0;

  // Por pagar: de há 45 dias para a frente (o mais antigo fica de fora para não encher a lista).
  const open = all.filter((r) => !r.paid && r.diff >= -45);
  const done = all.filter((r) => r.paid && r.diff >= -180).reverse();
  const cats = Array.from(new Set(open.map((r) => r.o.category)));
  const f = cats.includes(filter) ? filter : "Todos";
  const pick = (rows: Row[]) => (f === "Todos" ? rows : rows.filter((r) => r.o.category === f));
  const groups: [string, string, Row[]][] = [
    ["Em atraso", LATE, pick(open).filter((r) => r.diff < 0)],
    ["Próximos 30 dias", "#9a6a12", pick(open).filter((r) => r.diff >= 0 && r.diff <= 30)],
    ["Mais tarde", MUTED, pick(open).filter((r) => r.diff > 30)],
  ];
  const next12 = open.filter((r) => r.diff <= 365);
  const total12 = next12.reduce((s, r) => s + cents(r), 0);

  if (token === null) return null;

  if (!token) {
    return (
      <main className="mx-auto max-w-md space-y-3 pt-10">
        <h1 className="font-serif text-3xl">Pagamentos</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Chave de acesso"
          type="password"
          className="w-full rounded-xl border border-[#ddd5c6] bg-white px-3 py-2"
        />
        <button
          onClick={() => {
            try {
              localStorage.setItem(KEY_TOKEN, tokenInput.trim());
            } catch {}
            setError("");
            setToken(tokenInput.trim());
          }}
          className="w-full rounded-xl bg-[#1f7a8c] py-2 font-semibold text-white"
        >
          Entrar
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-3xl border border-[#e8e1d3] bg-[#fffdf9] shadow-sm" style={{ color: INK }}>
        <header className="flex items-center gap-3 px-5 pb-3 pt-5">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: INK }} />
          <h1 className="font-serif text-[30px] leading-none">Pagamentos</h1>
          <button
            onClick={() => setEditing("novo")}
            className="rounded-full border-2 border-[#ddd5c6] bg-white px-4 py-1.5 text-[15px] font-semibold"
          >
            + Nova
          </button>
          <button
            onClick={() => setView(view === "lista" ? "gerir" : "lista")}
            className="ml-auto text-sm font-medium underline decoration-[#ddd5c6] underline-offset-4"
            style={{ color: MUTED }}
          >
            {view === "lista" ? "Gerir" : "Voltar"}
          </button>
        </header>

        {error && <p className="mx-5 mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {view === "lista" && (
          <>
            {data && data.obligations.length === 0 && (
              <div className="space-y-2 px-5 pb-5 text-sm">
                <p style={{ color: MUTED }}>Ainda não há pagamentos.</p>
                <button
                  onClick={() => run(() => api("POST", "/api/pagamentos/seed"))}
                  className="w-full rounded-xl bg-[#1f7a8c] py-2.5 font-semibold text-white"
                >
                  Carregar pagamentos iniciais (IUC, IMI, condomínio, seguro)
                </button>
              </div>
            )}

            {cats.length > 0 && (
              <>
                <div className="flex flex-wrap gap-2 px-5 pb-2">
                  {["Todos", ...cats].map((c) => {
                    const n = c === "Todos" ? open.length : open.filter((r) => r.o.category === c).length;
                    const on = f === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setFilter(c)}
                        className={`rounded-full border-2 px-4 py-1.5 text-[15px] font-bold ${on ? "border-[#1f7a8c] bg-[#e3eff0]" : "border-[#ddd5c6] bg-white"}`}
                      >
                        {on && "✓ "}
                        {c} · {n}
                      </button>
                    );
                  })}
                </div>
                <p className="px-5 pb-2 text-sm" style={{ color: MUTED }}>
                  Por pagar nos próximos 12 meses: <b style={{ color: INK }}>{money(total12)}</b>
                </p>
              </>
            )}

            {groups.map(([title, color, rows]) =>
              rows.length === 0 ? null : (
                <section key={title}>
                  <h2 className="border-t border-[#ece6d8] px-5 pb-1 pt-3 text-sm font-medium" style={{ color }}>
                    {title}
                  </h2>
                  {rows.map((r) => (
                    <PayRow key={r.obligationId + r.dueDate} r={r} amount={cents(r)} onToggle={() => toggle(r)} onOpen={() => setEditing(r.o)} />
                  ))}
                </section>
              ),
            )}

            {done.length > 0 && (
              <details className="border-t border-[#ece6d8]">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium" style={{ color: MUTED }}>
                  Pagos · {done.length}
                </summary>
                {done.map((r) => (
                  <PayRow key={r.obligationId + r.dueDate} r={r} amount={cents(r)} onToggle={() => toggle(r)} onOpen={() => setEditing(r.o)} />
                ))}
              </details>
            )}
          </>
        )}

        {view === "gerir" && (
          <section className="border-t border-[#ece6d8]">
            {data?.obligations.map((o) => (
              <div key={o.id} className={`flex items-center gap-3 border-b border-[#ece6d8] px-4 py-3 ${o.active ? "" : "opacity-50"}`}>
                <Badge category={o.category} />
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-bold leading-tight">{o.name}</div>
                  <div className="text-sm" style={{ color: MUTED }}>
                    {FREQS.find((x) => x[0] === o.frequency)?.[1]} · dia {o.dueDay} de {MONTHS[o.startMonth - 1]}
                    {o.amountCents != null && ` · ${money(o.amountCents)}`}
                    {!o.active && " · inativo"}
                  </div>
                </div>
                <button onClick={() => setEditing(o)} className="rounded-full border-2 border-[#ddd5c6] bg-white px-4 py-1 text-sm font-semibold">
                  Editar
                </button>
              </div>
            ))}
          </section>
        )}
      </div>

      {editing && (
        <ObligationForm
          initial={editing === "novo" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(body) =>
            run(async () => {
              await (editing === "novo" ? api("POST", "/api/pagamentos", body) : api("PUT", `/api/pagamentos/${editing.id}`, body));
              setEditing(null);
            })
          }
          onDelete={
            editing === "novo"
              ? undefined
              : () => {
                  if (confirm(`Apagar “${editing.name}” e o seu histórico?`))
                    void run(async () => {
                      await api("DELETE", `/api/pagamentos/${editing.id}`);
                      setEditing(null);
                    });
                }
          }
        />
      )}
    </main>
  );
}

function Badge({ category }: { category: string }) {
  return (
    <span className="w-[82px] shrink-0 rounded-full py-1 text-center text-[12.5px] font-bold text-white" style={{ background: colorOf(category) }}>
      {category}
    </span>
  );
}

function PayRow({ r, amount, onToggle, onOpen }: { r: Row; amount: number; onToggle: () => void; onOpen: () => void }) {
  const color = colorOf(r.o.category);
  const whenColor = r.diff < 0 ? LATE : r.diff <= 30 ? AMBER : MUTED;
  return (
    <div onClick={onOpen} className="flex cursor-pointer items-center gap-3 border-b border-[#ece6d8] px-4 py-3 last:border-b-0">
      <Badge category={r.o.category} />
      <div className="min-w-0 flex-1">
        <div className={`text-[17px] font-bold leading-tight ${r.paid ? "line-through opacity-50" : ""}`}>{r.o.name}</div>
        <div className="text-[13px] leading-snug" style={{ color: MUTED }}>
          {r.paid ? (
            <span style={{ color: "#3f7d20" }} className="font-semibold">
              pago
            </span>
          ) : (
            <span style={{ color: whenColor }} className="font-bold">
              {when(r.diff)}
            </span>
          )}
          {" · "}até {dateLabel(r.dueDate)}
          {amount > 0 && ` · ${money(amount)}`}
          {" · "}
          {RECUR[r.o.frequency]}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={`${r.paid ? "Desmarcar" : "Marcar como pago"}: ${r.o.name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
        style={{ borderColor: color, background: r.paid ? color : "transparent", color: r.paid ? "#fff" : color }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={r.paid ? 1 : 0.4}>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </button>
    </div>
  );
}

function ObligationForm({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Obligation | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Impostos");
  const [amount, setAmount] = useState(initial?.amountCents != null ? (initial.amountCents / 100).toFixed(2).replace(".", ",") : "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "ANUAL");
  const [startMonth, setStartMonth] = useState(initial?.startMonth ?? 1);
  const [dueDay, setDueDay] = useState(initial?.dueDay ?? 1);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [err, setErr] = useState("");

  const field = "w-full rounded-xl border border-[#ddd5c6] bg-white px-3 py-2";
  const label = "block space-y-1 text-sm font-medium";

  const submit = () => {
    const amountCents = parseEuros(amount);
    if (!name.trim()) return setErr("Indica o nome.");
    if (amountCents === undefined) return setErr("Valor inválido.");
    onSave({ name, category, amountCents, frequency, startMonth, dueDay, notes: notes.trim() || null, active });
  };

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-[#fbf8f1] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-2xl">{initial ? "Editar pagamento" : "Novo pagamento"}</h2>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <label className={label}>
          Nome
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="IMI, UIC, Seguro do carro..." />
        </label>
        <label className={label}>
          Categoria
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {(CATEGORIES.includes(category) ? CATEGORIES : [...CATEGORIES, category]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Valor habitual (€, vazio se variável)
          <input className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </label>
        <label className={label}>
          Frequência
          <select className={field} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>
            {frequency === "ANUAL" ? "Mês" : "Primeiro mês"}
            <select className={field} value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Dia
            <input className={field} type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
        </div>
        <label className={label}>
          Notas
          <textarea className={field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nº de apólice, referência multibanco..." />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo (aparece na lista)
        </label>
        <div className="flex gap-2 pt-1">
          <button onClick={submit} className="flex-1 rounded-xl bg-[#1f7a8c] py-2.5 font-semibold text-white">
            Guardar
          </button>
          <button onClick={onClose} className="rounded-xl border border-[#ddd5c6] bg-white px-4 py-2.5">
            Cancelar
          </button>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="w-full rounded-xl py-2 text-sm text-red-600">
            Apagar pagamento
          </button>
        )}
      </div>
    </div>
  );
}
