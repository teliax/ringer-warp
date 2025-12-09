import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  MapPinIcon,
  AlertCircleIcon,
} from "lucide-react";
import { useNumbers } from "@/hooks/useNumbers";
import { useTrunks, TrunkGroup } from "@/hooks/useTrunks";
import { AssignedNumber, NumberInventorySummary, UpdateNumberRequest } from "@/types/numbers";
import { NumberAcquisitionSection } from "@/polymet/components/number-acquisition-section";
import { NumberPortingSection } from "@/polymet/components/number-porting-section";
import { useToast } from "@/hooks/use-toast";

export function Numbers() {
  const [activeTab, setActiveTab] = useState("inventory");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<AssignedNumber | null>(null);

  // API hooks
  const { listNumbers, getInventorySummary, formatPhoneNumber, loading, error } = useNumbers();
  const { listMyTrunks } = useTrunks();
  const { toast } = useToast();

  // Data state
  const [numbers, setNumbers] = useState<AssignedNumber[]>([]);
  const [trunks, setTrunks] = useState<TrunkGroup[]>([]);
  const [summary, setSummary] = useState<NumberInventorySummary | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [page, statusFilter]);

  // Fetch trunks for display
  useEffect(() => {
    // TODO: Temporarily disabled - trunk endpoint returns 401
    // Re-enable after fixing trunk permissions
    // fetchTrunks();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [numbersResponse, summaryResponse] = await Promise.all([
        listNumbers({
          page,
          per_page: 20,
          active_only: statusFilter === "active",
          search: searchTerm || undefined,
        }),
        getInventorySummary(),
      ]);

      setNumbers(numbersResponse.numbers || []);
      setTotalElements(numbersResponse.total_elements);
      setSummary(summaryResponse);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load number inventory",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrunks = async () => {
    try {
      const trunkList = await listMyTrunks();
      setTrunks(trunkList || []);
    } catch (err) {
      // Trunks are optional for display
    }
  };

  // Handle search on Enter key
  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  // Filter numbers based on search (client-side for current page)
  const filteredNumbers = numbers.filter((number) => {
    if (!searchTerm) return true;
    const matchesSearch =
      number.number.includes(searchTerm) ||
      number.friendly_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      number.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      number.rate_center?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (number: AssignedNumber) => {
    if (!number.active) {
      return <Badge variant="secondary">Released</Badge>;
    }
    return (
      <Badge className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">Active</Badge>
    );
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

  const openConfigDialog = (number: AssignedNumber) => {
    setSelectedNumber(number);
    setShowConfigDialog(true);
  };

  const getTrunkName = (trunkId?: string) => {
    if (!trunkId) return null;
    const trunk = trunks.find((t) => t.id === trunkId);
    return trunk?.name || "Unknown";
  };

  // Loading skeleton
  const renderSkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

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
              <NumberAcquisitionSection onPurchaseComplete={fetchData} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
          <AlertCircleIcon className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {isLoading && activeTab === "inventory" ? (
        renderSkeleton()
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Numbers</CardTitle>
                <PhoneIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.active_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  active numbers
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
                  ${(summary?.total_monthly_charge || 0).toFixed(2)}
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
                  {summary?.sms_enabled_count || 0}
                </div>
                <p className="text-xs text-muted-foreground">SMS/MMS capable</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Voice Enabled
                </CardTitle>
                <PhoneIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.voice_enabled_count || 0}
                </div>
                <p className="text-xs text-muted-foreground">With trunk assigned</p>
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
                        {filteredNumbers.length} of {totalElements} numbers
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
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="pl-10"
                      />
                    </div>

                    <Select value={statusFilter} onValueChange={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="all">All Status</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" onClick={handleSearch}>
                      <FilterIcon className="w-4 h-4 mr-2" />
                      Search
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
                        {loading ? (
                          // Loading state
                          [1, 2, 3].map((i) => (
                            <TableRow key={i}>
                              <TableCell colSpan={9}>
                                <Skeleton className="h-8 w-full" />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : filteredNumbers.length === 0 ? (
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
                                {formatPhoneNumber(number.number)}
                              </TableCell>
                              <TableCell>
                                {number.friendly_name || (
                                  <span className="text-muted-foreground italic">
                                    No name set
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {number.rate_center && number.state
                                  ? `${number.rate_center}, ${number.state}`
                                  : number.state || "-"}
                              </TableCell>
                              <TableCell>{getStatusBadge(number)}</TableCell>
                              <TableCell>
                                {number.trunk_id ? (
                                  <Badge variant="outline">
                                    {getTrunkName(number.trunk_id)}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">
                                    Unassigned
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={number.sms_enabled ? "default" : "secondary"}
                                  className={
                                    number.sms_enabled
                                      ? "bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                                      : ""
                                  }
                                >
                                  {number.sms_enabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono">
                                ${(number.monthly_charge || 0).toFixed(2)}
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

                  {/* Pagination */}
                  {totalElements > 20 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {page} of {Math.ceil(totalElements / 20)}
                      </p>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= Math.ceil(totalElements / 20)}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="acquisition" className="space-y-6">
              <NumberAcquisitionSection onPurchaseComplete={fetchData} />
            </TabsContent>

            <TabsContent value="porting" className="space-y-6">
              <NumberPortingSection />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Number Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Configure Number</DialogTitle>
            <DialogDescription>
              {selectedNumber && formatPhoneNumber(selectedNumber.number)}
            </DialogDescription>
          </DialogHeader>
          {selectedNumber && (
            <NumberConfiguration
              number={selectedNumber}
              trunks={trunks}
              onSave={() => {
                setShowConfigDialog(false);
                fetchData();
              }}
              onCancel={() => setShowConfigDialog(false)}
            />
          )}
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
interface NumberConfigurationProps {
  number: AssignedNumber;
  trunks: TrunkGroup[];
  onSave: () => void;
  onCancel: () => void;
}

function NumberConfiguration({ number, trunks, onSave, onCancel }: NumberConfigurationProps) {
  const { updateNumber, releaseNumber, formatPhoneNumber, loading } = useNumbers();
  const { toast } = useToast();

  const [formData, setFormData] = useState<UpdateNumberRequest>({
    friendly_name: number.friendly_name || "",
    cnam_display_name: number.cnam_display_name || "",
    voice_enabled: number.voice_enabled,
    sms_enabled: number.sms_enabled,
    trunk_id: number.trunk_id,
    voice_destination: number.voice_destination || "",
    voice_failover_destination: number.voice_failover_destination || "",
    e911_enabled: number.e911_enabled,
    cnam_enabled: number.cnam_enabled,
  });

  const handleSave = async () => {
    try {
      await updateNumber(number.id, formData);
      toast({
        title: "Success",
        description: "Number configuration updated",
      });
      onSave();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update number configuration",
        variant: "destructive",
      });
    }
  };

  const handleRelease = async () => {
    if (!confirm("Are you sure you want to release this number? This action cannot be undone.")) {
      return;
    }
    try {
      await releaseNumber(number.id, "User requested release");
      toast({
        title: "Success",
        description: "Number released successfully",
      });
      onSave();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to release number",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="space-y-2">
            <Label>Friendly Name</Label>
            <Input
              value={formData.friendly_name || ""}
              onChange={(e) => setFormData({ ...formData, friendly_name: e.target.value })}
              placeholder="e.g., Main Office Line"
            />
          </div>

          <div className="space-y-2">
            <Label>CNAM (Caller ID Name)</Label>
            <Input
              value={formData.cnam_display_name || ""}
              onChange={(e) => setFormData({ ...formData, cnam_display_name: e.target.value })}
              placeholder="e.g., Ringer Inc"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="bg-muted p-3 rounded-lg">
              <Label className="text-sm text-muted-foreground">Number Type</Label>
              <p className="font-medium">{number.number_type}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <Label className="text-sm text-muted-foreground">Area Code</Label>
              <p className="font-medium">{number.npa || "-"}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <Label className="text-sm text-muted-foreground">Rate Center</Label>
              <p className="font-medium">{number.rate_center || "-"}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <Label className="text-sm text-muted-foreground">State</Label>
              <p className="font-medium">{number.state || "-"}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="routing" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={formData.voice_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, voice_enabled: checked as boolean })
              }
            />
            <Label>Voice Enabled</Label>
          </div>

          <div className="space-y-2">
            <Label>Assigned SIP Trunk</Label>
            <Select
              value={formData.trunk_id || ""}
              onValueChange={(value) => setFormData({ ...formData, trunk_id: value || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select SIP trunk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No trunk assigned</SelectItem>
                {trunks.map((trunk) => (
                  <SelectItem key={trunk.id} value={trunk.id}>
                    {trunk.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Voice Destination</Label>
            <Input
              value={formData.voice_destination || ""}
              onChange={(e) => setFormData({ ...formData, voice_destination: e.target.value })}
              placeholder="e.g., +1234567890 or sip:user@domain.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Failover Destination</Label>
            <Input
              value={formData.voice_failover_destination || ""}
              onChange={(e) => setFormData({ ...formData, voice_failover_destination: e.target.value })}
              placeholder="e.g., +1234567890 or sip:user@domain.com"
            />
          </div>
        </TabsContent>

        <TabsContent value="messaging" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={formData.sms_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, sms_enabled: checked as boolean })
              }
            />
            <Label>Enable SMS/MMS</Label>
          </div>

          {number.campaign_id && (
            <div className="bg-muted p-3 rounded-lg">
              <Label className="text-sm text-muted-foreground">Linked Campaign</Label>
              <p className="font-medium">{number.campaign_id}</p>
              <p className="text-xs text-muted-foreground mt-1">
                TCR Status: {number.tcr_status || "Unknown"}
              </p>
            </div>
          )}

          {!number.campaign_id && formData.sms_enabled && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                This number is not linked to a TCR campaign. SMS may be blocked by carriers.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={formData.e911_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, e911_enabled: checked as boolean })
              }
            />
            <Label>E911 Enabled</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              checked={formData.cnam_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, cnam_enabled: checked as boolean })
              }
            />
            <Label>CNAM Lookup Enabled</Label>
          </div>

          <div className="pt-4 border-t">
            <Button variant="destructive" onClick={handleRelease} disabled={loading}>
              Release This Number
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Releasing a number will remove it from your inventory. This action cannot be undone.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Configuration"}
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
