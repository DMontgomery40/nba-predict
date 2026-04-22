export const chartAxisColor = "#a9b8c7";
export const chartGridColor = "rgba(255, 255, 255, 0.1)";
export const chartTextColor = "#f3f7fb";
export const chartTooltipBackground = "rgba(10, 14, 19, 0.96)";
export const chartTooltipBorder = "1px solid rgba(255, 255, 255, 0.12)";

export const chartLegendStyle = {
  color: chartTextColor,
};

export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: chartTooltipBackground,
    border: chartTooltipBorder,
    borderRadius: "0.9rem",
    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.35)",
    color: chartTextColor,
  },
  itemStyle: {
    color: chartTextColor,
  },
  labelStyle: {
    color: chartAxisColor,
  },
};

export const marketChartPalette = [
  "#69d7a5",
  "#7ac7ff",
  "#f4c96f",
  "#ff8e78",
  "#9ad977",
  "#ffd58d",
];

export const sourceSeriesColors: Record<string, string> = {
  bet365: "#69d7a5",
  kalshi: "#7ac7ff",
  polymarket: "#f4c96f",
};
