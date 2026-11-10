import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as reportsApi from "../api/reports";
import type { AssetQuoteComparison, PlannedBudgetReportDto } from "../api/types";
import { useCurrency } from "../context/CurrencyContext";
import { Card, PageTitle } from "./ui";

// Recharts takes colors as props, so these mirror the theme tokens in index.css.
const BRAND = "#dfe5eb";
const BRAND_SOFT = "#dfe5eb";
const AMBER = "#f2b84b";
const TANGERINE = "#ef233c";
const MINT = "#3ccf91";
const EMBER = "#ff6b7d";
const MUTED = "#9aa3ad";
const axisTick = { fill: MUTED, fontSize: 11 };
const gridStroke = "#2c3039";
const tooltipStyle = {
  contentStyle: { background: "#1b1d24", border: "1px solid #2c3039", borderRadius: 12, color: "#dfe5eb" },
  labelStyle: { color: "#dfe5eb", fontWeight: 600 },
  itemStyle: { color: "#dfe5eb" },
  cursor: { fill: "rgba(223, 229, 235, 0.06)" },
};

const compactClp = new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 });

type Verdict = "below" | "within" | "above";

// Where the user's estimate falls against the market range the AI found.
function verdictOf(item: AssetQuoteComparison): Verdict {
  if (item.estimatedAmount < item.priceMin!) return "below";
  if (item.estimatedAmount > item.priceMax!) return "above";
  return "within";
}

const VERDICT_TEXT: Record<Verdict, { label: string; color: string }> = {
  below: { label: "Estimaste de menos", color: EMBER },
  within: { label: "Dentro del rango", color: MINT },
  above: { label: "Estimaste de más", color: AMBER },
};

