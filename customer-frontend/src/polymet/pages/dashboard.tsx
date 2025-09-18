import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  PhoneIcon,
  ClockIcon,
  DollarSignIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "lucide-react";
import { UsageChart } from "@/polymet/components/charts";
import { CdrTable } from "@/polymet/components/tables";
import {
  mockUsageMetrics,
  mockCallRecords,
  mockSipTrunks,
} from "@/polymet/data/telecom-mock-data";

export function Dashboard() {
  const recentCalls = mockCallRecords.slice(0, 5);
  const activeTrunks = mockSipTrunks.filter(
    (trunk) => trunk.status === "active"
  );

  // Calculate trunk utilization
  const totalCapacity = mockSipTrunks.reduce(
    (sum, trunk) => sum + trunk.maxConcurrentCalls,
    0
  );
  const currentUsage = mockSipTrunks.reduce(
    (sum, trunk) => sum + trunk.currentCalls,
    0
  );
  const utilizationPercentage = Math.round(
    (currentUsage / totalCapacity) * 100
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your communication platform performance
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <PhoneIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockUsageMetrics.totalCalls.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Minutes</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockUsageMetrics.totalMinutes.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              +8% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${mockUsageMetrics.totalCost}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              +5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockUsageMetrics.successRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              +0.3% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              Current status of your infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />

                <span>SIP Trunks</span>
              </div>
              <Badge variant="default">{activeTrunks.length} Active</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />

                <span>API Gateway</span>
              </div>
              <Badge variant="default">Operational</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />

                <span>CDR Processing</span>
              </div>
              <Badge variant="secondary">Delayed</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trunk Utilization</CardTitle>
            <CardDescription>Current capacity usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{utilizationPercentage}%</div>
              <p className="text-sm text-muted-foreground">
                {currentUsage} of {totalCapacity} channels
              </p>
            </div>
            <Progress value={utilizationPercentage} className="w-full" />

            <div className="text-xs text-muted-foreground">
              Peak usage: {mockUsageMetrics.peakConcurrentCalls} concurrent
              calls
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <UsageChart />

        <CdrTable
          data={recentCalls}
          title="Recent Call Records"
          showFilters={false}
        />
      </div>
    </div>
  );
}
