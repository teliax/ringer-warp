import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUpIcon,
  TrendingDownIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  DollarSignIcon,
  UsersIcon,
  PhoneIcon,
  BarChart3Icon,
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react";
import {
  mockAdminStats,
  mockCustomerAccounts,
  mockAccountingTransactions,
} from "@/polymet/data/admin-mock-data";
import { mockUsageMetrics } from "@/polymet/data/telecom-mock-data";

interface AdminKpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  color?: string;
}

function AdminKpiCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend = "neutral",
  color = "text-[#58C5C7]",
}: AdminKpiCardProps) {
  const getTrendIcon = () => {
    if (trend === "up")
      return <ArrowUpIcon className="w-3 h-3 text-green-500" />;

    if (trend === "down")
      return <ArrowDownIcon className="w-3 h-3 text-red-500" />;

    return null;
  };

  const getTrendColor = () => {
    if (trend === "up") return "text-green-600";
    if (trend === "down") return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={color}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p
            className={`text-xs flex items-center space-x-1 ${getTrendColor()}`}
          >
            {getTrendIcon()}
            <span>
              {change > 0 ? "+" : ""}
              {change}% {changeLabel}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface AdminAlertProps {
  type: "warning" | "error" | "info" | "success";
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}

function AdminAlert({
  type,
  title,
  message,
  action,
  onAction,
}: AdminAlertProps) {
  const getIcon = () => {
    switch (type) {
      case "warning":
        return <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />;

      case "error":
        return <AlertTriangleIcon className="w-5 h-5 text-red-500" />;

      case "success":
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;

      default:
        return <BarChart3Icon className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case "warning":
        return "border-l-yellow-500";
      case "error":
        return "border-l-red-500";
      case "success":
        return "border-l-green-500";
      default:
        return "border-l-blue-500";
    }
  };

  return (
    <div
      className={`border-l-4 ${getBorderColor()} bg-muted/50 p-4 rounded-r-lg`}
    >
      <div className="flex items-start space-x-3">
        {getIcon()}
        <div className="flex-1">
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
          {action && onAction && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onAction}
            >
              {action}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface AdminAnalyticsProps {
  timeRange?: string;
  showAlerts?: boolean;
}

export function AdminAnalytics({
  timeRange = "30d",
  showAlerts = true,
}: AdminAnalyticsProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);

  // Calculate KPIs
  const totalRevenue = mockAccountingTransactions
    .filter((t) => t.type === "payment" || t.type === "usage")
    .reduce((sum, t) => sum + t.amount, 0);

  const activeCustomers = mockCustomerAccounts.filter(
    (c) => c.status === "active"
  ).length;
  const totalCustomers = mockCustomerAccounts.length;
  const customerGrowthRate = 12.5; // Mock growth rate

  const totalCalls = mockUsageMetrics.totalCalls;
  const successRate = mockUsageMetrics.successRate;
  const avgCallDuration = mockUsageMetrics.averageCallDuration;

  // System health metrics
  const systemHealth = {
    apiUptime: 99.9,
    trunkUtilization: 67,
    errorRate: 0.1,
    responseTime: 145,
  };

  // Alerts and notifications
  const alerts = [
    {
      type: "warning" as const,
      title: "High Trunk Utilization",
      message: "Trunk utilization is at 67%. Consider adding capacity.",
      action: "View Trunks",
      onAction: () => console.log("Navigate to trunk management"),
    },
    {
      type: "info" as const,
      title: "Monthly Report Ready",
      message: "Your monthly analytics report is ready for download.",
      action: "Download",
      onAction: () => console.log("Download report"),
    },
    {
      type: "success" as const,
      title: "Revenue Target Met",
      message: "Monthly revenue target of $50K has been achieved.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <BarChart3Icon className="w-5 h-5 text-[#58C5C7]" />

            <span>Analytics Overview</span>
          </h3>
          <p className="text-sm text-muted-foreground">
            Key performance indicators and system insights
          </p>
        </div>
        <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AdminKpiCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          change={8.2}
          changeLabel="from last month"
          icon={<DollarSignIcon className="w-4 h-4" />}
          trend="up"
        />

        <AdminKpiCard
          title="Active Customers"
          value={activeCustomers}
          change={customerGrowthRate}
          changeLabel="growth rate"
          icon={<UsersIcon className="w-4 h-4" />}
          trend="up"
        />

        <AdminKpiCard
          title="Total Calls"
          value={totalCalls.toLocaleString()}
          change={5.7}
          changeLabel="from last month"
          icon={<PhoneIcon className="w-4 h-4" />}
          trend="up"
        />

        <AdminKpiCard
          title="Success Rate"
          value={`${successRate}%`}
          change={0.3}
          changeLabel="improvement"
          icon={<CheckCircleIcon className="w-4 h-4" />}
          trend="up"
        />
      </div>

      {/* System Health Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3Icon className="w-5 h-5 text-[#58C5C7]" />

              <span>System Health</span>
            </CardTitle>
            <CardDescription>
              Real-time platform performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">API Uptime</span>
                <span className="text-sm">{systemHealth.apiUptime}%</span>
              </div>
              <Progress value={systemHealth.apiUptime} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Trunk Utilization</span>
                <span className="text-sm">
                  {systemHealth.trunkUtilization}%
                </span>
              </div>
              <Progress value={systemHealth.trunkUtilization} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {systemHealth.errorRate}%
                </div>
                <div className="text-xs text-muted-foreground">Error Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {systemHealth.responseTime}ms
                </div>
                <div className="text-xs text-muted-foreground">
                  Avg Response
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UsersIcon className="w-5 h-5 text-[#58C5C7]" />

              <span>Customer Insights</span>
            </CardTitle>
            <CardDescription>Customer base analysis and trends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{totalCustomers}</div>
                <div className="text-xs text-muted-foreground">
                  Total Customers
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {((activeCustomers / totalCustomers) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Active Rate</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Enterprise</span>
                <Badge className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">12</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Mid-Market</span>
                <Badge variant="secondary">28</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Small Business</span>
                <Badge variant="outline">35</Badge>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span>Avg Monthly Spend</span>
                <span className="font-medium">
                  $
                  {Math.round(
                    mockCustomerAccounts.reduce(
                      (sum, c) => sum + c.monthlySpend,
                      0
                    ) / mockCustomerAccounts.length
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Notifications */}
      {showAlerts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangleIcon className="w-5 h-5 text-[#FBAD18]" />

              <span>Alerts & Notifications</span>
            </CardTitle>
            <CardDescription>
              Important system alerts and business notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <AdminAlert key={index} {...alert} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-[#58C5C7]" />

            <span>Quick Actions</span>
          </CardTitle>
          <CardDescription>
            Common administrative tasks and reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col space-y-2"
            >
              <BarChart3Icon className="w-6 h-6 text-[#58C5C7]" />

              <span>Generate Report</span>
              <span className="text-xs text-muted-foreground">
                Create monthly analytics report
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col space-y-2"
            >
              <UsersIcon className="w-6 h-6 text-[#58C5C7]" />

              <span>Customer Review</span>
              <span className="text-xs text-muted-foreground">
                Review pending accounts
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col space-y-2"
            >
              <DollarSignIcon className="w-6 h-6 text-[#58C5C7]" />

              <span>Billing Audit</span>
              <span className="text-xs text-muted-foreground">
                Review billing discrepancies
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