// Reports for the budget the wallet is executing ("Presupuesto planificado").
export function PlannedBudgetReports() {
  const { formatMoney } = useCurrency();
  const [report, setReport] = useState<PlannedBudgetReportDto | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    reportsApi.getPlannedBudget().then(setReport).catch(() => setLoadFailed(true));
  }, []);

  const header = (
    <PageTitle
      title="Presupuesto en ejecución"
      subtitle={
        report?.projectName
          ? `Análisis de "${report.projectName}", el presupuesto que tienes en tu billetera.`
          : "Análisis del presupuesto que tienes en tu billetera."
      }
    />
  );

  if (loadFailed) {
    return (
      <section aria-label="Presupuesto en ejecución" className="mb-10">
        {header}
        <p className="text-sm text-ember">No se pudieron cargar estos reportes.</p>
      </section>
    );
  }
  if (!report) return null;

  if (!report.projectId) {
    return (
      <section aria-label="Presupuesto en ejecución" className="mb-10">
        {header}
        <Card>
          <p className="text-sm text-mid-gray">
            Todavía no tienes un presupuesto en tu billetera. Abre uno en{" "}
            <Link to="/" className="font-semibold text-accent hover:underline">
              Inicio
            </Link>{" "}
            y aprieta "Pasar a la billetera" para ver estos gráficos.
          </p>
        </Card>
      </section>
    );
  }

  const quoted = report.assetQuotes.filter((a) => a.priceMin !== null && a.priceMax !== null);
  const notQuoted = report.assetQuotes.filter((a) => a.priceMin === null || a.priceMax === null);
  // The AI's reference price is the middle of the range it found.
  const quoteData: QuoteDatum[] = quoted.map((a) => {
    const ai = Math.round((a.priceMin! + a.priceMax!) / 2);
    const doubtful = isDoubtful(a.estimatedAmount, ai);
    const shortName = a.name.length > 26 ? `${a.name.slice(0, 25)}…` : a.name;
    return {
      name: doubtful ? `⚠ ${shortName}` : shortName,
      fullName: a.name,
      estimate: a.estimatedAmount,
      ai,
      min: a.priceMin!,
      max: a.priceMax!,
      verdict: verdictOf(a),
      doubtful,
    };
  });
  const doubtfulItems = quoteData.filter((d) => d.doubtful);
  const trusted = quoteData.filter((d) => !d.doubtful);
  const trustedEstimate = trusted.reduce((sum, d) => sum + d.estimate, 0);
  const trustedAi = trusted.reduce((sum, d) => sum + d.ai, 0);
  const verdictCounts = quoteData.reduce<Record<Verdict, number>>(
    (counts, d) => ({ ...counts, [d.verdict]: counts[d.verdict] + 1 }),
    { below: 0, within: 0, above: 0 }
  );
  const estimateTotal = quoteData.reduce((sum, d) => sum + d.estimate, 0);
  const aiTotal = quoteData.reduce((sum, d) => sum + d.ai, 0);
  const { regular, large } = splitByScale(quoteData);

  const typeData = [
    { name: "Activos (compras)", value: report.assetsTotal, color: BRAND },
    { name: "Pasivos (gastos fijos)", value: report.liabilitiesTotal, color: TANGERINE },
  ].filter((d) => d.value > 0);
  const typeTotal = report.assetsTotal + report.liabilitiesTotal;

  return (
    <section aria-label="Presupuesto en ejecución" className="mb-10">
      {header}

      <Card className="mb-6">
        <h2 className="text-lg font-extrabold mb-1">Tu estimado vs. el precio que encontró la IA</h2>
        <p className="text-xs text-mid-gray mb-4">
          Por cada activo: el monto que pusiste en el Excel al lado del precio que encontró la IA en internet (el promedio de su rango).
        </p>

        {quoteData.length === 0 ? (
          <p className="text-sm text-mid-gray py-8 text-center">
            Ningún activo está cotizado todavía. Abre{" "}
            <Link to={`/presupuestos/${report.projectId}`} className="font-semibold text-accent hover:underline">
              el presupuesto
            </Link>{" "}
            y aprieta "Generar presupuesto actualizado".
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-[14px] bg-canvas px-4 py-3">
                <p className="text-xs text-mid-gray">Total que estimaste</p>
                <p className="font-display text-2xl font-extrabold tabular-nums" style={{ color: TANGERINE }}>
                  {formatMoney(estimateTotal)}
                </p>
              </div>
              <div className="rounded-[14px] bg-canvas px-4 py-3">
                <p className="text-xs text-mid-gray">Total según la IA</p>
                <p className="font-display text-2xl font-extrabold tabular-nums text-ink">{formatMoney(aiTotal)}</p>
              </div>
            </div>

            {doubtfulItems.length > 0 && (
              <div role="note" className="mb-4 rounded-[14px] border border-warn/50 bg-warn-soft px-4 py-3 text-sm text-ink">
                <p className="flex items-start gap-2 font-semibold">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" style={{ color: AMBER }} aria-hidden="true" />
                  {doubtfulItems.length === 1
                    ? "Revisa 1 cotización: la IA pudo cotizar un modelo distinto al que pensabas."
                    : `Revisa ${doubtfulItems.length} cotizaciones: la IA pudo cotizar modelos distintos a los que pensabas.`}
                </p>
                <ul className="mt-2 ml-6 space-y-1 text-xs">
                  {doubtfulItems.map((d) => (
                    <li key={d.fullName}>
                      <span className="font-semibold">{d.fullName}:</span> tu estimado {formatMoney(d.estimate)} vs. IA{" "}
                      {formatMoney(d.ai)} ({describeGap(d.estimate, d.ai)}).
                    </li>
                  ))}
                </ul>
                {trusted.length > 0 && (
                  <p className="mt-2 ml-6 text-xs">
                    <span className="font-semibold">Sin ítems dudosos:</span> tú{" "}
                    <span className="font-semibold tabular-nums" style={{ color: TANGERINE }}>
                      {formatMoney(trustedEstimate)}
                    </span>{" "}
                    · IA <span className="font-semibold tabular-nums text-ink">{formatMoney(trustedAi)}</span>
                  </p>
                )}
                <p className="mt-2 ml-6 text-xs text-mid-gray">
                  Para corregirla, abre{" "}
                  <Link to={`/presupuestos/${report.projectId}`} className="font-semibold text-accent hover:underline">
                    el presupuesto
                  </Link>
                  , ponle un nombre más específico al ítem (por ejemplo, el tamaño o la capacidad) y vuelve a cotizar.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-2 text-xs font-semibold">
              {(Object.keys(VERDICT_TEXT) as Verdict[])
                .filter((v) => verdictCounts[v] > 0)
                .map((v) => (
                  <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: VERDICT_TEXT[v].color }} aria-hidden="true" />
                    {VERDICT_TEXT[v].label}: {verdictCounts[v]}
                  </span>
                ))}
            </div>

            <QuoteBars data={regular} formatMoney={formatMoney} />
            {large.length > 0 && (
              <div className="mt-4 border-t border-hairline pt-4">
                <h3 className="text-sm font-semibold">Montos más altos</h3>
                <p className="text-xs text-mid-gray mb-1">Van aparte, en su propia escala, para que no achiquen las barras de arriba.</p>
                <QuoteBars data={large} formatMoney={formatMoney} />
              </div>
            )}
          </>
        )}

        {notQuoted.length > 0 && quoteData.length > 0 && (
          <p className="text-xs text-mid-gray mt-3">
            Sin cotización con precio en pesos: {notQuoted.map((a) => a.name).join(", ")}.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-extrabold mb-1">Presupuesto por categoría</h2>
          <p className="text-xs text-mid-gray mb-3">Cuánto suma cada categoría, de mayor a menor.</p>
          <ResponsiveContainer width="100%" height={Math.max(200, report.byCategory.length * 44 + 40)}>
            <BarChart data={report.byCategory} layout="vertical" margin={{ left: 8, right: 48 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
              <XAxis type="number" tick={axisTick} tickFormatter={(v: number) => compactClp.format(v)} />
              <YAxis type="category" dataKey="category" tick={axisTick} width={120} />
              <Tooltip
                {...tooltipStyle}
                formatter={(value, _name, entry) => [`${formatMoney(Number(value))} (${entry.payload.percent}%)`, "Monto"]}
              />
              <Bar
                dataKey="amount"
                fill={BRAND}
                radius={[0, 8, 8, 0]}
                barSize={18}
                label={{ position: "right", fill: MUTED, fontSize: 11, formatter: (v: unknown) => compactClp.format(Number(v)) }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold mb-1">Activos vs. pasivos</h2>
          <p className="text-xs text-mid-gray mb-3">Qué parte del presupuesto son compras y qué parte son gastos fijos.</p>
          <div className="relative">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={2}>
                  {typeData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value) =>
                    `${formatMoney(Number(value))} (${typeTotal > 0 ? Math.round((Number(value) / typeTotal) * 100) : 0}%)`
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-mid-gray">Total</span>
              <span className="font-display text-lg font-extrabold tabular-nums text-ink">{formatMoney(typeTotal)}</span>
            </div>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {typeData.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} aria-hidden="true" />
                  {d.name}
                </span>
                <span className="tabular-nums font-semibold">
                  {formatMoney(d.value)}{" "}
                  <span className="font-normal text-mid-gray">({typeTotal > 0 ? Math.round((d.value / typeTotal) * 100) : 0}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}

type QuoteDatum = {
  name: string;
  fullName: string;
  estimate: number;
  ai: number;
  min: number;
  max: number;
  verdict: Verdict;
  doubtful: boolean;
};

// A price over 3 times apart from the estimate usually means the AI quoted a different
// product (another size or model), so its number should not be taken at face value.
const DOUBTFUL_RATIO = 3;

function isDoubtful(estimate: number, ai: number) {
  if (estimate <= 0 || ai <= 0) return false;
  return ai / estimate > DOUBTFUL_RATIO || estimate / ai > DOUBTFUL_RATIO;
}

function describeGap(estimate: number, ai: number) {
  const times = ai > estimate ? ai / estimate : estimate / ai;
  const rounded = times >= 10 ? Math.round(times) : Math.round(times * 10) / 10;
  return ai > estimate ? `${rounded.toLocaleString("es-CL")} veces más` : `${rounded.toLocaleString("es-CL")} veces menos`;
}

// Puts items far above the rest (over 4x the median) in a second chart, so one
// expensive asset does not shrink every other bar to a sliver.
function splitByScale(data: QuoteDatum[]) {
  if (data.length < 3) return { regular: data, large: [] as QuoteDatum[] };
  const sizes = data.map((d) => Math.max(d.estimate, d.ai)).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  const isLarge = (d: QuoteDatum) => Math.max(d.estimate, d.ai) > median * 4;
  return { regular: data.filter((d) => !isLarge(d)), large: data.filter(isLarge) };
}

function QuoteBars({ data, formatMoney }: { data: QuoteDatum[]; formatMoney: (n: number) => string }) {
  if (data.length === 0) return null;
  const valueLabel = { position: "right" as const, fill: MUTED, fontSize: 11, formatter: (v: unknown) => compactClp.format(Number(v)) };
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[30rem]">
        <ResponsiveContainer width="100%" height={data.length * 64 + 50}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56 }} barGap={3} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
            <XAxis type="number" tick={axisTick} tickFormatter={(v: number) => compactClp.format(v)} />
            <YAxis type="category" dataKey="name" tick={axisTick} width={180} />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload as QuoteDatum | undefined;
                if (!d) return "";
                const label = `${d.fullName} · ${VERDICT_TEXT[d.verdict].label}`;
                return d.doubtful ? `${label} · Revisa esta cotización` : label;
              }}
              formatter={(value, name, entry) =>
                name === "Precio IA"
                  ? [`${formatMoney(Number(value))} (rango ${formatMoney(entry.payload.min)} – ${formatMoney(entry.payload.max)})`, name]
                  : [formatMoney(Number(value)), name]
              }
            />
            <Legend wrapperStyle={{ color: MUTED, fontSize: 12 }} />
            <Bar dataKey="estimate" name="Tu estimado" fill={TANGERINE} radius={[0, 6, 6, 0]} barSize={14} label={valueLabel} />
            <Bar dataKey="ai" name="Precio IA" fill={BRAND_SOFT} radius={[0, 6, 6, 0]} barSize={14} label={valueLabel} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
