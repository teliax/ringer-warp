import {
  LineChart,
  Line,
  XAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSignIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  CreditCardIcon,
  SubscriptIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DownloadIcon,
} from "lucide-react";
import {
  mockBillingOverview,
  mockSpendingData,
  type BillingOverview,
  type SpendingData,
} from "@/polymet/data/billing-mock-data";

interface BillingOverviewProps {
  overview?: BillingOverview;
  spendingData?: SpendingData[];
}

export function BillingOverview({
  overview = mockBillingOverview,
  spendingData = mockSpendingData,
}: BillingOverviewProps) {
  const chartData = spendingData.map((item) => ({
    ...item,
    month: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
  }));

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUpIcon className="w-4 h-4 text-red-500" />;

      case "down":
        return <TrendingDownIcon className="w-4 h-4 text-green-500" />;

      default:
        return <ArrowUpIcon className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return "text-red-500";
      case "down":
        return "text-green-500";
      default:
        return "text-muted-foreground";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Billing Overview</h2>
          <p className="text-muted-foreground">
            Monitor your spending and manage your account
          </p>
        </div>
        <Button variant="outline">
          <DownloadIcon className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Balance
            </CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(overview.currentBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Due {formatDate(overview.nextBillingDate)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(overview.monthToDateSpending)}
            </div>
            <div
              className={`flex items-center text-xs ${getTrendColor(overview.spendingTrend)}`}
            >
              {getTrendIcon(overview.spendingTrend)}
              <span className="ml-1">
                {overview.spendingTrendPercentage}% vs last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Payment Methods
            </CardTitle>
            <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.paymentMethodsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Active payment methods
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <SubscriptIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.activeSubscriptionsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Active subscriptions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spending Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total Spending Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Spending Trend</CardTitle>
            <CardDescription>
              Monthly spending over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="aspect-[none] h-[300px]" config={{}}>
              <ChartTooltip />

              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />

                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tick={{ fontSize: 12 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={3}
                    dot={{ r: 6, fill: "hsl(var(--chart-1))" }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>
              Current month breakdown by service type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="aspect-[none] h-[300px]" config={{}}>
              <ChartTooltip />

              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[chartData[chartData.length - 1]]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />

                  <XAxis dataKey="month" className="text-xs" />

                  <Bar
                    dataKey="voice"
                    fill="hsl(var(--chart-1))"
                    name="Voice"
                    radius={[4, 4, 0, 0]}
                  />

                  <Bar
                    dataKey="messaging"
                    fill="hsl(var(--chart-2))"
                    name="Messaging"
                    radius={[4, 4, 0, 0]}
                  />

                  <Bar
                    dataKey="numbers"
                    fill="hsl(var(--chart-3))"
                    name="Numbers"
                    radius={[4, 4, 0, 0]}
                  />

                  <Bar
                    dataKey="subscriptions"
                    fill="hsl(var(--chart-4))"
                    name="Subscriptions"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Average Monthly Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#58C5C7]">
              {formatCurrency(overview.averageMonthlySpending)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Based on last 6 months
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Month Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(overview.lastMonthSpending)}
            </div>
            <div className="flex items-center mt-1">
              <Badge variant="outline" className="text-xs">
                Paid in full
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Billing Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FBAD18]">
              {formatDate(overview.nextBillingDate)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Estimated amount:{" "}
              {formatCurrency(overview.monthToDateSpending * 1.1)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
