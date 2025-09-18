import { VendorTrunkSection } from "@/polymet/components/vendor-trunk-section";
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
  TruckIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  PhoneIcon,
  MessageSquareIcon,
  DatabaseIcon,
  BuildingIcon,
  MailIcon,
  MapPinIcon,
  CalendarIcon,
  DollarSignIcon,
  TrendingUpIcon,
  SettingsIcon,
  ServerIcon,
  FileTextIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react";
import { mockVendors, type Vendor } from "@/polymet/data/admin-mock-data";
import {
  mockVendorTrunks,
  type SipTrunk,
} from "@/polymet/data/trunk-mock-data";

export function Vendors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [showVendorDetail, setShowVendorDetail] = useState(false);

  const filteredVendors = mockVendors.filter((vendor) => {
    const matchesSearch =
      vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.contactEmail.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || vendor.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || vendor.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: Vendor["status"]) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      pending: "destructive",
    } as const;

    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getTypeBadge = (type: Vendor["type"]) => {
    const config = {
      voice: { icon: PhoneIcon, color: "bg-blue-100 text-blue-800" },
      messaging: {
        icon: MessageSquareIcon,
        color: "bg-green-100 text-green-800",
      },
      data: { icon: DatabaseIcon, color: "bg-purple-100 text-purple-800" },
      other: { icon: BuildingIcon, color: "bg-gray-100 text-gray-800" },
    };

    const { icon: Icon, color } = config[type];

    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        <Icon className="w-3 h-3 mr-1" />

        {type}
      </Badge>
    );
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  const handleViewVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setSelectedTab("overview");
    setShowVendorDetail(true);
  };

  const getVendorTrunks = (vendorId: string) => {
    // In real implementation, this would filter trunks by vendor ID
    // For demo, we'll return mock vendor trunks
    return mockVendorTrunks.filter(
      (trunk) =>
        trunk.basic.providerId === vendorId ||
        trunk.basic.name.toLowerCase().includes(vendorId.toLowerCase())
    );
  };

  // Calculate vendor statistics
  const totalVendors = mockVendors.length;
  const activeVendors = mockVendors.filter((v) => v.status === "active").length;
  const totalVolume = mockVendors.reduce((sum, v) => sum + v.monthlyVolume, 0);
  const avgRate = mockVendors
    .filter((v) => v.ratePerMinute)
    .reduce((sum, v, _, arr) => sum + (v.ratePerMinute || 0) / arr.length, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Management</h1>
          <p className="text-muted-foreground">
            Manage voice, messaging, and data vendor relationships
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
              <DialogDescription>
                Create a new vendor relationship for voice, messaging, or data
                services.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vendor creation form would be implemented here with fields for
                contact information, services, rates, and contract details.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vendor Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            <TruckIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVendors}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              {activeVendors} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Volume
            </CardTitle>
            <PhoneIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatVolume(totalVolume)}
            </div>
            <p className="text-xs text-muted-foreground">minutes & messages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgRate.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">per minute (voice)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Contract Status
            </CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockVendors.filter((v) => v.status === "pending").length}
            </div>
            <p className="text-xs text-muted-foreground">pending contracts</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Directory</CardTitle>
          <CardDescription>
            Search and manage vendor relationships
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              <Input
                placeholder="Search vendors by name, contact, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="messaging">Messaging</SelectItem>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Monthly Volume</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {searchTerm ||
                      typeFilter !== "all" ||
                      statusFilter !== "all"
                        ? "No vendors found matching your filters"
                        : "No vendors found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{vendor.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {vendor.address.city}, {vendor.address.state}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(vendor.type)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {vendor.contactName}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center">
                            <MailIcon className="w-3 h-3 mr-1" />

                            {vendor.contactEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {vendor.services.slice(0, 2).map((service) => (
                            <Badge
                              key={service}
                              variant="outline"
                              className="text-xs"
                            >
                              {service}
                            </Badge>
                          ))}
                          {vendor.services.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{vendor.services.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                      <TableCell className="font-mono">
                        {formatVolume(vendor.monthlyVolume)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {vendor.ratePerMinute
                          ? `$${vendor.ratePerMinute.toFixed(4)}`
                          : vendor.ratePerMessage
                            ? `$${vendor.ratePerMessage.toFixed(4)}`
                            : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewVendor(vendor)}
                            title="View Vendor Details"
                          >
                            <SettingsIcon className="w-4 h-4" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <EditIcon className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{vendor.name}</DialogTitle>
                                <DialogDescription>
                                  Vendor details and contract information
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-6">
                                {/* Vendor Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="font-medium mb-2">
                                        Contact Information
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex items-center">
                                          <MailIcon className="w-4 h-4 mr-2 text-muted-foreground" />

                                          {vendor.contactName}
                                        </div>
                                        <div className="flex items-center">
                                          <MailIcon className="w-4 h-4 mr-2 text-muted-foreground" />

                                          {vendor.contactEmail}
                                        </div>
                                        <div className="flex items-center">
                                          <PhoneIcon className="w-4 h-4 mr-2 text-muted-foreground" />

                                          {vendor.contactPhone}
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-medium mb-2">
                                        Address
                                      </h4>
                                      <div className="text-sm text-muted-foreground">
                                        <div>{vendor.address.street}</div>
                                        <div>
                                          {vendor.address.city},{" "}
                                          {vendor.address.state}{" "}
                                          {vendor.address.zip}
                                        </div>
                                        <div>{vendor.address.country}</div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="font-medium mb-2">
                                        Contract Details
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Start:
                                          </span>
                                          <span>
                                            {new Date(
                                              vendor.contractStart
                                            ).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            End:
                                          </span>
                                          <span>
                                            {new Date(
                                              vendor.contractEnd
                                            ).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Status:
                                          </span>
                                          {getStatusBadge(vendor.status)}
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-medium mb-2">
                                        Pricing
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        {vendor.ratePerMinute && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Per Minute:
                                            </span>
                                            <span className="font-mono">
                                              ${vendor.ratePerMinute.toFixed(4)}
                                            </span>
                                          </div>
                                        )}
                                        {vendor.ratePerMessage && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Per Message:
                                            </span>
                                            <span className="font-mono">
                                              $
                                              {vendor.ratePerMessage.toFixed(4)}
                                            </span>
                                          </div>
                                        )}
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Monthly Volume:
                                          </span>
                                          <span className="font-mono">
                                            {formatVolume(vendor.monthlyVolume)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Services */}
                                <div>
                                  <h4 className="font-medium mb-2">Services</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {vendor.services.map((service) => (
                                      <Badge key={service} variant="outline">
                                        {service}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Trunk Management Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ServerIcon className="w-5 h-5 text-[#58C5C7]" />

              <CardTitle>Vendor SIP Trunks</CardTitle>
            </div>
            <Badge
              variant="default"
              className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
            >
              {mockVendorTrunks.length} Configured
            </Badge>
          </div>
          <CardDescription>
            Manage SIP trunk configurations for vendor routing and rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#58C5C7]">
                {
                  mockVendorTrunks.filter((t) => t.basic.status === "active")
                    .length
                }
              </div>
              <p className="text-sm text-muted-foreground">Active Trunks</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {mockVendorTrunks.reduce(
                  (sum, t) => sum + (t.stats?.activeCalls || 0),
                  0
                )}
              </div>
              <p className="text-sm text-muted-foreground">Active Calls</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {(
                  mockVendorTrunks.reduce(
                    (sum, t) => sum + (t.stats?.asr || 0),
                    0
                  ) / mockVendorTrunks.length
                ).toFixed(1)}
                %
              </div>
              <p className="text-sm text-muted-foreground">Average ASR</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#FBAD18]">
                {mockVendorTrunks
                  .reduce((sum, t) => sum + (t.stats?.todayMinutes || 0), 0)
                  .toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Today Minutes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center">
            <PhoneIcon className="w-4 h-4 mr-2" />
            Voice Vendors
          </h3>
          <div className="text-sm space-y-1">
            <div>✓ SIP trunk providers</div>
            <div>✓ International routing</div>
            <div>✓ DID number suppliers</div>
            <div>✓ Carrier interconnects</div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center">
            <MessageSquareIcon className="w-4 h-4 mr-2" />
            Messaging Vendors
          </h3>
          <div className="text-sm space-y-1">
            <div>✓ SMS gateway providers</div>
            <div>✓ MMS delivery networks</div>
            <div>✓ A2P messaging platforms</div>
            <div>✓ Campaign management tools</div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center">
            <DatabaseIcon className="w-4 h-4 mr-2" />
            Data Vendors
          </h3>
          <div className="text-sm space-y-1">
            <div>✓ CDR processing services</div>
            <div>✓ Analytics platforms</div>
            <div>✓ LRN/CNAM databases</div>
            <div>✓ Fraud detection services</div>
          </div>
        </div>
      </div>

      {/* Vendor Detail Dialog */}
      <Dialog open={showVendorDetail} onOpenChange={setShowVendorDetail}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TruckIcon className="w-5 h-5" />

              {selectedVendor?.name}
            </DialogTitle>
            <DialogDescription>
              Comprehensive vendor management including trunks, rates, and
              contracts
            </DialogDescription>
          </DialogHeader>
          {selectedVendor && (
            <Tabs
              value={selectedTab}
              onValueChange={setSelectedTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="trunks">SIP Trunks</TabsTrigger>
                <TabsTrigger value="rates">Rates</TabsTrigger>
                <TabsTrigger value="contracts">Contracts</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <VendorOverviewTab vendor={selectedVendor} />
              </TabsContent>

              <TabsContent value="trunks" className="space-y-4">
                <VendorTrunkSection vendor={selectedVendor} />
              </TabsContent>

              <TabsContent value="rates" className="space-y-4">
                <VendorRatesTab vendor={selectedVendor} />
              </TabsContent>

              <TabsContent value="contracts" className="space-y-4">
                <VendorContractsTab vendor={selectedVendor} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Vendor Overview Tab Component
function VendorOverviewTab({ vendor }: { vendor: Vendor }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BuildingIcon className="w-5 h-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MailIcon className="w-4 h-4 text-muted-foreground" />

                <span className="font-medium">{vendor.contactName}</span>
              </div>
              <div className="flex items-center gap-2">
                <MailIcon className="w-4 h-4 text-muted-foreground" />

                <span className="text-sm">{vendor.contactEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <PhoneIcon className="w-4 h-4 text-muted-foreground" />

                <span className="text-sm">{vendor.contactPhone}</span>
              </div>
            </div>
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Address</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>{vendor.address.street}</div>
                <div>
                  {vendor.address.city}, {vendor.address.state}{" "}
                  {vendor.address.zip}
                </div>
                <div>{vendor.address.country}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSignIcon className="w-5 h-5" />
              Financial Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">
                  {vendor.ratePerMinute
                    ? `${vendor.ratePerMinute.toFixed(4)}`
                    : "N/A"}
                </div>
                <p className="text-sm text-muted-foreground">Rate per minute</p>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(vendor.monthlyVolume / 1000).toFixed(0)}K
                </div>
                <p className="text-sm text-muted-foreground">Monthly volume</p>
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge
                  variant={vendor.status === "active" ? "default" : "secondary"}
                >
                  {vendor.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {vendor.services.map((service) => (
              <Badge key={service} variant="outline">
                {service}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Vendor Trunks Tab Component
function VendorTrunksTab({
  vendor,
  trunks,
}: {
  vendor: Vendor;
  trunks: SipTrunk[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SIP Trunk Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Manage inbound and outbound trunk groups for {vendor.name}
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Trunk Group
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownIcon className="w-4 h-4 text-green-600" />
              Inbound Trunks
            </CardTitle>
            <CardDescription>
              Incoming traffic from {vendor.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trunks.length > 0 ? (
              <div className="space-y-3">
                {trunks.slice(0, 2).map((trunk) => (
                  <div key={trunk.basic.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{trunk.basic.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {trunk.stats?.activeCalls || 0} active calls
                        </div>
                      </div>
                      <Badge
                        variant={
                          trunk.basic.status === "active"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {trunk.basic.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Inbound Trunk
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <ServerIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />

                <p className="text-sm text-muted-foreground mb-4">
                  No inbound trunks configured
                </p>
                <Button variant="outline">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Inbound Trunk
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpIcon className="w-4 h-4 text-blue-600" />
              Outbound Trunks
            </CardTitle>
            <CardDescription>Outgoing traffic to {vendor.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <ServerIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />

              <p className="text-sm text-muted-foreground mb-4">
                No outbound trunks configured
              </p>
              <Button variant="outline">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Outbound Trunk
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Vendor Rates Tab Component
function VendorRatesTab({ vendor }: { vendor: Vendor }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rate Management</h3>
          <p className="text-sm text-muted-foreground">
            Configure rates and pricing for {vendor.name} traffic
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Rate Table
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Interstate</div>
                <div className="text-2xl font-bold">
                  $
                  {vendor.ratePerMinute
                    ? vendor.ratePerMinute.toFixed(4)
                    : "0.0000"}
                </div>
                <div className="text-sm text-muted-foreground">per minute</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Intrastate</div>
                <div className="text-2xl font-bold">
                  $
                  {vendor.ratePerMinute
                    ? (vendor.ratePerMinute * 0.9).toFixed(4)
                    : "0.0000"}
                </div>
                <div className="text-sm text-muted-foreground">per minute</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  International
                </div>
                <div className="text-2xl font-bold">
                  $
                  {vendor.ratePerMinute
                    ? (vendor.ratePerMinute * 5).toFixed(4)
                    : "0.0000"}
                </div>
                <div className="text-sm text-muted-foreground">per minute</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Vendor Contracts Tab Component
function VendorContractsTab({ vendor }: { vendor: Vendor }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contract Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage contracts and agreements with {vendor.name}
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          New Contract
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Contract Start:
                  </span>
                  <span className="text-sm font-medium">
                    {new Date(vendor.contractStart).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Contract End:
                  </span>
                  <span className="text-sm font-medium">
                    {new Date(vendor.contractEnd).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge
                    variant={
                      vendor.status === "active" ? "default" : "secondary"
                    }
                  >
                    {vendor.status}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Monthly Commitment:
                  </span>
                  <span className="text-sm font-medium">
                    {(vendor.monthlyVolume / 1000).toFixed(0)}K minutes
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Payment Terms:
                  </span>
                  <span className="text-sm font-medium">Net 30</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Auto Renewal:
                  </span>
                  <span className="text-sm font-medium">Yes</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
