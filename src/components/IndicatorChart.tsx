import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useI18n } from "../i18n";
import type { SeriesPoint } from "../lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export interface ChartSeries {
  label: string;
  color: string;
  points: SeriesPoint[];
  /** Put on a separate right-hand axis — use for series whose scale/unit
   *  isn't guaranteed comparable to the others (e.g. a manually attached
   *  CBS series with no verified concept match), so it doesn't flatten
   *  out next to differently-scaled lines. */
  secondaryAxis?: boolean;
}

interface IndicatorChartProps {
  seriesList: ChartSeries[];
  title: string;
}

export default function IndicatorChart({ seriesList, title }: IndicatorChartProps) {
  const { dir, locale } = useI18n();

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const s of seriesList) {
      for (const p of s.points) set.add(p.year);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [seriesList]);

  const hasSecondaryAxis = seriesList.some((s) => s.secondaryAxis);

  const data: ChartData<"line"> = useMemo(
    () => ({
      labels: years.map(String),
      datasets: seriesList.map((s) => {
        const byYear = new Map(s.points.map((p) => [p.year, p.value]));
        return {
          label: s.label,
          data: years.map((y) => byYear.get(y) ?? null),
          borderColor: s.color,
          backgroundColor: s.color,
          spanGaps: false,
          tension: 0.15,
          yAxisID: s.secondaryAxis ? "y1" : "y",
        };
      }),
    }),
    [years, seriesList],
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      locale,
      scales: {
        x: { reverse: dir === "rtl" },
        y: { position: dir === "rtl" ? "right" : "left" },
        ...(hasSecondaryAxis
          ? {
              y1: {
                position: dir === "rtl" ? "left" : "right",
                grid: { drawOnChartArea: false },
              },
            }
          : {}),
      },
      plugins: {
        legend: { rtl: dir === "rtl", position: "top" },
        tooltip: { rtl: dir === "rtl" },
      },
    }),
    [dir, locale, hasSecondaryAxis],
  );

  return (
    <div>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.5rem" }}>{title}</h3>
      <Line data={data} options={options} />
    </div>
  );
}
