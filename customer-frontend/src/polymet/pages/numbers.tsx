import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  PlusIcon,
  SearchIcon,
  FilterIcon,
  DownloadIcon,
  UploadIcon,
  SettingsIcon,
  PhoneIcon,
  MessageSquareIcon,
  BarChart3Icon,
  EditIcon,
  TrashIcon,
  MapPinIcon,
  ShoppingCartIcon,
  ArrowRightIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  FileTextIcon,
  InfoIcon,
} from "lucide-react";
import {
  mockDidNumbers,
  mockSipTrunks,
  type DidNumber,
} from "@/polymet/data/telecom-mock-data";
import { NumberAcquisitionSection } from "@/polymet/components/number-acquisition-section";
import { NumberPortingSection } from "@/polymet/components/number-porting-section";

export function Numbers() {
  const [activeTab, setActiveTab] = useState("inventory");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<DidNumber | null>(null);

  // Filter numbers based on search and status
  const filteredNumbers = mockDidNumbers.filter((number) => {
    const matchesSearch =
      number.phoneNumber.includes(searchTerm) ||
      number.friendlyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      number.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      number.state.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || number.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: DidNumber["status"]) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      porting: "outline",
    } as const;

    const colors = {
      active: "bg-[#58C5C7] hover:bg-[#58C5C7]/80",
      inactive: "bg-gray-500 hover:bg-gray-500/80",
      porting: "border-[#FBAD18] text-[#FBAD18]",
    };

    return (
      <Badge
        variant={variants[status]}
        className={status === "active" ? colors[status] : undefined}
      >
        {status}
      </Badge>
    );
  };

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
    }
    return number;
  };

  const handleSelectNumber = (numberId: string) => {
    setSelectedNumbers((prev) =>
      prev.includes(numberId)
        ? prev.filter((id) => id !== numberId)
        : [...prev, numberId]
    );
  };

  const handleSelectAll = () => {
    if (selectedNumbers.length === filteredNumbers.length) {
      setSelectedNumbers([]);
    } else {
      setSelectedNumbers(filteredNumbers.map((n) => n.id));
    }
  };

  const openConfigDialog = (number: DidNumber) => {
    setSelectedNumber(number);
    setShowConfigDialog(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#231F20]">Numbers</h1>
          <p className="text-gray-600">
            Manage your DID and toll-free number inventory
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={() => setShowBulkDialog(true)}>
            <UploadIcon className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Numbers
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Add New Numbers</DialogTitle>
                <DialogDescription>
                  Search and purchase local or toll-free numbers with advanced
                  filtering
                </DialogDescription>
              </DialogHeader>
              <NumberAcquisitionSection />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Numbers</CardTitle>
            <PhoneIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDidNumbers.length}</div>
            <p className="text-xs text-muted-foreground">
              {mockDidNumbers.filter((n) => n.status === "active").length}{" "}
              active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {mockDidNumbers
                .reduce((sum, n) => sum + n.monthlyRate, 0)
                .toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Per month recurring</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Messaging Enabled
            </CardTitle>
            <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockDidNumbers.filter((n) => n.messagingEnabled).length}
            </div>
            <p className="text-xs text-muted-foreground">SMS/MMS capable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Porting Status
            </CardTitle>
            <MapPinIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockDidNumbers.filter((n) => n.status === "porting").length}
            </div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inventory">Number Inventory</TabsTrigger>
          <TabsTrigger value="acquisition">Number Acquisition</TabsTrigger>
          <TabsTrigger value="porting">Porting</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-6">
          {/* Filters and Actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Number Inventory</CardTitle>
                  <CardDescription>
                    {filteredNumbers.length} of {mockDidNumbers.length} numbers
                    {selectedNumbers.length > 0 &&
                      ` • ${selectedNumbers.length} selected`}
                  </CardDescription>
                </div>

                {selectedNumbers.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <SettingsIcon className="w-4 h-4 mr-2" />
                      Bulk Configure
                    </Button>
                    <Button variant="outline" size="sm">
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                  <Input
                    placeholder="Search by number, name, or location..."
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
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="porting">Porting</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm">
                  <FilterIcon className="w-4 h-4 mr-2" />
                  More Filters
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            selectedNumbers.length === filteredNumbers.length &&
                            filteredNumbers.length > 0
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SIP Trunk</TableHead>
                      <TableHead>Messaging</TableHead>
                      <TableHead>Monthly Rate</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNumbers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No numbers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredNumbers.map((number) => (
                        <TableRow key={number.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedNumbers.includes(number.id)}
                              onCheckedChange={() =>
                                handleSelectNumber(number.id)
                              }
                            />
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {formatPhoneNumber(number.phoneNumber)}
                          </TableCell>
                          <TableCell>
                            {number.friendlyName || (
                              <span className="text-muted-foreground italic">
                                No name set
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {number.city}, {number.state}
                          </TableCell>
                          <TableCell>{getStatusBadge(number.status)}</TableCell>
                          <TableCell>
                            {number.assignedTrunk ? (
                              <Badge variant="outline">
                                {mockSipTrunks.find(
                                  (t) => t.id === number.assignedTrunk
                                )?.name || "Unknown"}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                Unassigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                number.messagingEnabled
                                  ? "default"
                                  : "secondary"
                              }
                              className={
                                number.messagingEnabled
                                  ? "bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                                  : ""
                              }
                            >
                              {number.messagingEnabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            ${number.monthlyRate.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openConfigDialog(number)}
                              >
                                <SettingsIcon className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <BarChart3Icon className="w-4 h-4" />
                              </Button>
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
        </TabsContent>

        <TabsContent value="acquisition" className="space-y-6">
          <NumberAcquisitionSection />
        </TabsContent>

        <TabsContent value="porting" className="space-y-6">
          <NumberPortingSection />
        </TabsContent>
      </Tabs>

      {/* Number Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Configure Number</DialogTitle>
            <DialogDescription>
              {selectedNumber && formatPhoneNumber(selectedNumber.phoneNumber)}
            </DialogDescription>
          </DialogHeader>
          {selectedNumber && <NumberConfiguration number={selectedNumber} />}
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Numbers</DialogTitle>
            <DialogDescription>
              Upload a CSV file with your existing numbers
            </DialogDescription>
          </DialogHeader>
          <BulkImport />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Number Configuration Component
function NumberConfiguration({ number }: { number: DidNumber }) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="space-y-2">
            <Label>Friendly Name</Label>
            <Input
              defaultValue={number.friendlyName || ""}
              placeholder="e.g., Main Office Line"
            />
          </div>

          <div className="space-y-2">
            <Label>CNAM (Caller ID Name)</Label>
            <Input
              defaultValue={number.cnam || ""}
              placeholder="e.g., Ringer Inc"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select defaultValue={number.status}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="routing" className="space-y-4">
          <div className="space-y-2">
            <Label>Assigned SIP Trunk</Label>
            <Select defaultValue={number.assignedTrunk || ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select SIP trunk" />
              </SelectTrigger>
              <SelectContent>
                {mockSipTrunks.map((trunk) => (
                  <SelectItem key={trunk.id} value={trunk.id}>
                    {trunk.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Failover Destination</Label>
            <Input placeholder="e.g., +1234567890 or sip:user@domain.com" />
          </div>
        </TabsContent>

        <TabsContent value="messaging" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox defaultChecked={number.messagingEnabled} />

            <Label>Enable SMS/MMS</Label>
          </div>

          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input placeholder="https://your-app.com/webhooks/sms" />
          </div>

          <div className="space-y-2">
            <Label>Message Routing</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select routing method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="email">Email Forward</SelectItem>
                <SelectItem value="sip">SIP MESSAGE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="reporting" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">Total calls</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">567</div>
                <p className="text-xs text-muted-foreground">
                  SMS sent/received
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <Label>Usage Alerts</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox />

                <Label className="text-sm">
                  Alert when monthly calls exceed 1000
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox />

                <Label className="text-sm">
                  Alert when monthly cost exceeds $50
                </Label>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline">Cancel</Button>
        <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

// Bulk Import Component
function BulkImport() {
  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />

        <div className="mt-2">
          <p className="text-sm text-gray-600">
            Drop your CSV file here, or{" "}
            <Button variant="link" className="p-0 h-auto text-[#58C5C7]">
              browse
            </Button>
          </p>
        </div>
        <p className="text-xs text-gray-500 mt-1">CSV files up to 10MB</p>
      </div>

      <div className="text-sm text-gray-600">
        <p className="font-medium">CSV Format Requirements:</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>phone_number (required)</li>
          <li>friendly_name (optional)</li>
          <li>cnam (optional)</li>
          <li>messaging_enabled (true/false)</li>
        </ul>
      </div>

      <div className="flex justify-end space-x-3">
        <Button variant="outline">Download Template</Button>
        <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
          Import Numbers
        </Button>
      </div>
    </div>
  );
}
