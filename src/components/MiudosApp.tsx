"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// App web-mobile "Miúdos 2026": sem login, protegida por uma chave guardada
// neste dispositivo (localStorage). Qualquer pessoa com a chave vê e altera os dias.

interface Data {
  year: number;
  S: string;
  notes: Record<string, string>;
  holidays: Record<string, string>;
  manual: string[];
}

const Y = 2026;
const MS = 86400000;
const D0 = Date.UTC(Y, 0, 1);
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WDL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const TAG = " (atualização manual)";
const AUTO = /^Ficam com (o Bruno|a Rita) \(atualização manual\)$/;
const KEY_TOKEN = "miudos:token";

const idx = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - D0) / MS);
};
const isoOf = (i: number) => new Date(D0 + i * MS).toISOString().slice(0, 10);
const dt = (i: number) => new Date(D0 + i * MS);
const fmt = (i: number) => {
  const d = dt(i);
  return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
};
const fmtLong = (i: number) => {
  const d = dt(i);
  return `${WDL[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
};
const localToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const bg = (c: string) => (c === "B" ? "bg-[#5fa83a]" : c === "R" ? "bg-[#2f86c4]" : "bg-[#b9c0c9]");

const KIDS = {
  Francisco: ["Todos os livros", "Computador", "Saco de futebol (chuteiras, camisola, calções e meias)", "Aparelho", "Livro que está a ler", "T-shirt de ginástica"],
  Manuel: ["Aparelho", "Livro que está a ler", "Equipamento de ginástica", "Raquete de ténis"],
};

function readToken() {
  try {
    return localStorage.getItem(KEY_TOKEN) || "";
  } catch {
    return "";
  }
}

export default function MiudosApp() {
  const [token, setToken] = useState<string | null>(null); // null = a ler do dispositivo
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [sel, setSel] = useState(0);
  const today = useMemo(localToday, []);

  const load = useCallback(async (t: string) => {
    try {
      const res = await fetch("/api/miudos", { headers: { "x-miudos-token": t }, cache: "no-store" });
      if (res.status === 401) {
        try {
          localStorage.removeItem(KEY_TOKEN);
        } catch {}
        setToken("");
        setData(null);
        setError("Chave inválida.");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Não foi possível carregar.");
        return;
      }
      setData(await res.json());
      setError("");
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  // chave: ?token=... no link (guarda e limpa o endereço) ou a guardada no dispositivo
  useEffect(() => {
    const u = new URL(window.location.href);
    const fromUrl = u.searchParams.get("token");
    if (fromUrl) {
      try {
        localStorage.setItem(KEY_TOKEN, fromUrl);
      } catch {}
      u.searchParams.delete("token");
      window.history.replaceState(null, "", u.pathname + u.search);
    }
    setToken(fromUrl || readToken());
    const i = idx(localToday());
    setSel(i >= 0 && i < 365 ? i : 0);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/miudos-sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token);
    const onVis = () => document.visibilityState === "visible" && load(token);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [token, load]);

  if (token === null) return null;
  if (!token || !data) {
    return <Gate error={error} loading={!!token && !error} offline={offline} onSubmit={(t) => { try { localStorage.setItem(KEY_TOKEN, t); } catch {} setError(""); setToken(t); }} />;
  }
  return <Calendar data={data} token={token} sel={sel} setSel={setSel} today={today} reload={() => load(token)} offline={offline} />;
}

function Gate({ error, loading, offline, onSubmit }: { error: string; loading: boolean; offline: boolean; onSubmit: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="mx-auto mt-10 max-w-sm space-y-4 rounded-2xl border border-[#e0e4ea] bg-white p-5">
      <h1 className="text-2xl font-extrabold">Miúdos 2026</h1>
      {loading ? (
        <p className="text-sm text-[#5d6977]">{offline ? "Sem ligação. Tenta outra vez quando houver rede." : "A carregar…"}</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (v.trim()) onSubmit(v.trim());
          }}
        >
          <label className="block text-sm font-semibold text-[#5d6977]" htmlFor="chave">
            Chave de acesso (fica guardada neste telemóvel)
          </label>
          <input id="chave" type="password" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} className="w-full rounded-xl border border-[#e0e4ea] bg-[#f3f5f7] px-3 py-3 text-lg" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="min-h-[46px] w-full rounded-xl bg-[#1d2530] font-semibold text-white">Entrar</button>
        </form>
      )}
    </div>
  );
}

function Calendar({ data, token, sel, setSel, today, reload, offline }: { data: Data; token: string; sel: number; setSel: (i: number) => void; today: string; reload: () => void; offline: boolean }) {
  const { S, notes: NOTES, holidays: HOL } = data;
  const manual = useMemo(() => new Set(data.manual), [data.manual]);
  const iso = isoOf(sel);
  const c = S[sel];

  const run = (i: number): [number, number] => {
    let a = i, b = i;
    while (a > 0 && S[a - 1] === S[i]) a--;
    while (b < S.length - 1 && S[b + 1] === S[i]) b++;
    return [a, b];
  };
  const nameOf = (w: string) => (w === "B" ? "Contigo" : w === "R" ? "Rita" : "—");

  const [a, b] = run(sel);
  const n = b - a + 1;
  let nextB: [number, number] | null = null;
  if (c === "R") {
    let k = b + 1;
    while (k < S.length && S[k] !== "B") k++;
    if (k < S.length) nextB = run(k);
  }
  const swap = c !== "?" && sel > 0 && S[sel - 1] !== "?" && S[sel - 1] !== c;
  const dayNotes = (NOTES[iso] || "").split(" | ").filter(Boolean);

  // semana (seg a dom)
  const dow = (dt(sel).getUTCDay() + 6) % 7;
  const mon = sel - dow;

  // próximos períodos
  const periods: [number, number][] = [];
  for (let i = run(sel)[0]; i < S.length && periods.length < 6; ) {
    const r = run(i);
    periods.push(r);
    i = r[1] + 1;
  }

  const m = dt(sel).getUTCMonth();
  let nb = 0, nr = 0;
  for (let k = 0; k < S.length; k++) if (dt(k).getUTCMonth() === m) { if (S[k] === "B") nb++; else if (S[k] === "R") nr++; }
  const yb = [...S].filter((x) => x === "B").length;
  const yr = [...S].filter((x) => x === "R").length;

  const go = (i: number) => i >= 0 && i < 365 && setSel(i);
  const swapDay = swap ? "Dia de troca: ver a lista para a troca, mais abaixo" : "";
  const statusBg = c === "B" ? "bg-[#e2f2d8] text-[#2c5716]" : c === "R" ? "bg-[#dcecf8] text-[#12466d]" : "bg-[#eceff2]";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Miúdos 2026</h1>
        <div className="flex gap-3 text-sm text-[#5d6977]">
          <span><i className="mr-1 inline-block h-3 w-3 rounded bg-[#5fa83a] align-middle" />Bruno</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded bg-[#2f86c4] align-middle" />Rita</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded align-middle ring-2 ring-inset ring-[#e8a100]" />Feriado</span>
        </div>
      </div>
      {offline && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Sem ligação: a mostrar a última versão. Só consegues alterar dias com rede.</p>}

      <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e0e4ea] bg-white p-4">
          <div className="flex gap-2">
            <button className={btn} aria-label="Dia anterior" onClick={() => go(sel - 1)}>‹</button>
            <input
              type="date" min="2026-01-01" max="2026-12-31" value={iso}
              onChange={(e) => e.target.value && go(idx(e.target.value))}
              className="min-w-0 flex-1 rounded-xl border border-[#e0e4ea] bg-[#f3f5f7] px-2 py-2 text-base font-semibold"
            />
            <button className={btn} aria-label="Dia seguinte" onClick={() => go(sel + 1)}>›</button>
            <button className={btn} onClick={() => { const i = idx(today); go(i < 0 ? 0 : i > 364 ? 364 : i); }}>Hoje</button>
          </div>

          <div className={`flex flex-col gap-1 rounded-xl p-4 ${statusBg}`} aria-live="polite">
            <div className="text-sm font-semibold opacity-85">
              {fmtLong(sel).replace(/^./, (x) => x.toUpperCase())}{iso === today ? " · hoje" : ""}{manual.has(iso) ? " · alterado" : ""}
            </div>
            {c === "?" ? (
              <>
                <div className="text-3xl font-extrabold leading-tight">Sem indicação</div>
                <div>O calendário não diz com quem ficam neste dia.</div>
              </>
            ) : (
              <>
                <div className="text-3xl font-extrabold leading-tight">{c === "B" ? "Estão contigo" : "Estão com a Rita"}</div>
                <div>
                  {n === 1 ? "Só este dia" : `De ${fmt(a)} a ${fmt(b)} (${n} dias)`}
                  {n > 1 && b - sel + 1 > 1 && sel !== a ? ` · faltam ${b - sel + 1} dias` : ""}
                </div>
                {nextB && (
                  <div>
                    Próxima vez contigo: <b>{fmt(nextB[0])}</b>{nextB[1] > nextB[0] ? ` a ${fmt(nextB[1])}` : ""} (daqui a {nextB[0] - sel} {nextB[0] - sel === 1 ? "dia" : "dias"})
                  </div>
                )}
              </>
            )}
            {swapDay && <div className="mt-1 text-sm font-bold">{swapDay}</div>}
            {HOL[iso] && <div className="mt-1 text-sm">Feriado: {HOL[iso]}</div>}
            {dayNotes.map((t, i) => <div key={i} className="mt-1 text-sm">• {t}</div>)}
          </div>

          <EditDay key={iso} iso={iso} current={c} notes={dayNotes} isManual={manual.has(iso)} token={token} onSaved={reload} />

          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold text-[#5d6977]">Semana de {fmt(Math.max(mon, 0))}</div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }, (_, k) => mon + k).map((i) =>
                i < 0 || i > 364 ? <div key={i} /> : (
                  <button key={i} onClick={() => setSel(i)} aria-label={fmtLong(i)}
                    className={`flex flex-col rounded-lg py-1.5 text-white ${bg(S[i])} ${i === sel ? "ring-2 ring-[#1d2530] ring-offset-2" : ""}`}>
                    <small className="text-[11px] uppercase opacity-90">{WD[dt(i).getUTCDay()]}</small>
                    <b className="text-[17px]">{dt(i).getUTCDate()}</b>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-[#e0e4ea] bg-white p-4">
          <h2 className="font-bold">Próximos períodos</h2>
          <ul>
            {periods.map(([x, y]) => (
              <li key={x} className="flex items-center gap-2 border-t border-[#e0e4ea] py-2 first:border-0">
                <i className={`h-2.5 w-2.5 flex-none rounded-full ${bg(S[x])}`} />
                <span className="min-w-[70px] font-semibold">{nameOf(S[x])}</span>
                <span className="text-[#5d6977]">{x === y ? fmt(x) : `${fmt(x)} → ${fmt(y)}`}</span>
                <span className="ml-auto whitespace-nowrap text-sm text-[#5d6977]">{y - x + 1} {y - x ? "dias" : "dia"}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Stat n={nb} t={`dias contigo em ${MONTHS[m]}`} cls="text-[#5fa83a]" />
            <Stat n={nr} t={`dias com a Rita em ${MONTHS[m]}`} cls="text-[#2f86c4]" />
            <Stat n={`${yb} / ${yr}`} t="no ano (tu / Rita)" cls="" />
          </div>
        </div>
      </section>

      <Checklist today={today} S={S} />

      <section className="rounded-2xl border border-[#e0e4ea] bg-white p-4">
        <h2 className="mb-3 font-bold">Ano completo</h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {MONTHS.map((name, mi) => {
            const days = new Date(Date.UTC(Y, mi + 1, 0)).getUTCDate();
            const off = (new Date(Date.UTC(Y, mi, 1)).getUTCDay() + 6) % 7;
            return (
              <div key={name}>
                <h3 className="mb-1 text-sm font-bold capitalize">{name}</h3>
                <div className="grid grid-cols-7 gap-[2px]">
                  {["s", "t", "q", "q", "s", "s", "d"].map((w, k) => <div key={k} className="text-center text-[10px] font-semibold uppercase text-[#5d6977]">{w}</div>)}
                  {Array.from({ length: off }, (_, k) => <div key={"o" + k} />)}
                  {Array.from({ length: days }, (_, k) => {
                    const i = idx(`${Y}-${String(mi + 1).padStart(2, "0")}-${String(k + 1).padStart(2, "0")}`);
                    const di = isoOf(i);
                    return (
                      <button key={k} onClick={() => { setSel(i); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        aria-label={`${fmtLong(i)}: ${S[i] === "B" ? "Bruno" : S[i] === "R" ? "Rita" : "sem indicação"}`}
                        className={`relative aspect-square rounded text-[11px] font-semibold text-white ${bg(S[i])} ${HOL[di] ? "ring-2 ring-inset ring-[#e8a100]" : ""} ${i === sel ? "outline outline-2 outline-offset-1 outline-[#1d2530]" : ""} ${di === today ? "underline underline-offset-2" : ""}`}>
                        {k + 1}
                        {(NOTES[di] || manual.has(di)) && <span className="absolute right-[2px] top-[2px] h-[5px] w-[5px] rounded-full bg-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <p className="max-w-prose text-xs text-[#5d6977]">Os pontos brancos marcam dias com nota ou alteração. As alterações ficam guardadas para todos os que têm a chave.</p>
    </div>
  );
}

const btn = "min-h-[46px] rounded-xl border border-[#e0e4ea] bg-white px-3.5 font-semibold";

function Stat({ n, t, cls }: { n: number | string; t: string; cls: string }) {
  return (
    <div className="min-w-[110px] flex-1 rounded-xl border border-[#e0e4ea] px-3 py-2">
      <b className={`block text-xl ${cls}`}>{n}</b>
      <span className="text-sm text-[#5d6977]">{t}</span>
    </div>
  );
}

function EditDay({ iso, current, notes, isManual, token, onSaved }: { iso: string; current: string; notes: string[]; isManual: boolean; token: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(current);
  const [text, setText] = useState(notes.join("\n"));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(method: "PUT" | "DELETE", body?: unknown) {
    setBusy(true);
    setMsg("A guardar…");
    try {
      const res = await fetch(`/api/miudos/${iso}`, {
        method,
        headers: { "x-miudos-token": token, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error();
      setMsg("Guardado.");
      onSaved();
    } catch {
      setMsg("Não foi possível guardar. Tenta outra vez.");
    }
    setBusy(false);
  }

  function save() {
    const changedOwner = (who === "B" || who === "R") && who !== current;
    let lines = text.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!changedOwner && lines.join(" | ") === notes.join(" | ")) return setMsg("Não há alterações para guardar.");
    lines = lines.filter((x) => !(changedOwner && AUTO.test(x))).map((x) => (notes.includes(x) || x.endsWith(TAG) ? x : x + TAG));
    if (changedOwner) lines.push(`Ficam com ${who === "B" ? "o Bruno" : "a Rita"}${TAG}`);
    call("PUT", { ...(changedOwner ? { who } : {}), notes: lines.join(" | ") });
  }

  if (!open) {
    return <button className={`${btn} w-full border-dashed`} onClick={() => setOpen(true)}>Alterar este dia</button>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[#e0e4ea] p-3">
      <div className="text-xs font-bold uppercase tracking-wider text-[#5d6977]">Alterar este dia</div>
      <div className="flex gap-2" role="group" aria-label="Com quem ficam">
        {([["B", "Contigo", "bg-[#5fa83a] border-[#5fa83a]"], ["R", "Rita", "bg-[#2f86c4] border-[#2f86c4]"]] as const).map(([w, label, on]) => (
          <button key={w} type="button" aria-pressed={who === w} onClick={() => setWho(w)}
            className={`min-h-[44px] flex-1 rounded-xl border-2 font-bold ${who === w ? `${on} text-white` : "border-[#e0e4ea] bg-white"}`}>{label}</button>
        ))}
      </div>
      <label htmlFor="notas" className="text-sm font-semibold text-[#5d6977]">Notas, uma por linha. As novas ficam marcadas como atualização manual.</label>
      <textarea id="notas" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: 18:00 ir buscar ao futebol"
        className="w-full rounded-xl border border-[#e0e4ea] bg-[#f3f5f7] px-3 py-2 text-base" />
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy} onClick={save} className="min-h-[46px] rounded-xl bg-[#1d2530] px-5 font-semibold text-white disabled:opacity-60">Guardar</button>
        {isManual && <button disabled={busy} onClick={() => confirm("Voltar ao calendário original neste dia?") && call("DELETE")} className={btn}>Repor original</button>}
        <button disabled={busy} onClick={() => setOpen(false)} className={btn}>Fechar</button>
        <span className="text-sm text-[#5d6977]" role="status">{msg}</span>
      </div>
    </div>
  );
}

// lista da troca: marcações guardadas neste dispositivo, por troca
function Checklist({ today, S }: { today: string; S: string }) {
  const t = Math.min(Math.max(idx(today), 0), 364);
  let k = t;
  while (k > 0 && !(S[k - 1] !== S[k] && S[k - 1] !== "?" && S[k] !== "?")) k--;
  const KEY = "troca:" + isoOf(k);
  const [st, setSt] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setSt(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { setSt({}); }
  }, [KEY]);
  const keys = Object.entries(KIDS).flatMap(([kid, items]) => items.map((_, i) => `${kid}:${i}`));
  const save = (next: Record<string, boolean>) => {
    setSt(next);
    try { Object.keys(next).length ? localStorage.setItem(KEY, JSON.stringify(next)) : localStorage.removeItem(KEY); } catch {}
  };
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#e0e4ea] bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">Lista para a troca</h2>
        <span className="text-sm text-[#5d6977]">{keys.filter((x) => st[x]).length} de {keys.length}</span>
      </div>
      <p className="text-sm text-[#5d6977]">Sempre que passam da Rita para ti, ou de ti para a Rita, confirma que levam isto. As marcações começam do zero em cada troca.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(KIDS).map(([kid, items]) => (
          <div key={kid}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#5d6977]">{kid}</h3>
            {items.map((it, i) => {
              const key = `${kid}:${i}`;
              return (
                <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-2">
                  <input type="checkbox" checked={!!st[key]} onChange={(e) => save({ ...st, [key]: e.target.checked })} className="h-5 w-5 flex-none accent-[#5fa83a]" />
                  <span className={st[key] ? "text-[#5d6977] line-through" : ""}>{it}</span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
      <div><button className={btn} onClick={() => save({})}>Desmarcar tudo</button></div>
    </section>
  );
}
