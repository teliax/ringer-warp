import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  mockRevenueData,
  mockCustomerGrowthData,
  mockAdminStats,
} from "@/polymet/data/admin-mock-data";
import { mockUsageMetrics } from "@/polymet/data/telecom-mock-data";

interface AdminRevenueChartProps {
  data?: typeof mockRevenueData;
  title?: string;
  description?: string;
}

export function AdminRevenueChart({
  data = mockRevenueData,
  title = "Revenue Analytics",
  description = "Monthly revenue and growth trends across all customers",
}: AdminRevenueChartProps) {
  const [timeRange, setTimeRange] = useState("6m");

  const chartData = data.map((item) => ({
    ...item,
    month: new Date(item.month).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="12m">12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-[none] h-[350px]" config={{}}>
          <ChartTooltip />

          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

              <XAxis
                dataKey="month"
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
                            {entry.name}: ${entry.value?.toLocaleString()}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Legend />

              <Area
                type="monotone"
                dataKey="totalRevenue"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.3}
                name="Total Revenue"
              />

              <Area
                type="monotone"
                dataKey="recurringRevenue"
                stroke="hsl(var(--chart-2))"
                fill="hsl(var(--chart-2))"
                fillOpacity={0.3}
                name="Recurring Revenue"
              />

              <Area
                type="monotone"
                dataKey="usageRevenue"
                stroke="hsl(var(--chart-3))"
                fill="hsl(var(--chart-3))"
                fillOpacity={0.3}
                name="Usage Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface AdminCustomerGrowthChartProps {
  data?: typeof mockCustomerGrowthData;
  title?: string;
  description?: string;
}

export function AdminCustomerGrowthChart({
  data = mockCustomerGrowthData,
  title = "Customer Growth Analytics",
  description = "Customer acquisition, churn, and net growth trends",
}: AdminCustomerGrowthChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    month: new Date(item.month).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-[none] h-[350px]" config={{}}>
          <ChartTooltip />

          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

              <XAxis
                dataKey="month"
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
                            {entry.name}: {entry.value}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Legend />

              <Bar
                dataKey="newCustomers"
                fill="hsl(var(--chart-1))"
                name="New Customers"
                radius={[4, 4, 0, 0]}
              />

              <Bar
                dataKey="churnedCustomers"
                fill="hsl(var(--chart-2))"
                name="Churned Customers"
                radius={[4, 4, 0, 0]}
              />

              <Bar
                dataKey="netGrowth"
                fill="hsl(var(--chart-3))"
                name="Net Growth"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface AdminSystemMetricsChartProps {
  data?: typeof mockUsageMetrics.dailyStats;
  title?: string;
  description?: string;
}

export function AdminSystemMetricsChart({
  data = mockUsageMetrics.dailyStats,
  title = "System Performance Metrics",
  description = "Platform-wide call volume, quality, and cost analytics",
}: AdminSystemMetricsChartProps) {
  const [metricType, setMetricType] = useState("volume");

  const chartData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    successRate: ((item.calls - item.calls * 0.02) / item.calls) * 100, // Mock success rate
    avgCostPerMinute: item.cost / item.minutes,
  }));

  const getMetricConfig = () => {
    switch (metricType) {
      case "volume":
        return {
          dataKey: "calls",
          name: "Call Volume",
          color: "hsl(var(--chart-1))",
        };
      case "quality":
        return {
          dataKey: "successRate",
          name: "Success Rate (%)",
          color: "hsl(var(--chart-2))",
        };
      case "cost":
        return {
          dataKey: "avgCostPerMinute",
          name: "Avg Cost/Min ($)",
          color: "hsl(var(--chart-3))",
        };
      default:
        return {
          dataKey: "calls",
          name: "Call Volume",
          color: "hsl(var(--chart-1))",
        };
    }
  };

  const metric = getMetricConfig();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Select value={metricType} onValueChange={setMetricType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="volume">Call Volume</SelectItem>
              <SelectItem value="quality">Success Rate</SelectItem>
              <SelectItem value="cost">Cost Analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-[none] h-[300px]" config={{}}>
          <ChartTooltip />

          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
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
                            {metricType === "cost"
                              ? `$${Number(entry.value).toFixed(4)}`
                              : metricType === "quality"
                                ? `${Number(entry.value).toFixed(1)}%`
                                : entry.value}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Line
                type="monotone"
                dataKey={metric.dataKey}
                stroke={metric.color}
                strokeWidth={3}
                name={metric.name}
                dot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface AdminCustomerDistributionProps {
  title?: string;
  description?: string;
}

export function AdminCustomerDistribution({
  title = "Customer Distribution",
  description = "Customer segmentation by status and revenue",
}: AdminCustomerDistributionProps) {
  const statusData = [
    {
      name: "Active",
      value: mockAdminStats.activeCustomers,
      color: "hsl(var(--chart-1))",
    },
    { name: "Suspended", value: 8, color: "hsl(var(--chart-2))" },
    { name: "Pending", value: 5, color: "hsl(var(--chart-3))" },
    { name: "Inactive", value: 3, color: "hsl(var(--chart-4))" },
  ];

  const revenueSegments = [
    { name: "Enterprise ($10K+)", value: 12, color: "hsl(var(--chart-1))" },
    { name: "Mid-Market ($1K-10K)", value: 28, color: "hsl(var(--chart-2))" },
    { name: "Small Business (<$1K)", value: 35, color: "hsl(var(--chart-3))" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Status</CardTitle>
          <CardDescription>Distribution by account status</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer className="aspect-square h-[250px]" config={{}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-sm">Count: {data.value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="flex flex-wrap gap-2 mt-4">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />

                <span className="text-sm">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Segments</CardTitle>
          <CardDescription>
            Customer distribution by monthly spend
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer className="aspect-square h-[250px]" config={{}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueSegments}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {revenueSegments.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-sm">Customers: {data.value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="flex flex-wrap gap-2 mt-4">
            {revenueSegments.map((item) => (
              <div key={item.name} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />

                <span className="text-sm">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
