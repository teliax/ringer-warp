import React, { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  DollarSignIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  BarChart3Icon,
  PlusIcon,
  EditIcon,
  DownloadIcon,
  UploadIcon,
} from "lucide-react";
import {
  mockRateTemplates,
  type SipTrunk,
} from "@/polymet/data/trunk-mock-data";
import { mockVendors } from "@/polymet/data/admin-mock-data";

interface ContextualRateManagementProps {
  trunk: SipTrunk;
  trunkType: "customer" | "vendor";
  onRateUpdate?: (trunkId: string, rates: any) => void;
}

interface RateZone {
  zone: string;
  description: string;
  customerRate: number;
  vendorRate: number;
  margin: number;
  marginPercent: number;
  volume: number;
  revenue: number;
  cost: number;
  profit: number;
  status: "healthy" | "warning" | "critical";
}

interface MarginAnalysis {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  overallMargin: number;
  profitableZones: number;
  totalZones: number;
  riskZones: string[];
}

export function ContextualRateManagement({
  trunk,
  trunkType,
  onRateUpdate,
}: ContextualRateManagementProps) {
  // Safety check for trunk prop
  if (!trunk) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No trunk data available
      </div>
    );
  }
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [newRates, setNewRates] = useState<Record<string, number>>({});

  // Mock rate data with margin analysis
  const rateZones: RateZone[] = useMemo(() => {
    const zones = [
      {
        zone: "DOM",
        description: "Domestic (US/Canada)",
        customerRate: 0.0095,
        vendorRate: 0.0045,
        volume: 125000,
      },
      {
        zone: "INTL",
        description: "International",
        customerRate: 0.085,
        vendorRate: 0.042,
        volume: 15000,
      },
      {
        zone: "TF",
        description: "Toll-Free",
        customerRate: 0.0125,
        vendorRate: 0.0065,
        volume: 45000,
      },
      {
        zone: "LOCAL",
        description: "Local/Intrastate",
        customerRate: 0.0075,
        vendorRate: 0.0035,
        volume: 85000,
      },
      {
        zone: "MOBILE",
        description: "Mobile Termination",
        customerRate: 0.0155,
        vendorRate: 0.0095,
        volume: 35000,
      },
    ];

    return zones.map((zone) => {
      const customerRate = zone.customerRate || 0;
      const vendorRate = zone.vendorRate || 0;
      const volume = zone.volume || 0;

      const margin = customerRate - vendorRate;
      const marginPercent =
        customerRate > 0 ? (margin / customerRate) * 100 : 0;
      const revenue = (volume * customerRate) / 60; // Per minute to per second
      const cost = (volume * vendorRate) / 60;
      const profit = revenue - cost;

      let status: "healthy" | "warning" | "critical" = "healthy";
      if (marginPercent < 20) status = "critical";
      else if (marginPercent < 40) status = "warning";

      return {
        ...zone,
        margin: margin || 0,
        marginPercent: marginPercent || 0,
        revenue: revenue || 0,
        cost: cost || 0,
        profit: profit || 0,
        status,
      };
    });
  }, []);

  const marginAnalysis: MarginAnalysis = useMemo(() => {
    const totalRevenue = rateZones.reduce(
      (sum, zone) => sum + (zone.revenue || 0),
      0
    );
    const totalCost = rateZones.reduce(
      (sum, zone) => sum + (zone.cost || 0),
      0
    );
    const totalProfit = totalRevenue - totalCost;
    const overallMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const profitableZones = rateZones.filter(
      (zone) => (zone.profit || 0) > 0
    ).length;
    const riskZones = rateZones
      .filter((zone) => zone.status === "critical")
      .map((zone) => zone.zone);

    return {
      totalRevenue: totalRevenue || 0,
      totalCost: totalCost || 0,
      totalProfit: totalProfit || 0,
      overallMargin: overallMargin || 0,
      profitableZones: profitableZones || 0,
      totalZones: rateZones.length || 0,
      riskZones: riskZones || [],
    };
  }, [rateZones]);

  const handleRateChange = (zone: string, newRate: number) => {
    setNewRates((prev) => ({ ...prev, [zone]: newRate }));
  };

  const handleSaveRates = () => {
    if (onRateUpdate && trunk?.basic?.id) {
      onRateUpdate(trunk.basic.id, newRates);
    }
    setEditingZone(null);
    setNewRates({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "critical":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getMarginIcon = (marginPercent: number) => {
    if (marginPercent >= 40)
      return <TrendingUpIcon className="w-4 h-4 text-green-600" />;

    if (marginPercent >= 20)
      return <AlertTriangleIcon className="w-4 h-4 text-yellow-600" />;

    return <TrendingDownIcon className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Margin Analysis Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${(marginAnalysis.totalRevenue || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Monthly projection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${(marginAnalysis.totalCost || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Vendor payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#58C5C7]">
              ${(marginAnalysis.totalProfit || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(marginAnalysis.overallMargin || 0).toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zone Health</CardTitle>
            <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marginAnalysis.profitableZones}/{marginAnalysis.totalZones}
            </div>
            <p className="text-xs text-muted-foreground">Profitable zones</p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Alerts */}
      {marginAnalysis.riskZones.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center">
              <AlertTriangleIcon className="w-5 h-5 mr-2" />
              Margin Risk Alert
            </CardTitle>
            <CardDescription className="text-red-700">
              The following zones have margins below 20% and require attention:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {marginAnalysis.riskZones.map((zone) => (
                <Badge key={zone} variant="destructive">
                  {zone}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="rates" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rates">Rate Management</TabsTrigger>
          <TabsTrigger value="analysis">Margin Analysis</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zone-Based Rate Configuration</CardTitle>
              <CardDescription>
                Manage {trunkType} rates with real-time margin calculation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Button size="sm">
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Add Zone
                    </Button>
                    <Button size="sm" variant="outline">
                      <UploadIcon className="w-4 h-4 mr-2" />
                      Import Rates
                    </Button>
                    <Button size="sm" variant="outline">
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Export Rates
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">
                        Customer Rate
                      </TableHead>
                      <TableHead className="text-right">Vendor Rate</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateZones.map((zone) => (
                      <TableRow key={zone.zone}>
                        <TableCell className="font-medium">
                          {zone.zone}
                        </TableCell>
                        <TableCell>{zone.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {editingZone === zone.zone ? (
                            <Input
                              type="number"
                              step="0.0001"
                              defaultValue={zone.customerRate}
                              onChange={(e) =>
                                handleRateChange(
                                  zone.zone,
                                  parseFloat(e.target.value)
                                )
                              }
                              className="w-20 text-right"
                            />
                          ) : (
                            `${(zone.customerRate || 0).toFixed(4)}`
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${(zone.vendorRate || 0).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end">
                            {getMarginIcon(zone.marginPercent)}
                            <span className="ml-1">
                              {(zone.marginPercent || 0).toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {zone.volume.toLocaleString()} min
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${(zone.profit || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(zone.status)}>
                            {zone.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {editingZone === zone.zone ? (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={handleSaveRates}>
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingZone(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingZone(zone.zone)}
                            >
                              <EditIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Margin Distribution</CardTitle>
                <CardDescription>Profit margins by zone</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rateZones.map((zone) => (
                  <div key={zone.zone} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{zone.zone}</span>
                      <span className="text-sm text-muted-foreground">
                        {(zone.marginPercent || 0).toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(zone.marginPercent, 100)}
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Revenue contribution by zone</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rateZones
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((zone) => {
                    const percentage =
                      marginAnalysis.totalRevenue > 0
                        ? (zone.revenue / marginAnalysis.totalRevenue) * 100
                        : 0;
                    return (
                      <div
                        key={zone.zone}
                        className="flex justify-between items-center"
                      >
                        <div>
                          <div className="text-sm font-medium">{zone.zone}</div>
                          <div className="text-xs text-muted-foreground">
                            ${(zone.revenue || 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {(percentage || 0).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {zone.volume.toLocaleString()} min
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Optimization Recommendations</CardTitle>
              <CardDescription>
                AI-powered suggestions to improve profitability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-green-50">
                  <div className="flex items-start space-x-3">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />

                    <div>
                      <h4 className="font-medium text-green-800">
                        Increase DOM rates by $0.0005
                      </h4>
                      <p className="text-sm text-green-700 mt-1">
                        Market analysis shows you can increase domestic rates to
                        $0.0100 without losing customers. Potential additional
                        profit: $52.08/month
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-yellow-50">
                  <div className="flex items-start space-x-3">
                    <AlertTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />

                    <div>
                      <h4 className="font-medium text-yellow-800">
                        Negotiate better MOBILE rates
                      </h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Your mobile termination costs are 38.7% above market
                        average. Consider switching to Telnyx for $0.0075/min
                        (save $23.33/month)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-blue-50">
                  <div className="flex items-start space-x-3">
                    <BarChart3Icon className="w-5 h-5 text-blue-600 mt-0.5" />

                    <div>
                      <h4 className="font-medium text-blue-800">
                        Volume-based pricing opportunity
                      </h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Your DOM volume (125k min/month) qualifies for tier 2
                        pricing with AT&T. Potential savings: $0.0005/min
                        ($62.50/month)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Templates</CardTitle>
              <CardDescription>
                Apply predefined rate structures for quick configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a rate template" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockRateTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={!selectedTemplate}>Apply Template</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockRateTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-colors ${
                      selectedTemplate === template.id
                        ? "border-[#58C5C7] bg-[#58C5C7]/5"
                        : "hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">
                        {template.name}
                      </CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Domestic:</span>
                          <span className="font-mono">
                            ${(template.rates?.domestic || 0).toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>International:</span>
                          <span className="font-mono">
                            ${(template.rates?.international || 0).toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Toll-Free:</span>
                          <span className="font-mono">
                            ${(template.rates?.tollFree || 0).toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Effective:</span>
                          <span>{template.effectiveDate || "N/A"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
