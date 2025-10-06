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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  UploadIcon,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  mockRateTemplates,
  type SipTrunk,
  type RateTemplate,
} from "@/polymet/data/trunk-mock-data";

interface TrunkRatesProps {
  trunk?: SipTrunk | null;
  onUpdate: (rates: any) => void;
}

export function TrunkRates({ trunk, onUpdate }: TrunkRatesProps) {
  const [rates, setRates] = useState({
    interstate: trunk?.rates?.interstate || "0.00000",
    intrastate: trunk?.rates?.intrastate || "0.00000",
    local: trunk?.rates?.local || "0.00000",
    international: trunk?.rates?.international || "0.00000",
    tollfree: trunk?.rates?.tollfree || "0.00000",
    zone1: trunk?.rates?.zone1 || "0.00000",
    minimumDuration: trunk?.rates?.minimumDuration || 6,
    increment: trunk?.rates?.increment || 6,
    effectiveDate: trunk?.rates?.effectiveDate || new Date(),
    maxAcceptableRate: trunk?.rates?.maxAcceptableRate || "0.10000",
    enableRateLimiting: trunk?.rates?.enableRateLimiting || false,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showCalendar, setShowCalendar] = useState(false);

  const handleRateChange = (zone: string, value: string) => {
    const updatedRates = { ...rates, [zone]: value };
    setRates(updatedRates);
    onUpdate(updatedRates);
  };

  const handleTemplateApply = (templateId: string) => {
    const template = mockRateTemplates.find((t) => t.id === templateId);
    if (template) {
      const updatedRates = {
        ...rates,
        interstate: template.rates.interstate,
        intrastate: template.rates.intrastate,
        local: template.rates.local,
        international: template.rates.international,
        tollfree: template.rates.tollfree,
        zone1: template.rates.zone1,
        minimumDuration: template.billingIncrements.minimumDuration,
        increment: template.billingIncrements.increment,
      };
      setRates(updatedRates);
      onUpdate(updatedRates);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const updatedRates = { ...rates, effectiveDate: date };
      setRates(updatedRates);
      onUpdate(updatedRates);
      setShowCalendar(false);
    }
  };

  const rateZones = [
    {
      key: "interstate",
      label: "Interstate",
      description: "Calls between different states",
    },
    {
      key: "intrastate",
      label: "Intrastate",
      description: "Calls within the same state",
    },
    { key: "local", label: "Local", description: "Local area calls" },
    {
      key: "international",
      label: "International",
      description: "International calls",
    },
    {
      key: "tollfree",
      label: "Toll-Free",
      description: "800, 888, 877, 866, 855, 844, 833 numbers",
    },
    {
      key: "zone1",
      label: "Zone 1 (Special)",
      description: "Special international zone",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Rate Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Rate Templates
            <Badge variant="secondary">Quick Setup</Badge>
          </CardTitle>
          <CardDescription>
            Apply predefined rate templates for quick configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select
                value={selectedTemplate}
                onValueChange={setSelectedTemplate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a rate template" />
                </SelectTrigger>
                <SelectContent>
                  {mockRateTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{template.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {template.type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() =>
                selectedTemplate && handleTemplateApply(selectedTemplate)
              }
              disabled={!selectedTemplate}
              className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
            >
              Apply Template
            </Button>
          </div>

          {selectedTemplate && (
            <div className="p-4 border rounded-lg bg-muted/50">
              {(() => {
                const template = mockRateTemplates.find(
                  (t) => t.id === selectedTemplate
                );
                return template ? (
                  <div className="space-y-2">
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {template.description}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>Interstate: ${template.rates.interstate}</div>
                      <div>Intrastate: ${template.rates.intrastate}</div>
                      <div>Local: ${template.rates.local}</div>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="rates" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rates">Zone Rates</TabsTrigger>
          <TabsTrigger value="billing">Billing Setup</TabsTrigger>
          <TabsTrigger value="limits">Rate Limits</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zone-Based Rates</CardTitle>
              <CardDescription>
                Configure rates per zone (up to 7 decimal places)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rateZones.map((zone) => (
                  <div key={zone.key} className="space-y-2">
                    <Label htmlFor={zone.key} className="text-sm font-medium">
                      {zone.label}
                    </Label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        id={zone.key}
                        type="text"
                        value={rates[zone.key as keyof typeof rates] as string}
                        onChange={(e) =>
                          handleRateChange(zone.key, e.target.value)
                        }
                        placeholder="0.00000"
                        className="font-mono"
                      />

                      <span className="text-sm text-muted-foreground">
                        per minute
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {zone.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing Increments</CardTitle>
              <CardDescription>
                Configure minimum duration and billing increments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minimumDuration">
                    Minimum Duration (seconds)
                  </Label>
                  <Input
                    id="minimumDuration"
                    type="number"
                    value={rates.minimumDuration}
                    onChange={(e) =>
                      handleRateChange(
                        "minimumDuration",
                        parseInt(e.target.value)
                      )
                    }
                    min="1"
                    max="60"
                  />

                  <p className="text-xs text-muted-foreground">
                    Minimum billable duration (default: 6 seconds)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="increment">Billing Increment (seconds)</Label>
                  <Input
                    id="increment"
                    type="number"
                    value={rates.increment}
                    onChange={(e) =>
                      handleRateChange("increment", parseInt(e.target.value))
                    }
                    min="1"
                    max="60"
                  />

                  <p className="text-xs text-muted-foreground">
                    Billing increment after minimum (default: 6 seconds)
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Rate Effective Date</Label>
                <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !rates.effectiveDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />

                      {rates.effectiveDate ? (
                        format(rates.effectiveDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={rates.effectiveDate}
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  When these rates become effective
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting</CardTitle>
              <CardDescription>
                Configure maximum acceptable rates for LCR routing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="enableRateLimiting"
                  checked={rates.enableRateLimiting}
                  onCheckedChange={(checked) =>
                    handleRateChange("enableRateLimiting", checked)
                  }
                />

                <Label htmlFor="enableRateLimiting">Enable Rate Limiting</Label>
              </div>

              {rates.enableRateLimiting && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="maxAcceptableRate">
                      Maximum Acceptable Rate
                    </Label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        id="maxAcceptableRate"
                        type="text"
                        value={rates.maxAcceptableRate}
                        onChange={(e) =>
                          handleRateChange("maxAcceptableRate", e.target.value)
                        }
                        placeholder="0.10000"
                        className="font-mono"
                      />

                      <span className="text-sm text-muted-foreground">
                        per minute
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Routes with rates above this threshold will be excluded
                      from LCR
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rate Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Management Actions</CardTitle>
          <CardDescription>
            Import, export, and manage rate configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <UploadIcon className="w-4 h-4 mr-2" />
              Import Rates
            </Button>
            <Button variant="outline" size="sm">
              <DownloadIcon className="w-4 h-4 mr-2" />
              Export Rates
            </Button>
            <Button variant="outline" size="sm">
              View Rate History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
