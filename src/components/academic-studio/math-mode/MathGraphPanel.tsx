"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { evaluate } from "mathjs";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function MathGraphPanel({
  expression,
  visible,
  onToggle,
}: {
  expression?: string;
  visible: boolean;
  onToggle: () => void;
}) {
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
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">Graph</h4>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-slate-300"
        >
          {visible ? "Hide" : "Show"}
        </button>
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
            <p className="text-sm text-slate-400">
              Add a graph expression to visualize the function.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">Graph hidden.</p>
      )}
    </div>
  );
}
