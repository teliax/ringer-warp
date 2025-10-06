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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PhoneIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  SettingsIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  MoreHorizontalIcon,
  TrendingUpIcon,
  ActivityIcon,
  ClockIcon,
  DollarSignIcon,
  ServerIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  DownloadIcon,
  UploadIcon,
  CopyIcon,
} from "lucide-react";
import {
  mockTrunks,
  mockCustomerTrunks,
  mockVendorTrunks,
  mockPartitions,
  mockTrunkStats,
  type SipTrunk,
} from "@/polymet/data/trunk-mock-data";

export function TrunkManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [partitionFilter, setPartitionFilter] = useState<string>("all");
  const [selectedTrunks, setSelectedTrunks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  // Filter trunks based on search and filters
  const filteredTrunks = mockTrunks.filter((trunk) => {
    const matchesSearch =
      trunk.basic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trunk.basic.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trunk.basic.ban?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trunk.basic.providerId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || trunk.basic.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || trunk.basic.status === statusFilter;
    const matchesPartition =
      partitionFilter === "all" || trunk.basic.machineId === partitionFilter;
    const matchesTab = activeTab === "all" || trunk.basic.type === activeTab;

    return (
      matchesSearch &&
      matchesType &&
      matchesStatus &&
      matchesPartition &&
      matchesTab
    );
  });

  const getStatusBadge = (status: SipTrunk["basic"]["status"]) => {
    const variants = {
      active: "default",
      suspended: "secondary",
      testing: "outline",
    } as const;

    const colors = {
      active: "bg-green-100 text-green-800",
      suspended: "bg-yellow-100 text-yellow-800",
      testing: "bg-blue-100 text-blue-800",
    };

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type: SipTrunk["basic"]["type"]) => {
    const config = {
      customer: { color: "bg-blue-100 text-blue-800", label: "Customer" },
      vendor: { color: "bg-purple-100 text-purple-800", label: "Vendor" },
    };

    const { color, label } = config[type];

    return (
      <Badge variant="outline" className={color}>
        {label}
      </Badge>
    );
  };

  const formatMinutes = (minutes: number) => {
    if (minutes >= 1000000) {
      return `${(minutes / 1000000).toFixed(1)}M`;
    } else if (minutes >= 1000) {
      return `${(minutes / 1000).toFixed(1)}K`;
    }
    return minutes.toString();
  };

  const handleBulkAction = (action: string) => {
    console.log(`Bulk action: ${action} on trunks:`, selectedTrunks);
    // Implement bulk actions
  };

  const handleTrunkAction = (action: string, trunkId: string) => {
    console.log(`Action: ${action} on trunk: ${trunkId}`);
    // Implement individual trunk actions
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SIP Trunk Management</h1>
          <p className="text-muted-foreground">
            Configure and manage customer and vendor SIP trunks with advanced
            routing and rating
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Import/Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Data Management</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem>
                <UploadIcon className="w-4 h-4 mr-2" />
                Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem>
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem>
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Trunk
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New SIP Trunk</DialogTitle>
                <DialogDescription>
                  Choose the type of SIP trunk to configure
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Button className="w-full justify-start" variant="outline">
                  <PhoneIcon className="w-4 h-4 mr-2" />
                  Customer Trunk (Inbound)
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <ServerIcon className="w-4 h-4 mr-2" />
                  Vendor Trunk (Outbound)
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trunks</CardTitle>
            <ServerIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockTrunkStats.totalTrunks}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              {mockTrunkStats.activeTrunks} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockTrunkStats.totalActiveCalls}
            </div>
            <p className="text-xs text-muted-foreground">Across all trunks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Minutes
            </CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMinutes(mockTrunkStats.totalTodayMinutes)}
            </div>
            <p className="text-xs text-muted-foreground">Call volume today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average ASR</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockTrunkStats.averageAsr.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Answer success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Trunk Management Interface */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>SIP Trunk Directory</CardTitle>
              <CardDescription>
                Manage customer and vendor SIP trunk configurations
              </CardDescription>
            </div>
            {selectedTrunks.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedTrunks.length} selected
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Bulk Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => handleBulkAction("enable")}
                    >
                      <PlayIcon className="w-4 h-4 mr-2" />
                      Enable
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleBulkAction("suspend")}
                    >
                      <PauseIcon className="w-4 h-4 mr-2" />
                      Suspend
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleBulkAction("export")}
                    >
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => handleBulkAction("delete")}
                      className="text-red-600"
                    >
                      <TrashIcon className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Filters and Search */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                All Trunks ({mockTrunks.length})
              </TabsTrigger>
              <TabsTrigger value="customer">
                Customer ({mockCustomerTrunks.length})
              </TabsTrigger>
              <TabsTrigger value="vendor">
                Vendor ({mockVendorTrunks.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                <Input
                  placeholder="Search by name, ID, BAN, or provider..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={partitionFilter}
                onValueChange={setPartitionFilter}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Partition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partitions</SelectItem>
                  {mockPartitions.map((partition) => (
                    <SelectItem key={partition.id} value={partition.id}>
                      {partition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsContent value={activeTab} className="mt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={
                            selectedTrunks.length === filteredTrunks.length &&
                            filteredTrunks.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTrunks(
                                filteredTrunks.map((t) => t.basic.id)
                              );
                            } else {
                              setSelectedTrunks([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Trunk ID / BAN</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Partition</TableHead>
                      <TableHead>Active Calls</TableHead>
                      <TableHead>Today's Minutes</TableHead>
                      <TableHead>ASR</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrunks.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="text-center py-8 text-muted-foreground"
                        >
                          {searchTerm ||
                          statusFilter !== "all" ||
                          partitionFilter !== "all"
                            ? "No trunks found matching your filters"
                            : "No trunks configured"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTrunks.map((trunk) => (
                        <TableRow key={trunk.basic.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedTrunks.includes(trunk.basic.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTrunks([
                                    ...selectedTrunks,
                                    trunk.basic.id,
                                  ]);
                                } else {
                                  setSelectedTrunks(
                                    selectedTrunks.filter(
                                      (id) => id !== trunk.basic.id
                                    )
                                  );
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-sm">
                              {trunk.basic.type === "customer"
                                ? trunk.basic.ban
                                : trunk.basic.providerId}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {trunk.basic.id}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {trunk.basic.name}
                            </div>
                            {trunk.basic.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {trunk.basic.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {getTypeBadge(trunk.basic.type)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(trunk.basic.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {mockPartitions.find(
                                (p) => p.id === trunk.basic.machineId
                              )?.name || trunk.basic.machineId}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {trunk.stats?.activeCalls || 0}
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatMinutes(trunk.stats?.todayMinutes || 0)}
                          </TableCell>
                          <TableCell className="font-mono">
                            {trunk.stats?.asr.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontalIcon className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleTrunkAction("edit", trunk.basic.id)
                                  }
                                >
                                  <EditIcon className="w-4 h-4 mr-2" />
                                  Configure
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleTrunkAction("test", trunk.basic.id)
                                  }
                                >
                                  <PlayIcon className="w-4 h-4 mr-2" />
                                  Test Trunk
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleTrunkAction(
                                      "duplicate",
                                      trunk.basic.id
                                    )
                                  }
                                >
                                  <CopyIcon className="w-4 h-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {trunk.basic.status === "active" ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleTrunkAction(
                                        "suspend",
                                        trunk.basic.id
                                      )
                                    }
                                  >
                                    <PauseIcon className="w-4 h-4 mr-2" />
                                    Suspend
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleTrunkAction(
                                        "activate",
                                        trunk.basic.id
                                      )
                                    }
                                  >
                                    <PlayIcon className="w-4 h-4 mr-2" />
                                    Activate
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() =>
                                    handleTrunkAction("delete", trunk.basic.id)
                                  }
                                  className="text-red-600"
                                >
                                  <TrashIcon className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center">
            <PhoneIcon className="w-4 h-4 mr-2" />
            Customer Trunks
          </h3>
          <div className="text-sm space-y-1">
            <div>✓ Inbound call routing</div>
            <div>✓ IP ACL & SIP authentication</div>
            <div>✓ Rate configuration per zone</div>
            <div>✓ Quality monitoring</div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center">
            <ServerIcon className="w-4 h-4 mr-2" />
            Vendor Trunks
          </h3>
          <div className="text-sm space-y-1">
            <div>✓ Outbound call routing</div>
            <div>✓ Load balancing & failover</div>
            <div>✓ LCR & rate optimization</div>
            <div>✓ Provider exclusions</div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Advanced Features
          </h3>
          <div className="text-sm space-y-1">
            <div>✓ Override & exclusion rules</div>
            <div>✓ Testing & validation tools</div>
            <div>✓ Homer SIP capture</div>
            <div>✓ Template management</div>
          </div>
        </div>
      </div>
    </div>
  );
}
