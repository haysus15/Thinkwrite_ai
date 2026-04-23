"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ComponentType, CSSProperties } from "react";
import { evaluate } from "mathjs";

type PlotProps = {
  data: Array<Record<string, unknown>>;
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
  style: CSSProperties;
};

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as unknown as ComponentType<PlotProps>;

export default function MathGraphPanel({
  expression,
  visible,
  onToggle,
  showToggle = true,
}: {
  expression?: string;
  visible: boolean;
  onToggle: () => void;
  showToggle?: boolean;
}) {
  const t = useTranslations();
  const { xValues, yValues } = useMemo(() => {
    if (!expression) return { xValues: [], yValues: [] };
    const xs = Array.from({ length: 41 }).map((_, i) => -10 + i * 0.5);
    const ys = xs.map((x) => {
      try {
        return Number(evaluate(expression, { x }));
      } catch {
        return NaN;
      }
    });
    return { xValues: xs, yValues: ys };
  }, [expression]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">{t("academic.mathMode.graph.title")}</h4>
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300 transition hover:bg-white/[0.08]"
          >
            {visible ? t("global.close") : t("global.view")}
          </button>
        )}
      </div>
      {visible ? (
        <div className="mt-4">
          {expression ? (
            <Plot
              data={[
                {
                  x: xValues,
                  y: yValues,
                  type: "scatter",
                  mode: "lines",
                  line: { color: "#0EA5E9", width: 2 },
                },
              ]}
              layout={{
                paper_bgcolor: "transparent",
                plot_bgcolor: "rgba(255,255,255,0.02)",
                font: { color: "#94a3b8" },
                xaxis: {
                  gridcolor: "rgba(255,255,255,0.05)",
                  zerolinecolor: "rgba(255,255,255,0.1)",
                },
                yaxis: {
                  gridcolor: "rgba(255,255,255,0.05)",
                  zerolinecolor: "rgba(255,255,255,0.1)",
                },
                margin: { t: 20, r: 20, b: 40, l: 40 },
              }}
              config={{ displayModeBar: false }}
              style={{ width: "100%", height: "200px" }}
            />
          ) : (
            <p className="text-sm text-slate-500">
              {t("academic.mathMode.graph.empty")}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{t("academic.mathMode.graph.hidden")}</p>
      )}
    </div>
  );
}
