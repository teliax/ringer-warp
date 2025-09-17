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
  PlusIcon,
  SettingsIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  ActivityIcon,
  SearchIcon,
  DownloadIcon,
} from "lucide-react";
import { TrunkConfigForm } from "@/polymet/components/forms";
import {
  mockSipTrunks,
  mockCdrRecords,
  type SipTrunk,
  type CdrRecord,
} from "@/polymet/data/telecom-mock-data";
import { Input } from "@/components/ui/input";

export function Trunks() {
  const [trunks, setTrunks] = useState(mockSipTrunks);
  const [selectedTrunk, setSelectedTrunk] = useState<SipTrunk | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const getStatusBadge = (status: SipTrunk["status"]) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      maintenance: "destructive",
    } as const;

    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getUtilizationPercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  const formatLastActivity = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleCreateTrunk = () => {
    setSelectedTrunk(null);
    setIsDialogOpen(true);
  };

  const handleEditTrunk = (trunk: SipTrunk) => {
    setSelectedTrunk(trunk);
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: Partial<SipTrunk>) => {
    if (selectedTrunk) {
      // Update existing trunk
      setTrunks((prev) =>
        prev.map((trunk) =>
          trunk.id === selectedTrunk.id ? { ...trunk, ...data } : trunk
        )
      );
    } else {
      // Create new trunk
      const newTrunk: SipTrunk = {
        id: `trunk-${Date.now()}`,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        currentCalls: 0,
        ...data,
      } as SipTrunk;
      setTrunks((prev) => [...prev, newTrunk]);
    }
    setIsDialogOpen(false);
  };

  const handleCdrExport = (records: CdrRecord[]) => {
    // Generate CSV content
    const csvContent = generateCdrCsvContent(records);
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cdr-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateCdrCsvContent = (records: CdrRecord[]): string => {
    const headers = [
      "ID",
      "Start Stamp",
      "Progress Stamp",
      "Answer Stamp",
      "End Stamp",
      "Account",
      "CPN",
      "CPN OCN",
      "CPN LRN",
      "CPN ROR",
      "CPN LATA",
      "CPN Locality",
      "DNI",
      "DNI OCN",
      "DNI LRN",
      "DNI ROR",
      "DNI LATA",
      "DNI Locality",
      "Raw Seconds",
      "Billed Seconds",
      "Rate",
      "Cost",
      "Direction",
      "Zone",
      "CIC",
      "Normalized",
      "Billed",
      "Disposition",
      "Status",
      "Term Code",
      "CNAM",
      "Call ID",
      "Orig IP",
      "Term IP",
    ];

    const rows = records.map((record) => [
      record.id,
      record.start_stamp,
      record.progress_stamp || "",
      record.answer_stamp || "",
      record.end_stamp,
      record.account,
      record.cpn,
      record.cpn_ocn || "",
      record.cpn_lrn || "",
      record.cpn_ror || "",
      record.cpn_lata || "",
      record.cpn_locality || "",
      record.dni,
      record.dni_ocn || "",
      record.dni_lrn || "",
      record.dni_ror || "",
      record.dni_lata || "",
      record.dni_locality || "",
      record.raw_seconds,
      record.billed_seconds,
      record.rate,
      record.cost,
      record.direction,
      record.zone,
      record.cic || "",
      record.normalized,
      record.billed,
      record.disposition,
      record.status,
      record.term_code || "",
      record.cnam || "",
      record.callid,
      record.orig_ip,
      record.term_ip || "",
    ]);

    return [headers, ...rows]
      .map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
  };

  const totalCapacity = trunks.reduce(
    (sum, trunk) => sum + trunk.maxConcurrentCalls,
    0
  );
  const totalUsage = trunks.reduce((sum, trunk) => sum + trunk.currentCalls, 0);
  const activeTrunks = trunks.filter(
    (trunk) => trunk.status === "active"
  ).length;

  return (
    <div className="p-6 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">SIP Trunks Overview</TabsTrigger>
          <TabsTrigger value="cdr-search">CDR Search</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">SIP Trunks</h1>
              <p className="text-muted-foreground">
                Manage your SIP trunk configurations and monitor performance
              </p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleCreateTrunk}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Trunk
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedTrunk ? "Edit SIP Trunk" : "Create New SIP Trunk"}
                  </DialogTitle>
                  <DialogDescription>
                    Configure your SIP trunk settings including IP whitelisting,
                    codecs, and capacity limits
                  </DialogDescription>
                </DialogHeader>
                <TrunkConfigForm
                  trunk={selectedTrunk}
                  onSubmit={handleSubmit}
                  onCancel={() => setIsDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Trunks
                </CardTitle>
                <ActivityIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{trunks.length}</div>
                <p className="text-xs text-muted-foreground">
                  {activeTrunks} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Capacity
                </CardTitle>
                <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCapacity}</div>
                <p className="text-xs text-muted-foreground">
                  concurrent calls
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Current Usage
                </CardTitle>
                <PlayIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsage}</div>
                <p className="text-xs text-muted-foreground">active calls</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Utilization
                </CardTitle>
                <ActivityIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round((totalUsage / totalCapacity) * 100)}%
                </div>
                <Progress
                  value={(totalUsage / totalCapacity) * 100}
                  className="mt-2"
                />
              </CardContent>
            </Card>
          </div>

          {/* Trunks Table */}
          <Card>
            <CardHeader>
              <CardTitle>SIP Trunks</CardTitle>
              <CardDescription>
                Manage and monitor your SIP trunk configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Codecs</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trunks.map((trunk) => (
                      <TableRow key={trunk.id}>
                        <TableCell className="font-medium">
                          {trunk.name}
                        </TableCell>
                        <TableCell>{getStatusBadge(trunk.status)}</TableCell>
                        <TableCell className="font-mono">
                          {trunk.ipAddress}:{trunk.port}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>
                                {trunk.currentCalls}/{trunk.maxConcurrentCalls}
                              </span>
                              <span>
                                {getUtilizationPercentage(
                                  trunk.currentCalls,
                                  trunk.maxConcurrentCalls
                                )}
                                %
                              </span>
                            </div>
                            <Progress
                              value={getUtilizationPercentage(
                                trunk.currentCalls,
                                trunk.maxConcurrentCalls
                              )}
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {trunk.codecs.slice(0, 2).map((codec) => (
                              <Badge
                                key={codec}
                                variant="outline"
                                className="text-xs"
                              >
                                {codec}
                              </Badge>
                            ))}
                            {trunk.codecs.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{trunk.codecs.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatLastActivity(trunk.lastActivity)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTrunk(trunk)}
                            >
                              <SettingsIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cdr-search" className="space-y-6">
          {/* CDR Search Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-2">
                <SearchIcon className="w-8 h-8 text-[#58C5C7]" />

                <span>CDR Search</span>
              </h1>
              <p className="text-muted-foreground">
                Search and export Call Detail Records with comprehensive
                filtering options
              </p>
            </div>
          </div>

          {/* CDR Search Form */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <SearchIcon className="w-5 h-5 text-[#58C5C7]" />

                    <span>CDR Search & Export</span>
                  </CardTitle>
                  <CardDescription>
                    Search Call Detail Records with comprehensive filtering and
                    export capabilities
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="datetime-local" placeholder="Start date" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input type="datetime-local" placeholder="End date" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input placeholder="e.g., +15551234567" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account</label>
                  <Input placeholder="Account name" />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button>
                  <SearchIcon className="w-4 h-4 mr-2" />
                  Search CDR Records
                </Button>
                <Button variant="outline" onClick={handleCdrExport}>
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export Results
                </Button>
              </div>

              <div className="border rounded-lg p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">
                  CDR Search Features:
                </p>
                <ul className="text-sm space-y-1">
                  <li>• Search across all 34 CDR fields</li>
                  <li>• Date range filtering</li>
                  <li>• Phone number partial matching</li>
                  <li>• Cost and duration range queries</li>
                  <li>• Export to CSV with all fields</li>
                  <li>• API preview with cURL commands</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
