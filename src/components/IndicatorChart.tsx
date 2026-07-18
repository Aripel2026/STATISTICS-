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
      },
      plugins: {
        legend: { rtl: dir === "rtl", position: "top" },
        tooltip: { rtl: dir === "rtl" },
      },
    }),
    [dir, locale],
  );

  return (
    <div>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.5rem" }}>{title}</h3>
      <Line data={data} options={options} />
    </div>
  );
}
