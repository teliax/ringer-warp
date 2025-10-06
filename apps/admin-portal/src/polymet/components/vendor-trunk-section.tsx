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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ServerIcon,
  PlusIcon,
  EditIcon,
  SettingsIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PhoneIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  DollarSignIcon,
  MapPinIcon,
  BuildingIcon,
  GlobeIcon,
  SearchIcon,
  FilterIcon,
  BarChart3Icon,
  ActivityIcon,
} from "lucide-react";
import {
  mockVendorTrunks,
  mockTrunkStats,
  type SipTrunk,
  type Vendor,
} from "@/polymet/data/trunk-mock-data";
import { ContextualRateManagement } from "@/polymet/components/contextual-rate-management";

interface VendorTrunkSectionProps {
  vendor: any; // Using any for compatibility with admin mock data
}

export function VendorTrunkSection({ vendor }: VendorTrunkSectionProps) {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showTrunkDetail, setShowTrunkDetail] = useState(false);
  const [selectedTrunk, setSelectedTrunk] = useState<SipTrunk | null>(null);

  // Get vendor trunks (in real implementation, filter by vendor ID)
  const vendorTrunks = mockVendorTrunks.filter(
    (trunk) =>
      trunk.basic.name.toLowerCase().includes(vendor.name.toLowerCase()) ||
      trunk.basic.providerId === vendor.id
  );

  // Filter trunks based on search and filters
  const filteredTrunks = vendorTrunks.filter((trunk) => {
    const matchesSearch =
      trunk.basic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trunk.basic.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDirection =
      directionFilter === "all" || trunk.basic.direction === directionFilter;

    const matchesStatus =
      statusFilter === "all" || trunk.basic.status === statusFilter;

    return matchesSearch && matchesDirection && matchesStatus;
  });

  // Calculate vendor trunk statistics
  const trunkStats = {
    total: vendorTrunks.length,
    active: vendorTrunks.filter((t) => t.basic.status === "active").length,
    termination: vendorTrunks.filter((t) => t.basic.direction === "termination")
      .length,
    origination: vendorTrunks.filter((t) => t.basic.direction === "origination")
      .length,
    activeCalls: vendorTrunks.reduce(
      (sum, t) => sum + (t.stats?.activeCalls || 0),
      0
    ),
    todayMinutes: vendorTrunks.reduce(
      (sum, t) => sum + (t.stats?.todayMinutes || 0),
      0
    ),
    averageAsr:
      vendorTrunks.length > 0
        ? vendorTrunks.reduce((sum, t) => sum + (t.stats?.asr || 0), 0) /
          vendorTrunks.length
        : 0,
    averageAcd:
      vendorTrunks.length > 0
        ? vendorTrunks.reduce((sum, t) => sum + (t.stats?.acd || 0), 0) /
          vendorTrunks.length
        : 0,
  };

  const getDirectionBadge = (direction: string) => {
    const config = {
      termination: {
        icon: ArrowDownIcon,
        color: "bg-green-100 text-green-800",
        label: "Termination",
      },
      origination: {
        icon: ArrowUpIcon,
        color: "bg-blue-100 text-blue-800",
        label: "Origination",
      },
    };

    const {
      icon: Icon,
      color,
      label,
    } = config[direction as keyof typeof config] || {
      icon: ServerIcon,
      color: "bg-gray-100 text-gray-800",
      label: direction,
    };

    return (
      <Badge variant="outline" className={color}>
        <Icon className="w-3 h-3 mr-1" />

        {label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: {
        variant: "default" as const,
        color: "bg-green-100 text-green-800",
      },
      inactive: {
        variant: "secondary" as const,
        color: "bg-gray-100 text-gray-800",
      },
      suspended: {
        variant: "destructive" as const,
        color: "bg-yellow-100 text-yellow-800",
      },
      testing: {
        variant: "outline" as const,
        color: "bg-purple-100 text-purple-800",
      },
    };

    const config =
      variants[status as keyof typeof variants] || variants.inactive;

    return (
      <Badge variant={config.variant} className={config.color}>
        {status}
      </Badge>
    );
  };

  const getPurposeBadge = (purpose: string) => {
    const config = {
      primary: { color: "bg-blue-100 text-blue-800" },
      backup: { color: "bg-orange-100 text-orange-800" },
      geographic: { color: "bg-purple-100 text-purple-800" },
      campaign: { color: "bg-green-100 text-green-800" },
      failover: { color: "bg-red-100 text-red-800" },
      test: { color: "bg-gray-100 text-gray-800" },
    };

    const { color } = config[purpose as keyof typeof config] || config.primary;

    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        {purpose}
      </Badge>
    );
  };

  const handleViewTrunk = (trunk: SipTrunk) => {
    setSelectedTrunk(trunk);
    setShowTrunkDetail(true);
  };

  return (
    <div className="space-y-6">
      {/* Vendor Trunk Overview Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <ServerIcon className="w-5 h-5 text-[#58C5C7]" />
            {vendor.name} - SIP Trunk Management
          </h3>
          <p className="text-muted-foreground">
            Manage termination and origination trunk groups with real-world
            vendor patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-[#58C5C7]/10 text-[#58C5C7]">
            {trunkStats.total} Trunk Groups
          </Badge>
          <Button>
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Trunk Group
          </Button>
        </div>
      </div>

      {/* Vendor Trunk Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Trunks</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {trunkStats.active}
            </div>
            <p className="text-xs text-muted-foreground">
              of {trunkStats.total} configured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
            <PhoneIcon className="h-4 w-4 text-[#58C5C7]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#58C5C7]">
              {trunkStats.activeCalls}
            </div>
            <p className="text-xs text-muted-foreground">
              across all trunk groups
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today Minutes</CardTitle>
            <ClockIcon className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {trunkStats.todayMinutes.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              total traffic volume
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average ASR</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-[#FBAD18]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FBAD18]">
              {trunkStats.averageAsr.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              answer seizure ratio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Trunk Management Tabs */}
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="termination">Termination</TabsTrigger>
          <TabsTrigger value="origination">Origination</TabsTrigger>
          <TabsTrigger value="rates">Rate Management</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <VendorTrunkOverview
            vendor={vendor}
            trunks={vendorTrunks}
            stats={trunkStats}
            onViewTrunk={handleViewTrunk}
          />
        </TabsContent>

        <TabsContent value="termination" className="space-y-6">
          <VendorTerminationTrunks
            vendor={vendor}
            trunks={vendorTrunks.filter(
              (t) => t.basic.direction === "termination"
            )}
            onViewTrunk={handleViewTrunk}
          />
        </TabsContent>

        <TabsContent value="origination" className="space-y-6">
          <VendorOriginationTrunks
            vendor={vendor}
            trunks={vendorTrunks.filter(
              (t) => t.basic.direction === "origination"
            )}
            onViewTrunk={handleViewTrunk}
          />
        </TabsContent>

        <TabsContent value="rates" className="space-y-6">
          <ContextualRateManagement
            trunk={vendorTrunks[0]}
            trunkType="vendor"
            onRateUpdate={(trunkId, rates) => {
              console.log("Vendor rate update:", trunkId, rates);
            }}
          />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <VendorTrunkMonitoring
            vendor={vendor}
            trunks={vendorTrunks}
            stats={trunkStats}
          />
        </TabsContent>
      </Tabs>

      {/* Trunk Detail Dialog */}
      <Dialog open={showTrunkDetail} onOpenChange={setShowTrunkDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ServerIcon className="w-5 h-5" />

              {selectedTrunk?.basic.name}
            </DialogTitle>
            <DialogDescription>
              Detailed trunk configuration and performance metrics
            </DialogDescription>
          </DialogHeader>
          {selectedTrunk && (
            <VendorTrunkDetail trunk={selectedTrunk} vendor={vendor} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Vendor Trunk Overview Component
function VendorTrunkOverview({
  vendor,
  trunks,
  stats,
  onViewTrunk,
}: {
  vendor: any;
  trunks: SipTrunk[];
  stats: any;
  onViewTrunk: (trunk: SipTrunk) => void;
}) {
  const terminationTrunks = trunks.filter(
    (t) => t.basic.direction === "termination"
  );
  const originationTrunks = trunks.filter(
    (t) => t.basic.direction === "origination"
  );

  return (
    <div className="space-y-6">
      {/* Trunk Group Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownIcon className="w-4 h-4 text-green-600" />
              Termination Trunks
            </CardTitle>
            <CardDescription>
              Outbound traffic routing to {vendor.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Active Groups:
              </span>
              <span className="font-semibold">
                {
                  terminationTrunks.filter((t) => t.basic.status === "active")
                    .length
                }{" "}
                / {terminationTrunks.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total Capacity:
              </span>
              <span className="font-semibold">
                {terminationTrunks.reduce(
                  (sum, t) => sum + (t.capacity?.maxConcurrentCalls || 0),
                  0
                )}{" "}
                calls
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Current Usage:
              </span>
              <span className="font-semibold">
                {terminationTrunks.reduce(
                  (sum, t) => sum + (t.stats?.activeCalls || 0),
                  0
                )}{" "}
                calls
              </span>
            </div>
            <div className="space-y-2">
              {terminationTrunks.slice(0, 3).map((trunk) => (
                <div
                  key={trunk.basic.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{trunk.basic.name}</span>
                  <Badge
                    variant={
                      trunk.basic.status === "active" ? "default" : "secondary"
                    }
                    className="ml-2"
                  >
                    {trunk.stats?.activeCalls || 0} calls
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpIcon className="w-4 h-4 text-blue-600" />
              Origination Trunks
            </CardTitle>
            <CardDescription>
              Inbound traffic routing from {vendor.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Active Groups:
              </span>
              <span className="font-semibold">
                {
                  originationTrunks.filter((t) => t.basic.status === "active")
                    .length
                }{" "}
                / {originationTrunks.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total Capacity:
              </span>
              <span className="font-semibold">
                {originationTrunks.reduce(
                  (sum, t) => sum + (t.capacity?.maxConcurrentCalls || 0),
                  0
                )}{" "}
                calls
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Current Usage:
              </span>
              <span className="font-semibold">
                {originationTrunks.reduce(
                  (sum, t) => sum + (t.stats?.activeCalls || 0),
                  0
                )}{" "}
                calls
              </span>
            </div>
            <div className="space-y-2">
              {originationTrunks.slice(0, 3).map((trunk) => (
                <div
                  key={trunk.basic.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{trunk.basic.name}</span>
                  <Badge
                    variant={
                      trunk.basic.status === "active" ? "default" : "secondary"
                    }
                    className="ml-2"
                  >
                    {trunk.stats?.activeCalls || 0} calls
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-World Vendor Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Real-World Vendor Trunk Patterns</CardTitle>
          <CardDescription>
            Common trunk group configurations for {vendor.name} traffic
            management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <GlobeIcon className="w-4 h-4 text-blue-600" />
                Geographic Routing
              </h4>
              <div className="text-sm space-y-1">
                <div>✓ Regional termination points</div>
                <div>✓ Local presence optimization</div>
                <div>✓ Latency reduction</div>
                <div>✓ Regulatory compliance</div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <BuildingIcon className="w-4 h-4 text-green-600" />
                Service Separation
              </h4>
              <div className="text-sm space-y-1">
                <div>✓ Interstate vs Intrastate</div>
                <div>✓ International routing</div>
                <div>✓ Toll-free services</div>
                <div>✓ Emergency services</div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-purple-600" />
                Quality Tiers
              </h4>
              <div className="text-sm space-y-1">
                <div>✓ Premium quality routes</div>
                <div>✓ Standard commercial routes</div>
                <div>✓ Economy bulk routes</div>
                <div>✓ Test environment routes</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Vendor Termination Trunks Component
function VendorTerminationTrunks({
  vendor,
  trunks,
  onViewTrunk,
}: {
  vendor: any;
  trunks: SipTrunk[];
  onViewTrunk: (trunk: SipTrunk) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <ArrowDownIcon className="w-5 h-5 text-green-600" />
            Termination Trunk Groups
          </h4>
          <p className="text-sm text-muted-foreground">
            Outbound traffic routing to {vendor.name} - separated by service
            type and geography
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Termination Group
        </Button>
      </div>

      {trunks.length > 0 ? (
        <div className="space-y-4">
          {trunks.map((trunk) => (
            <Card
              key={trunk.basic.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h5 className="font-semibold">{trunk.basic.name}</h5>
                      <Badge
                        variant={
                          trunk.basic.status === "active"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {trunk.basic.status}
                      </Badge>
                      {trunk.basic.purpose && (
                        <Badge variant="outline" className="capitalize">
                          {trunk.basic.purpose}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {trunk.basic.description}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Active Calls:
                        </span>
                        <div className="font-semibold">
                          {trunk.stats?.activeCalls || 0}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Capacity:</span>
                        <div className="font-semibold">
                          {trunk.capacity?.maxConcurrentCalls || 0}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ASR:</span>
                        <div className="font-semibold">
                          {trunk.stats?.asr.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ACD:</span>
                        <div className="font-semibold">
                          {trunk.stats?.acd.toFixed(1)}m
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewTrunk(trunk)}
                    >
                      <SettingsIcon className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <EditIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <ArrowDownIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />

            <h4 className="text-lg font-semibold mb-2">
              No Termination Trunks
            </h4>
            <p className="text-muted-foreground mb-6">
              Configure termination trunk groups to route outbound traffic to{" "}
              {vendor.name}
            </p>
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Termination Trunk Group
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Vendor Origination Trunks Component
function VendorOriginationTrunks({
  vendor,
  trunks,
  onViewTrunk,
}: {
  vendor: any;
  trunks: SipTrunk[];
  onViewTrunk: (trunk: SipTrunk) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <ArrowUpIcon className="w-5 h-5 text-blue-600" />
            Origination Trunk Groups
          </h4>
          <p className="text-sm text-muted-foreground">
            Inbound traffic routing from {vendor.name} - separated by DID ranges
            and services
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Origination Group
        </Button>
      </div>

      {trunks.length > 0 ? (
        <div className="space-y-4">
          {trunks.map((trunk) => (
            <Card
              key={trunk.basic.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h5 className="font-semibold">{trunk.basic.name}</h5>
                      <Badge
                        variant={
                          trunk.basic.status === "active"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {trunk.basic.status}
                      </Badge>
                      {trunk.basic.purpose && (
                        <Badge variant="outline" className="capitalize">
                          {trunk.basic.purpose}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {trunk.basic.description}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Active Calls:
                        </span>
                        <div className="font-semibold">
                          {trunk.stats?.activeCalls || 0}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Capacity:</span>
                        <div className="font-semibold">
                          {trunk.capacity?.maxConcurrentCalls || 0}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ASR:</span>
                        <div className="font-semibold">
                          {trunk.stats?.asr.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ACD:</span>
                        <div className="font-semibold">
                          {trunk.stats?.acd.toFixed(1)}m
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewTrunk(trunk)}
                    >
                      <SettingsIcon className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <EditIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <ArrowUpIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />

            <h4 className="text-lg font-semibold mb-2">
              No Origination Trunks
            </h4>
            <p className="text-muted-foreground mb-6">
              Configure origination trunk groups to receive inbound traffic from{" "}
              {vendor.name}
            </p>
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Origination Trunk Group
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Vendor Trunk Monitoring Component
function VendorTrunkMonitoring({
  vendor,
  trunks,
  stats,
}: {
  vendor: any;
  trunks: SipTrunk[];
  stats: any;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3Icon className="w-5 h-5 text-[#58C5C7]" />
          Real-Time Monitoring
        </h4>
        <p className="text-sm text-muted-foreground">
          Live performance metrics and health monitoring for {vendor.name} trunk
          groups
        </p>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Trunk Utilization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trunks.slice(0, 5).map((trunk) => {
              const utilization = trunk.capacity?.maxConcurrentCalls
                ? ((trunk.stats?.activeCalls || 0) /
                    trunk.capacity.maxConcurrentCalls) *
                  100
                : 0;

              return (
                <div key={trunk.basic.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{trunk.basic.name}</span>
                    <span className="font-mono">
                      {trunk.stats?.activeCalls || 0}/
                      {trunk.capacity?.maxConcurrentCalls || 0}
                    </span>
                  </div>
                  <Progress value={utilization} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quality Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trunks.slice(0, 5).map((trunk) => (
              <div
                key={trunk.basic.id}
                className="flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium truncate">
                    {trunk.basic.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ASR: {trunk.stats?.asr.toFixed(1)}% | ACD:{" "}
                    {trunk.stats?.acd.toFixed(1)}m
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {trunk.stats?.asr >= 95 ? (
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  ) : trunk.stats?.asr >= 85 ? (
                    <AlertTriangleIcon className="w-4 h-4 text-yellow-600" />
                  ) : (
                    <AlertTriangleIcon className="w-4 h-4 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Vendor-Specific Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor-Specific Monitoring Patterns</CardTitle>
          <CardDescription>
            Monitoring configurations tailored for {vendor.name} traffic
            patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h5 className="font-semibold mb-2">Termination Monitoring</h5>
              <div className="text-sm space-y-1">
                <div>✓ Route success rates</div>
                <div>✓ Cost per minute tracking</div>
                <div>✓ Geographic performance</div>
                <div>✓ Peak hour analysis</div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h5 className="font-semibold mb-2">Origination Monitoring</h5>
              <div className="text-sm space-y-1">
                <div>✓ DID number utilization</div>
                <div>✓ Inbound call quality</div>
                <div>✓ Caller ID accuracy</div>
                <div>✓ Emergency routing</div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h5 className="font-semibold mb-2">Vendor SLA Tracking</h5>
              <div className="text-sm space-y-1">
                <div>✓ Uptime monitoring</div>
                <div>✓ SLA compliance</div>
                <div>✓ Penalty calculations</div>
                <div>✓ Performance reports</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Vendor Trunk Detail Component
function VendorTrunkDetail({
  trunk,
  vendor,
}: {
  trunk: SipTrunk;
  vendor: any;
}) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="configuration" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Trunk ID:
                  </span>
                  <span className="text-sm font-mono">{trunk.basic.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Direction:
                  </span>
                  <Badge variant="outline" className="capitalize">
                    {trunk.basic.direction}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge
                    variant={
                      trunk.basic.status === "active" ? "default" : "secondary"
                    }
                  >
                    {trunk.basic.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Provider:
                  </span>
                  <span className="text-sm">{trunk.basic.providerType}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Capacity & Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Max Concurrent:
                  </span>
                  <span className="text-sm font-mono">
                    {trunk.capacity?.maxConcurrentCalls || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    CPS Limit:
                  </span>
                  <span className="text-sm font-mono">
                    {trunk.capacity?.cpsLimit || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Quality Tier:
                  </span>
                  <span className="text-sm capitalize">
                    {trunk.capacity?.qualityTier || "standard"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Call Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {trunk.stats?.activeCalls || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Active Calls</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {trunk.stats?.todayMinutes.toLocaleString() || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Today Minutes</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quality Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {trunk.stats?.asr.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground">ASR</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {trunk.stats?.acd.toFixed(1)}m
                  </div>
                  <p className="text-sm text-muted-foreground">ACD</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Utilization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {trunk.capacity?.maxConcurrentCalls
                      ? (
                          ((trunk.stats?.activeCalls || 0) /
                            trunk.capacity.maxConcurrentCalls) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                  <p className="text-sm text-muted-foreground">Current Usage</p>
                </div>
                <Progress
                  value={
                    trunk.capacity?.maxConcurrentCalls
                      ? ((trunk.stats?.activeCalls || 0) /
                          trunk.capacity.maxConcurrentCalls) *
                        100
                      : 0
                  }
                  className="w-full"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Configuration</CardTitle>
              <CardDescription>
                Current rates for {trunk.basic.direction} traffic via{" "}
                {vendor.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <DollarSignIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />

                <p className="text-muted-foreground">
                  Rate configuration interface would be implemented here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring Configuration</CardTitle>
              <CardDescription>
                Health checks and alerting for {trunk.basic.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <ActivityIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />

                <p className="text-muted-foreground">
                  Monitoring configuration interface would be implemented here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
