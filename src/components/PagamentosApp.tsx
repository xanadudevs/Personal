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
  year: number;
  obligations: Obligation[];
  items: Item[];
}

const KEY_TOKEN = "miudos:token";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CATEGORIES = ["Impostos", "Seguros", "Casa", "Carro", "Cartões", "Educação", "Outros"];
const FREQS = [
  ["ANUAL", "Anual"],
  ["SEMESTRAL", "Semestral"],
  ["TRIMESTRAL", "Trimestral"],
  ["MENSAL", "Mensal"],
];
const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const money = (cents: number) => eur.format(cents / 100);
const localToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const dayMonth = (iso: string) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)}`;
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

export default function PagamentosApp() {
  const thisYear = new Date().getFullYear();
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"calendario" | "gerir">("calendario");
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

  const load = useCallback(async () => {
    try {
      setData(await api("GET", `/api/pagamentos?year=${year}`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }, [api, year]);

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

  const byId = useMemo(() => new Map((data?.obligations ?? []).map((o) => [o.id, o])), [data]);
  const rows = useMemo(
    () =>
      (data?.items ?? [])
        .map((it) => ({ ...it, o: byId.get(it.obligationId)! }))
        .filter((r) => r.o)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.o.name.localeCompare(b.o.name)),
    [data, byId],
  );
  const cents = (r: (typeof rows)[number]) => r.paidCents ?? r.o.amountCents ?? 0;
  const total = rows.reduce((s, r) => s + cents(r), 0);
  const paid = rows.filter((r) => r.paid).reduce((s, r) => s + cents(r), 0);
  const next = rows.filter((r) => !r.paid).slice(0, 5);
  const byMonth = MONTHS.map((_, m) => rows.filter((r) => Number(r.dueDate.slice(5, 7)) === m + 1));

  if (token === null) return null;

  if (!token) {
    return (
      <main className="mx-auto max-w-md space-y-3 pt-10">
        <h1 className="text-xl font-bold">Pagamentos</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Chave de acesso"
          type="password"
          className="w-full rounded-lg border border-[#d5dbe2] bg-white px-3 py-2"
        />
        <button
          onClick={() => {
            try {
              localStorage.setItem(KEY_TOKEN, tokenInput.trim());
            } catch {}
            setError("");
            setToken(tokenInput.trim());
          }}
          className="w-full rounded-lg bg-[#2f86c4] py-2 font-semibold text-white"
        >
          Entrar
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Pagamentos</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(year - 1)} className="rounded-lg bg-white px-3 py-1 shadow-sm" aria-label="Ano anterior">
            ‹
          </button>
          <span className="w-12 text-center font-semibold">{year}</span>
          <button onClick={() => setYear(year + 1)} className="rounded-lg bg-white px-3 py-1 shadow-sm" aria-label="Ano seguinte">
            ›
          </button>
        </div>
      </header>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Total do ano", total, ""],
          ["Pago", paid, "text-[#3f8a24]"],
          ["Em falta", total - paid, "text-[#c0392b]"],
        ].map(([label, v, cls]) => (
          <div key={label as string} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="text-xs text-[#5b6675]">{label}</div>
            <div className={`text-base font-bold ${cls}`}>{money(v as number)}</div>
          </div>
        ))}
      </section>

      {next.length > 0 && (
        <section className="rounded-xl bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-[#5b6675]">Próximos a pagar</h2>
          <ul className="space-y-1">
            {next.map((r) => (
              <li key={r.obligationId + r.dueDate} className="flex justify-between text-sm">
                <span className={r.dueDate < today ? "font-semibold text-red-600" : ""}>
                  {dayMonth(r.dueDate)} · {r.o.name}
                  {r.dueDate < today && " (em atraso)"}
                </span>
                <span>{r.o.amountCents != null ? money(r.o.amountCents) : "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="flex gap-2">
        {(["calendario", "gerir"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-[#2f86c4] text-white" : "bg-white"}`}
          >
            {t === "calendario" ? "Calendário" : "Gerir"}
          </button>
        ))}
      </nav>

      {tab === "calendario" && (
        <section className="space-y-3">
          {data && data.obligations.length === 0 && (
            <div className="space-y-2 rounded-xl bg-white p-3 text-sm shadow-sm">
              <p className="text-[#5b6675]">Ainda não há pagamentos.</p>
              <button
                onClick={() => run(() => api("POST", "/api/pagamentos/seed"))}
                className="w-full rounded-lg bg-[#2f86c4] py-2 font-semibold text-white"
              >
                Carregar pagamentos iniciais (IUC, IMI, condomínio, seguro)
              </button>
            </div>
          )}
          {byMonth.map((list, m) =>
            list.length === 0 ? null : (
              <div key={m} className="rounded-xl bg-white p-3 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold capitalize text-[#5b6675]">{MONTHS[m]}</h3>
                <ul className="divide-y divide-[#eef1f4]">
                  {list.map((r) => (
                    <li key={r.obligationId + r.dueDate} className="flex items-center gap-3 py-2">
                      <input
                        type="checkbox"
                        checked={r.paid}
                        className="h-5 w-5"
                        aria-label={`Pago: ${r.o.name}`}
                        onChange={(e) =>
                          run(() => api("PUT", `/api/pagamentos/${r.obligationId}/pago`, { dueDate: r.dueDate, paid: e.target.checked }))
                        }
                      />
                      <div className={`flex-1 ${r.paid ? "text-[#8a94a1] line-through" : ""}`}>
                        <div className="font-medium">{r.o.name}</div>
                        <div className="text-xs text-[#5b6675]">
                          {dayMonth(r.dueDate)} · {r.o.category}
                        </div>
                      </div>
                      <div className="text-sm">{cents(r) || r.o.amountCents != null ? money(cents(r)) : "—"}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </section>
      )}

      {tab === "gerir" && (
        <section className="space-y-2">
          <button onClick={() => setEditing("novo")} className="w-full rounded-lg bg-[#2f86c4] py-2 font-semibold text-white">
            + Novo pagamento
          </button>
          {data?.obligations.map((o) => (
            <div key={o.id} className={`flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ${o.active ? "" : "opacity-50"}`}>
              <div>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-[#5b6675]">
                  {o.category} · {FREQS.find((f) => f[0] === o.frequency)?.[1]} · dia {o.dueDay} de {MONTHS[o.startMonth - 1]}
                  {o.amountCents != null && ` · ${money(o.amountCents)}`}
                </div>
              </div>
              <button onClick={() => setEditing(o)} className="rounded-lg bg-[#eef1f4] px-3 py-1 text-sm">
                Editar
              </button>
            </div>
          ))}
        </section>
      )}

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

  const field = "w-full rounded-lg border border-[#d5dbe2] bg-white px-3 py-2";
  const label = "block space-y-1 text-sm font-medium";

  const submit = () => {
    const amountCents = parseEuros(amount);
    if (!name.trim()) return setErr("Indica o nome.");
    if (amountCents === undefined) return setErr("Valor inválido.");
    onSave({ name, category, amountCents, frequency, startMonth, dueDay, notes: notes.trim() || null, active });
  };

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-[#f3f5f7] p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{initial ? "Editar pagamento" : "Novo pagamento"}</h2>
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
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo (aparece no calendário)
        </label>
        <div className="flex gap-2 pt-1">
          <button onClick={submit} className="flex-1 rounded-lg bg-[#2f86c4] py-2 font-semibold text-white">
            Guardar
          </button>
          <button onClick={onClose} className="rounded-lg bg-white px-4 py-2">
            Cancelar
          </button>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="w-full rounded-lg py-2 text-sm text-red-600">
            Apagar pagamento
          </button>
        )}
      </div>
    </div>
  );
}
