import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mockUsageMetrics } from "@/polymet/data/telecom-mock-data";

interface UsageChartProps {
  data?: typeof mockUsageMetrics.dailyStats;
  title?: string;
  description?: string;
}

export function UsageChart({
  data = mockUsageMetrics.dailyStats,
  title = "Call Volume & Usage",
  description = "Daily call statistics and costs",
}: UsageChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-[none] h-[300px]" config={{}}>
          <ChartTooltip />

          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fontSize: 12 }}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{label}</p>
                        {payload.map((entry, index) => (
                          <p
                            key={index}
                            className="text-sm"
                            style={{ color: entry.color }}
                          >
                            {entry.name}:{" "}
                            {entry.name === "cost"
                              ? `$${entry.value}`
                              : entry.value}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Legend />

              <Line
                type="monotone"
                dataKey="calls"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                name="Calls"
                dot={{ r: 4 }}
              />

              <Line
                type="monotone"
                dataKey="minutes"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                name="Minutes"
                dot={{ r: 4 }}
              />

              <Line
                type="monotone"
                dataKey="cost"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                name="Cost ($)"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
