import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  PlusIcon,
  EditIcon,
  SettingsIcon,
  PhoneIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  MapPinIcon,
  ShieldIcon,
  NetworkIcon,
  BarChart3Icon,
  PlayIcon,
  PauseIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  mockCustomerTrunks,
  mockTrunkStats,
  type SipTrunk,
  type CustomerAccount,
} from "@/polymet/data/trunk-mock-data";
import { ContextualRateManagement } from "@/polymet/components/contextual-rate-management";

interface CustomerTrunkSectionProps {
  customer: CustomerAccount;
}

export function CustomerTrunkSection({ customer }: CustomerTrunkSectionProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTrunk, setSelectedTrunk] = useState<SipTrunk | null>(null);

  // Filter trunks for this customer (in real app, this would be based on customer.id)
  const customerTrunkGroups = mockCustomerTrunks.filter(
    (trunk) =>
      trunk.basic.name.toLowerCase().includes("acme") ||
      trunk.basic.name.toLowerCase().includes("techstart")
  );

  // Calculate customer-specific stats
  const customerStats = {
    totalTrunks: customerTrunkGroups.length,
    activeTrunks: customerTrunkGroups.filter((t) => t.basic.status === "active")
      .length,
    totalCalls: customerTrunkGroups.reduce(
      (sum, t) => sum + (t.stats?.activeCalls || 0),
      0
    ),
    totalCapacity: customerTrunkGroups.reduce(
      (sum, t) => sum + (t.capacity?.maxConcurrentCalls || 0),
      0
    ),
    avgAsr:
      customerTrunkGroups.reduce((sum, t) => sum + (t.stats?.asr || 0), 0) /
      customerTrunkGroups.length,
    avgAcd:
      customerTrunkGroups.reduce((sum, t) => sum + (t.stats?.acd || 0), 0) /
      customerTrunkGroups.length,
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      suspended: "destructive",
      inactive: "secondary",
      testing: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  const getDirectionBadge = (direction: string) => {
    const colors = {
      bidirectional: "bg-blue-100 text-blue-800",
      inbound_only: "bg-green-100 text-green-800",
      outbound_only: "bg-purple-100 text-purple-800",
    } as const;

    return (
      <Badge
        className={
          colors[direction as keyof typeof colors] ||
          "bg-gray-100 text-gray-800"
        }
      >
        {direction.replace("_", " ")}
      </Badge>
    );
  };

  const getPurposeBadge = (purpose: string) => {
    const colors = {
      primary: "bg-indigo-100 text-indigo-800",
      backup: "bg-orange-100 text-orange-800",
      geographic: "bg-teal-100 text-teal-800",
      campaign: "bg-pink-100 text-pink-800",
      failover: "bg-red-100 text-red-800",
      test: "bg-gray-100 text-gray-800",
    } as const;

    return (
      <Badge
        className={
          colors[purpose as keyof typeof colors] || "bg-gray-100 text-gray-800"
        }
      >
        {purpose}
      </Badge>
    );
  };

  const TrunkOverviewStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Trunk Groups
          </CardTitle>
          <NetworkIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{customerStats.totalTrunks}</div>
          <p className="text-xs text-muted-foreground">
            {customerStats.activeTrunks} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
          <PhoneIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{customerStats.totalCalls}</div>
          <p className="text-xs text-muted-foreground">
            of {customerStats.totalCapacity} capacity
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {customerStats.avgAsr.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">Avg ASR across trunks</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Avg Call Duration
          </CardTitle>
          <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {customerStats.avgAcd.toFixed(1)}m
          </div>
          <p className="text-xs text-muted-foreground">Average ACD</p>
        </CardContent>
      </Card>
    </div>
  );

  const TrunkGroupsList = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Trunk Groups</CardTitle>
          <CardDescription>
            Manage customer's SIP trunk group configurations with real-world
            patterns
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Trunk Group
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trunk Group Name</TableHead>
                <TableHead>Location/Purpose</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>ASR/ACD</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerTrunkGroups.map((trunk) => {
                const utilization =
                  trunk.stats?.activeCalls && trunk.capacity?.maxConcurrentCalls
                    ? (trunk.stats.activeCalls /
                        trunk.capacity.maxConcurrentCalls) *
                      100
                    : 0;

                return (
                  <TableRow key={trunk.basic.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{trunk.basic.name}</div>
                        <div className="text-sm text-muted-foreground">
                          BAN: {trunk.basic.ban}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <MapPinIcon className="w-4 h-4 text-muted-foreground" />

                        <span className="text-sm">
                          {trunk.basic.location || "Not specified"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getDirectionBadge(trunk.basic.direction)}
                    </TableCell>
                    <TableCell>
                      {getPurposeBadge(trunk.basic.purpose)}
                    </TableCell>
                    <TableCell>{getStatusBadge(trunk.basic.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{trunk.stats?.activeCalls || 0}</span>
                          <span className="text-muted-foreground">
                            /{trunk.capacity?.maxConcurrentCalls || 0}
                          </span>
                        </div>
                        <Progress value={utilization} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>ASR: {trunk.stats?.asr.toFixed(1)}%</div>
                        <div className="text-muted-foreground">
                          ACD: {trunk.stats?.acd.toFixed(1)}m
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTrunk(trunk)}
                        >
                          <EditIcon className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <SettingsIcon className="w-4 h-4" />
                        </Button>
                        {trunk.basic.status === "active" ? (
                          <Button variant="ghost" size="sm">
                            <PauseIcon className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm">
                            <PlayIcon className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const TrunkConfiguration = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShieldIcon className="w-5 h-5 mr-2" />
            Authentication & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {customerTrunkGroups.map((trunk) => (
            <div key={trunk.basic.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{trunk.basic.name}</h4>
                {getStatusBadge(trunk.basic.status)}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auth Method:</span>
                  <span>{trunk.authentication?.method || "IP ACL"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP Address:</span>
                  <span className="font-mono">{trunk.sip?.host}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Port:</span>
                  <span className="font-mono">{trunk.sip?.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transport:</span>
                  <span>{trunk.sip?.transport}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3Icon className="w-5 h-5 mr-2" />
            Capacity & Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {customerTrunkGroups.map((trunk) => (
            <div key={trunk.basic.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{trunk.basic.name}</h4>
                <div className="text-sm text-muted-foreground">
                  {trunk.stats?.activeCalls || 0} active calls
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Concurrent Calls</span>
                    <span>
                      {trunk.stats?.activeCalls || 0}/
                      {trunk.capacity?.maxConcurrentCalls || 0}
                    </span>
                  </div>
                  <Progress
                    value={
                      trunk.stats?.activeCalls &&
                      trunk.capacity?.maxConcurrentCalls
                        ? (trunk.stats.activeCalls /
                            trunk.capacity.maxConcurrentCalls) *
                          100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">CPS Limit:</span>
                    <div className="font-medium">
                      {trunk.capacity?.maxCallsPerSecond || 0}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quality Tier:</span>
                    <div className="font-medium capitalize">
                      {trunk.basic.qualityTier}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const TrunkRatesOverview = () => (
    <Card>
      <CardHeader>
        <CardTitle>Rate Configuration Overview</CardTitle>
        <CardDescription>
          Current rate settings for customer trunk groups
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {customerTrunkGroups.map((trunk) => (
            <div key={trunk.basic.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">{trunk.basic.name}</h4>
                <Button variant="outline" size="sm">
                  <EditIcon className="w-4 h-4 mr-2" />
                  Edit Rates
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Interstate:</span>
                  <div className="font-mono">
                    ${trunk.rates?.interstate.toFixed(4) || "0.0000"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Intrastate:</span>
                  <div className="font-mono">
                    ${trunk.rates?.intrastate.toFixed(4) || "0.0000"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Local:</span>
                  <div className="font-mono">
                    ${trunk.rates?.local.toFixed(4) || "0.0000"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">International:</span>
                  <div className="font-mono">
                    ${trunk.rates?.international.toFixed(4) || "0.0000"}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Billing Increment:
                  </span>
                  <span>{trunk.rates?.billingIncrement || 60}s</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <TrunkOverviewStats />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <TrunkGroupsList />
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6">
          <TrunkConfiguration />
        </TabsContent>

        <TabsContent value="rates" className="space-y-6">
          <ContextualRateManagement
            trunk={customerTrunkGroups[0]}
            trunkType="customer"
            onRateUpdate={(trunkId, rates) => {
              console.log("Customer rate update:", trunkId, rates);
            }}
          />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Monitoring</CardTitle>
              <CardDescription>
                Live trunk performance and health monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customerTrunkGroups.map((trunk) => (
                  <div key={trunk.basic.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{trunk.basic.name}</h4>
                      <div className="flex items-center space-x-1">
                        {trunk.basic.status === "active" ? (
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangleIcon className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Active Calls:
                        </span>
                        <span className="font-medium">
                          {trunk.stats?.activeCalls || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ASR:</span>
                        <span className="font-medium">
                          {trunk.stats?.asr.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ACD:</span>
                        <span className="font-medium">
                          {trunk.stats?.acd.toFixed(1)}m
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Today Minutes:
                        </span>
                        <span className="font-medium">
                          {trunk.stats?.todayMinutes.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
