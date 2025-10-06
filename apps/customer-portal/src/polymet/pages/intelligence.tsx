import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  BrainIcon,
  TrendingUpIcon,
  DollarSignIcon,
  ClockIcon,
  SearchIcon,
  FilterIcon,
  DownloadIcon,
  ExternalLinkIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ZapIcon,
} from "lucide-react";
import {
  mockTeliqueUsageMetrics,
  mockTeliqueLogRecords,
  type TeliqueLogRecord,
} from "@/polymet/data/telecom-mock-data";

export function Intelligence() {
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredLogs = mockTeliqueLogRecords.filter((log) => {
    const matchesSearch =
      log.clientIp.includes(searchTerm) ||
      log.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userAgent.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesService =
      serviceFilter === "all" || log.serviceType === serviceFilter;

    const matchesStatus =
      statusFilter === "all" || log.statusCode.toString() === statusFilter;

    return matchesSearch && matchesService && matchesStatus;
  });

  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <Badge className="bg-green-500 hover:bg-green-600">Success</Badge>;
    } else if (statusCode >= 400 && statusCode < 500) {
      return <Badge variant="destructive">Client Error</Badge>;
    } else if (statusCode >= 500) {
      return <Badge variant="destructive">Server Error</Badge>;
    }
    return <Badge variant="secondary">{statusCode}</Badge>;
  };

  const formatLatency = (seconds: number) => {
    return `${(seconds * 1000).toFixed(1)}ms`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatCost = (cost?: number) => {
    return cost ? `$${cost.toFixed(3)}` : "-";
  };

  // Chart data preparation
  const dailyChartData = mockTeliqueUsageMetrics.dailyStats.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const serviceChartData = mockTeliqueUsageMetrics.serviceBreakdown;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <BrainIcon className="w-8 h-8 text-[#58C5C7]" />

            <span>Telecom Data</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Telecom data for routing, billing and analytics.
          </p>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" asChild>
            <a
              href="https://ringer.tel/database-api-tool"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              Telique Tool
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a
              href="https://docs.ringer.tel"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              Documentation
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <ZapIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockTeliqueUsageMetrics.totalQueries.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              +15% from last month
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
              ${mockTeliqueUsageMetrics.totalCost}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              +8% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatLatency(mockTeliqueUsageMetrics.averageLatency)}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              -5% from last month
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
              {mockTeliqueUsageMetrics.successRate}%
            </div>
            <Progress
              value={mockTeliqueUsageMetrics.successRate}
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="logs">Query Logs</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Usage Trends</CardTitle>
                <CardDescription>
                  Query volume and costs over the last 7 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="aspect-[none] h-[300px]" config={{}}>
                  <ChartTooltip />

                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />

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

                      <Line
                        type="monotone"
                        dataKey="queries"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        name="Queries"
                        dot={{ r: 4 }}
                      />

                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        name="Cost ($)"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Service Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Service Usage Breakdown</CardTitle>
                <CardDescription>
                  Query distribution by Telique service type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {serviceChartData.map((service, index) => {
                    const percentage = Math.round(
                      (service.queries / mockTeliqueUsageMetrics.totalQueries) *
                        100
                    );
                    return (
                      <div key={service.serviceType} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">
                            {service.serviceType}
                          </span>
                          <span className="text-muted-foreground">
                            {service.queries.toLocaleString()} ({percentage}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />

                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>${service.cost}</span>
                          <span>
                            {formatLatency(service.averageLatency)} avg
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent API Activity</CardTitle>
              <CardDescription>
                Latest Telique API queries and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Client IP</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTeliqueLogRecords.slice(0, 5).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {log.serviceType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.clientIp}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.statusCode)}</TableCell>
                        <TableCell>
                          {formatLatency(log.latencySeconds)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCost(log.cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Service Performance</CardTitle>
                <CardDescription>
                  Average latency by service type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="aspect-[none] h-[300px]" config={{}}>
                  <ChartTooltip />

                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />

                      <XAxis
                        dataKey="serviceType"
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                      />

                      <Tooltip />

                      <Bar
                        dataKey="averageLatency"
                        fill="hsl(var(--chart-3))"
                        radius={[4, 4, 0, 0]}
                        name="Avg Latency (s)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Cost Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis</CardTitle>
                <CardDescription>
                  Cost distribution by service type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="aspect-[none] h-[300px]" config={{}}>
                  <ChartTooltip />

                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />

                      <XAxis
                        dataKey="serviceType"
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                      />

                      <Tooltip />

                      <Bar
                        dataKey="cost"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                        name="Cost ($)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          {/* Query Form */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <SearchIcon className="w-5 h-5 text-[#58C5C7]" />

                <CardTitle>Advanced Log Query</CardTitle>
              </div>
              <CardDescription>
                Search and filter Telique API logs with advanced criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <Input type="date" placeholder="Start date" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service Type</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="All Services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      <SelectItem value="lrn">LRN</SelectItem>
                      <SelectItem value="dno">DNO</SelectItem>
                      <SelectItem value="cnam">CNAM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client IP</label>
                  <Input placeholder="192.168.1.100" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Actions</label>
                  <Button className="w-full">
                    <SearchIcon className="w-4 h-4 mr-2" />
                    Query Logs
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Query Logs</CardTitle>
                  <CardDescription>
                    {filteredLogs.length} of {mockTeliqueLogRecords.length}{" "}
                    records
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export Logs
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                  <Input
                    placeholder="Search by IP, URL, or user agent..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="lrn">LRN</SelectItem>
                    <SelectItem value="cic">CIC</SelectItem>
                    <SelectItem value="dno">DNO</SelectItem>
                    <SelectItem value="cnam">CNAM</SelectItem>
                    <SelectItem value="stir_shaken">STIR/SHAKEN</SelectItem>
                    <SelectItem value="lsms">LSMS</SelectItem>
                    <SelectItem value="lerg">LERG</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="200">200 - Success</SelectItem>
                    <SelectItem value="400">400 - Bad Request</SelectItem>
                    <SelectItem value="404">404 - Not Found</SelectItem>
                    <SelectItem value="429">429 - Rate Limited</SelectItem>
                    <SelectItem value="500">500 - Server Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Client IP</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No logs found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase">
                              {log.serviceType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{log.method}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.clientIp}
                            {log.isSuspicious && (
                              <AlertTriangleIcon className="inline w-3 h-3 ml-1 text-red-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(log.statusCode)}
                          </TableCell>
                          <TableCell>
                            {formatLatency(log.latencySeconds)}
                          </TableCell>
                          <TableCell>{log.responseSize}B</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCost(log.cost)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceChartData.map((service) => (
              <Card key={service.serviceType}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{service.serviceType}</span>
                    <Badge variant="outline">
                      {service.queries.toLocaleString()}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Carrier-grade telecom data service
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total Queries</div>
                      <div className="font-semibold">
                        {service.queries.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Cost</div>
                      <div className="font-semibold">${service.cost}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Avg Latency</div>
                      <div className="font-semibold">
                        {formatLatency(service.averageLatency)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        Cost per Query
                      </div>
                      <div className="font-semibold">
                        ${(service.cost / service.queries).toFixed(4)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Service Descriptions */}
          <Card>
            <CardHeader>
              <CardTitle>Telique Service Descriptions</CardTitle>
              <CardDescription>
                Comprehensive telecom data services for call routing and
                analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold">
                      LRN (Local Routing Number)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Provides routing information for ported numbers, essential
                      for proper call delivery.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold">
                      CIC (Carrier Identification Code)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Identifies the carrier responsible for a specific phone
                      number.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold">
                      DNO (Directory Number Optimization)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Optimizes number routing and provides carrier-specific
                      information.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold">CNAM (Caller Name)</h4>
                    <p className="text-sm text-muted-foreground">
                      Retrieves caller name information associated with phone
                      numbers.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold">STIR/SHAKEN</h4>
                    <p className="text-sm text-muted-foreground">
                      Call authentication and verification to combat robocalls
                      and spoofing.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold">
                      LSMS (Local Service Management System)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Provides number portability and service provider
                      information.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold">
                      LERG (Local Exchange Routing Guide)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Comprehensive database for North American numbering plan
                      routing.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
