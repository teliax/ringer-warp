import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  UploadIcon,
  DownloadIcon,
  RefreshCwIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  DollarSignIcon,
  BarChart3Icon,
  FileTextIcon,
  SearchIcon,
  FilterIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
} from "lucide-react";
import {
  mockRateTemplates,
  mockTrunks,
  mockTrunkStats,
  type RateTemplate,
} from "@/polymet/data/trunk-mock-data";

export function RateManagement() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Mock rate analysis data
  const rateAnalysis = {
    totalTrunks: mockTrunkStats.totalTrunks,
    avgInterstateRate: 0.0085,
    avgIntrastateRate: 0.0075,
    avgInternationalRate: 0.125,
    rateVariance: 15.2,
    lastUpdated: new Date().toISOString(),
    trendsData: [
      {
        period: "Jan",
        interstate: 0.0082,
        intrastate: 0.0072,
        international: 0.122,
      },
      {
        period: "Feb",
        interstate: 0.0083,
        intrastate: 0.0073,
        international: 0.123,
      },
      {
        period: "Mar",
        interstate: 0.0085,
        intrastate: 0.0075,
        international: 0.125,
      },
    ],
  };

  const handleBulkRateUpdate = () => {
    console.log("Starting bulk rate update...");
    setIsImporting(true);
    setImportProgress(0);

    // Simulate import progress
    const interval = setInterval(() => {
      setImportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsImporting(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleTemplateCreate = () => {
    console.log("Creating new rate template...");
  };

  const handleTemplateEdit = (templateId: string) => {
    console.log("Editing template:", templateId);
  };

  const handleTemplateDelete = (templateId: string) => {
    console.log("Deleting template:", templateId);
  };

  const filteredTemplates = mockRateTemplates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || template.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rate Management</h1>
          <p className="text-muted-foreground">
            Manage rates, templates, and bulk operations across all SIP trunks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <DownloadIcon className="w-4 h-4 mr-2" />
            Export All Rates
          </Button>
          <Button
            onClick={handleBulkRateUpdate}
            className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
          >
            <UploadIcon className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
        </div>
      </div>

      {/* Rate Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Interstate Rate
            </CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${rateAnalysis.avgInterstateRate.toFixed(5)}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              +2.4% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Intrastate Rate
            </CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${rateAnalysis.avgIntrastateRate.toFixed(5)}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              +1.8% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg International Rate
            </CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${rateAnalysis.avgInternationalRate.toFixed(5)}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingDownIcon className="inline w-3 h-3 mr-1" />
              -0.8% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Variance</CardTitle>
            <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rateAnalysis.rateVariance}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across {rateAnalysis.totalTrunks} trunks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Import Progress */}
      {isImporting && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCwIcon className="w-4 h-4 animate-spin" />
              Importing Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing rate updates...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates">Rate Templates</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
          <TabsTrigger value="analysis">Rate Analysis</TabsTrigger>
          <TabsTrigger value="history">Rate History</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rate Templates</CardTitle>
                  <CardDescription>
                    Manage predefined rate templates for quick trunk
                    configuration
                  </CardDescription>
                </div>
                <Button
                  onClick={handleTemplateCreate}
                  className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter */}
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />

                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-48">
                    <FilterIcon className="w-4 h-4 mr-2" />

                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Templates Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Interstate</TableHead>
                      <TableHead>Intrastate</TableHead>
                      <TableHead>International</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {template.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          ${template.rates.interstate}
                        </TableCell>
                        <TableCell className="font-mono">
                          ${template.rates.intrastate}
                        </TableCell>
                        <TableCell className="font-mono">
                          ${template.rates.international}
                        </TableCell>
                        <TableCell>
                          {new Date(template.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleTemplateEdit(template.id)}
                            >
                              <EditIcon className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleTemplateDelete(template.id)}
                            >
                              <TrashIcon className="w-3 h-3" />
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

        <TabsContent value="bulk" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Rate Import</CardTitle>
                <CardDescription>
                  Import rates from CSV or Excel files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <UploadIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />

                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop your rate file here, or click to browse
                  </p>
                  <Button variant="outline">Choose File</Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Supported formats: CSV, Excel (.xlsx, .xls)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bulk Rate Export</CardTitle>
                <CardDescription>
                  Export current rates for analysis or backup
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Export Format</Label>
                  <Select defaultValue="csv">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Include</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="includeOverrides"
                        defaultChecked
                      />

                      <Label htmlFor="includeOverrides" className="text-sm">
                        Override rules
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="includeHistory" />

                      <Label htmlFor="includeHistory" className="text-sm">
                        Rate history
                      </Label>
                    </div>
                  </div>
                </div>
                <Button className="w-full">
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export Rates
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Analysis & Trends</CardTitle>
              <CardDescription>
                Analyze rate patterns and identify optimization opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Rate Distribution</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Low ($0.001-$0.005)</span>
                        <span>45%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Medium ($0.005-$0.015)</span>
                        <span>35%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>High ($0.015+)</span>
                        <span>20%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Top Cost Centers</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>International</span>
                        <span>$12,450</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Interstate</span>
                        <span>$8,230</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Intrastate</span>
                        <span>$5,120</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Optimization Potential</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Potential Savings</span>
                        <span className="text-green-600">$2,340</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overpriced Routes</span>
                        <span>12</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Optimization Score</span>
                        <span>78%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Change History</CardTitle>
              <CardDescription>
                Track all rate changes and their impact
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search by trunk, rate, or user..."
                    className="flex-1"
                  />

                  <Select defaultValue="all">
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Changes</SelectItem>
                      <SelectItem value="rate-increase">
                        Rate Increases
                      </SelectItem>
                      <SelectItem value="rate-decrease">
                        Rate Decreases
                      </SelectItem>
                      <SelectItem value="new-rates">New Rates</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Trunk</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead>Old Rate</TableHead>
                        <TableHead>New Rate</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>User</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>2024-03-15</TableCell>
                        <TableCell>Acme Corp - Primary</TableCell>
                        <TableCell>Interstate</TableCell>
                        <TableCell className="font-mono">$0.00800</TableCell>
                        <TableCell className="font-mono">$0.00850</TableCell>
                        <TableCell>
                          <Badge variant="destructive">+6.25%</Badge>
                        </TableCell>
                        <TableCell>admin@ringer.tel</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>2024-03-14</TableCell>
                        <TableCell>TechStart - Backup</TableCell>
                        <TableCell>International</TableCell>
                        <TableCell className="font-mono">$0.13000</TableCell>
                        <TableCell className="font-mono">$0.12500</TableCell>
                        <TableCell>
                          <Badge variant="default">-3.85%</Badge>
                        </TableCell>
                        <TableCell>admin@ringer.tel</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
