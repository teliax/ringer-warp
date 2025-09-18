import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  BarChart3Icon,
  TrendingUpIcon,
  TrendingDownIcon,
  ClockIcon,
  UserIcon,
  TicketIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  StarIcon,
  DownloadIcon,
} from "lucide-react";
import {
  mockSupportStats,
  mockSupportAgents,
  mockSupportCategories,
} from "@/polymet/data/support-mock-data";

export function SupportAnalysis() {
  const [timeRange, setTimeRange] = useState<string>("30d");
  const [activeTab, setActiveTab] = useState("overview");

  // Mock analytics data
  const ticketTrends = [
    { date: "Jan 1", created: 45, resolved: 38, pending: 12 },
    { date: "Jan 8", created: 52, resolved: 48, pending: 16 },
    { date: "Jan 15", created: 38, resolved: 42, pending: 12 },
    { date: "Jan 22", created: 61, resolved: 55, pending: 18 },
    { date: "Jan 29", created: 43, resolved: 47, pending: 14 },
    { date: "Feb 5", created: 58, resolved: 52, pending: 20 },
    { date: "Feb 12", created: 49, resolved: 53, pending: 16 },
  ];

  const categoryDistribution = mockSupportCategories.map((cat, index) => ({
    name: cat.label,
    value: cat.count,
    color: ["#58C5C7", "#FBAD18", "#231F20", "#94A3B8", "#10B981"][index % 5],
  }));

  const agentPerformance = mockSupportAgents.map((agent) => ({
    ...agent,
    resolutionRate: Math.floor(Math.random() * 20) + 80, // 80-100%
    avgResponseTime: Math.floor(Math.random() * 4) + 1, // 1-5 hours
    customerSatisfaction: Math.floor(Math.random() * 10) + 90, // 90-100%
  }));

  const kpiCards = [
    {
      title: "Total Tickets",
      value: mockSupportStats.totalTickets,
      change: "+12%",
      trend: "up",
      icon: TicketIcon,
      color: "text-[#58C5C7]",
    },
    {
      title: "Resolution Rate",
      value: `${Math.round((mockSupportStats.resolvedTickets / mockSupportStats.totalTickets) * 100)}%`,
      change: "+3%",
      trend: "up",
      icon: CheckCircleIcon,
      color: "text-green-500",
    },
    {
      title: "Avg Resolution Time",
      value: mockSupportStats.averageResolutionTime,
      change: "-15%",
      trend: "down",
      icon: ClockIcon,
      color: "text-[#FBAD18]",
    },
    {
      title: "Customer Satisfaction",
      value: "94.2%",
      change: "+2%",
      trend: "up",
      icon: StarIcon,
      color: "text-purple-500",
    },
  ];

  const getTrendIcon = (trend: string) => {
    return trend === "up" ? (
      <TrendingUpIcon className="w-3 h-3 text-green-500" />
    ) : (
      <TrendingDownIcon className="w-3 h-3 text-red-500" />
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <BarChart3Icon className="w-8 h-8 text-[#58C5C7]" />

            <span>Support Analysis</span>
          </h1>
          <p className="text-muted-foreground">
            Analytics and insights for support operations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <DownloadIcon className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                {getTrendIcon(kpi.trend)}
                <span className="ml-1">{kpi.change} from last period</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Volume Trends</CardTitle>
                <CardDescription>
                  Daily ticket creation and resolution over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="aspect-[none] h-[300px]" config={{}}>
                  <ChartTooltip />

                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ticketTrends}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />

                      <XAxis dataKey="date" className="text-xs" />

                      <Line
                        type="monotone"
                        dataKey="created"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        name="Created"
                      />

                      <Line
                        type="monotone"
                        dataKey="resolved"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        name="Resolved"
                      />

                      <Line
                        type="monotone"
                        dataKey="pending"
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={2}
                        name="Pending"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
                <CardDescription>
                  Tickets by category for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="aspect-[none] h-[300px]" config={{}}>
                  <ChartTooltip />

                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {categoryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="mt-4 space-y-2">
                  {categoryDistribution.map((category, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />

                        <span>{category.name}</span>
                      </div>
                      <span className="font-medium">{category.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Support Health Metrics</CardTitle>
              <CardDescription>
                Key performance indicators for support operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>First Response Time</span>
                    <span className="font-medium">2.3 hours</span>
                  </div>
                  <Progress value={85} className="h-2" />

                  <p className="text-xs text-muted-foreground">
                    Target: 2 hours
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Resolution Time</span>
                    <span className="font-medium">18.5 hours</span>
                  </div>
                  <Progress value={92} className="h-2" />

                  <p className="text-xs text-muted-foreground">
                    Target: 24 hours
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Customer Satisfaction</span>
                    <span className="font-medium">94.2%</span>
                  </div>
                  <Progress value={94} className="h-2" />

                  <p className="text-xs text-muted-foreground">Target: 90%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Volume by Category</CardTitle>
              <CardDescription>
                Weekly ticket volume breakdown by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer className="aspect-[none] h-[400px]" config={{}}>
                <ChartTooltip />

                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ticketTrends}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />

                    <XAxis dataKey="date" className="text-xs" />

                    <Bar
                      dataKey="created"
                      fill="hsl(var(--chart-1))"
                      name="Created"
                    />

                    <Bar
                      dataKey="resolved"
                      fill="hsl(var(--chart-2))"
                      name="Resolved"
                    />

                    <Bar
                      dataKey="pending"
                      fill="hsl(var(--chart-3))"
                      name="Pending"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>
                Individual agent metrics and performance indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Active Tickets</TableHead>
                      <TableHead>Resolution Rate</TableHead>
                      <TableHead>Avg Response</TableHead>
                      <TableHead>Satisfaction</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentPerformance.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {agent.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {agent.specialization}
                          </Badge>
                        </TableCell>
                        <TableCell>{agent.activeTickets}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{agent.resolutionRate}%</span>
                            <Progress
                              value={agent.resolutionRate}
                              className="w-16 h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell>{agent.avgResponseTime}h</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <StarIcon className="w-4 h-4 fill-yellow-400 text-yellow-400" />

                            <span>
                              {(agent.customerSatisfaction / 20).toFixed(1)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              agent.status === "online"
                                ? "default"
                                : "secondary"
                            }
                            className={
                              agent.status === "online"
                                ? "bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                                : ""
                            }
                          >
                            {agent.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockSupportCategories.map((category) => (
              <Card key={category.value}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{category.label}</CardTitle>
                    <Badge className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
                      {category.count}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Avg Resolution:</span>
                      <span className="font-medium">
                        {Math.floor(Math.random() * 12) + 6} hours
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Success Rate:</span>
                      <span className="font-medium">
                        {Math.floor(Math.random() * 10) + 90}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Satisfaction:</span>
                      <span className="font-medium">
                        {(Math.random() * 0.5 + 4.5).toFixed(1)}/5.0
                      </span>
                    </div>
                    <Progress
                      value={Math.floor(Math.random() * 30) + 70}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
