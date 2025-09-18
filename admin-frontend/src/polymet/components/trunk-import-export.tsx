import React, { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DownloadIcon,
  UploadIcon,
  FileTextIcon,
  DatabaseIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  CopyIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  mockTrunks,
  mockCustomerTrunks,
  mockVendorTrunks,
  type SipTrunk,
} from "@/polymet/data/trunk-mock-data";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  warnings: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}

interface ExportOptions {
  format: "csv" | "json" | "xml";
  includeStats: boolean;
  includeRates: boolean;
  includeSecrets: boolean;
  trunks: SipTrunk[];
}

interface TrunkImportExportProps {
  trunks?: SipTrunk[];
  onImportComplete?: (result: ImportResult) => void;
  onExportComplete?: (data: string, format: string) => void;
}

export function TrunkImportExport({
  trunks = mockTrunks,
  onImportComplete,
  onExportComplete,
}: TrunkImportExportProps) {
  const [activeTab, setActiveTab] = useState("export");
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: "csv",
    includeStats: true,
    includeRates: true,
    includeSecrets: false,
    trunks: trunks,
  });
  const [importProgress, setImportProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importData, setImportData] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export Functions
  const generateCSV = (options: ExportOptions): string => {
    const headers = [
      "Name",
      "Type",
      "Status",
      "Description",
      "Max Concurrent Calls",
      "IP Addresses",
      "SIP Port",
      "Auth Method",
      "Partition",
    ];

    if (options.includeRates) {
      headers.push("Rate Zones", "Default Rate");
    }

    if (options.includeStats) {
      headers.push("Active Calls", "Today Minutes", "ASR", "ACD");
    }

    const rows = options.trunks.map((trunk) => {
      const row = [
        trunk.basic?.name || "",
        trunk.basic?.type || "",
        trunk.basic?.status || "",
        trunk.basic?.description || "",
        trunk.basic?.maxConcurrentCalls?.toString() || "",
        trunk.network?.ipAddresses?.join(";") || "",
        trunk.network?.sipPort?.toString() || "",
        trunk.authentication?.method || "",
        trunk.routing?.partition || "",
      ];

      if (options.includeRates) {
        row.push(
          trunk.rates?.zones?.length?.toString() || "0",
          trunk.rates?.zones?.[0]?.rate?.toString() || ""
        );
      }

      if (options.includeStats) {
        row.push(
          trunk.stats?.activeCalls?.toString() || "0",
          trunk.stats?.todayMinutes?.toString() || "0",
          trunk.stats?.asr?.toString() || "0",
          trunk.stats?.acd?.toString() || "0"
        );
      }

      return row;
    });

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  };

  const generateJSON = (options: ExportOptions): string => {
    const exportData = options.trunks.map((trunk) => {
      const data: any = {
        basic: trunk.basic,
        network: trunk.network,
        authentication: options.includeSecrets
          ? trunk.authentication
          : {
              ...trunk.authentication,
              password: "[REDACTED]",
              sharedSecret: "[REDACTED]",
            },
        routing: trunk.routing,
      };

      if (options.includeRates) {
        data.rates = trunk.rates;
      }

      if (options.includeStats) {
        data.stats = trunk.stats;
      }

      return data;
    });

    return JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        version: "1.0",
        trunks: exportData,
      },
      null,
      2
    );
  };

  const generateXML = (options: ExportOptions): string => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += "<trunk-export>\n";
    xml += `  <metadata>\n`;
    xml += `    <export-date>${new Date().toISOString()}</export-date>\n`;
    xml += `    <version>1.0</version>\n`;
    xml += `    <count>${options.trunks.length}</count>\n`;
    xml += `  </metadata>\n`;
    xml += "  <trunks>\n";

    options.trunks.forEach((trunk) => {
      xml += "    <trunk>\n";
      xml += `      <name>${trunk.basic?.name || ""}</name>\n`;
      xml += `      <type>${trunk.basic?.type || ""}</type>\n`;
      xml += `      <status>${trunk.basic?.status || ""}</status>\n`;
      xml += `      <description><![CDATA[${trunk.basic?.description || ""}]]></description>\n`;
      xml += `      <max-concurrent-calls>${trunk.basic?.maxConcurrentCalls || 0}</max-concurrent-calls>\n`;

      if (trunk.network?.ipAddresses) {
        xml += "      <ip-addresses>\n";
        trunk.network.ipAddresses.forEach((ip) => {
          xml += `        <ip>${ip}</ip>\n`;
        });
        xml += "      </ip-addresses>\n";
      }

      if (options.includeRates && trunk.rates?.zones) {
        xml += "      <rates>\n";
        trunk.rates.zones.forEach((zone) => {
          xml += `        <zone name="${zone.name}" rate="${zone.rate}" />\n`;
        });
        xml += "      </rates>\n";
      }

      xml += "    </trunk>\n";
    });

    xml += "  </trunks>\n";
    xml += "</trunk-export>";
    return xml;
  };

  const handleExport = () => {
    setIsProcessing(true);

    setTimeout(() => {
      let exportData: string;

      switch (exportOptions.format) {
        case "csv":
          exportData = generateCSV(exportOptions);
          break;
        case "json":
          exportData = generateJSON(exportOptions);
          break;
        case "xml":
          exportData = generateXML(exportOptions);
          break;
        default:
          exportData = generateJSON(exportOptions);
      }

      // Create and trigger download
      const blob = new Blob([exportData], {
        type:
          exportOptions.format === "csv"
            ? "text/csv"
            : exportOptions.format === "json"
              ? "application/json"
              : "application/xml",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trunk-export-${new Date().toISOString().split("T")[0]}.${exportOptions.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onExportComplete?.(exportData, exportOptions.format);
      setIsProcessing(false);
    }, 1000);
  };

  // Import Functions
  const validateImportData = (data: string, format: string): ImportResult => {
    const result: ImportResult = {
      success: true,
      imported: 0,
      errors: [],
      warnings: [],
    };

    try {
      if (format === "csv") {
        const lines = data.trim().split("\n");
        const headers = lines[0].split(",");

        if (!headers.includes("Name") || !headers.includes("Type")) {
          result.errors.push({
            row: 1,
            field: "headers",
            message: "Required columns 'Name' and 'Type' not found",
          });
          result.success = false;
          return result;
        }

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",");
          const name = values[headers.indexOf("Name")];
          const type = values[headers.indexOf("Type")];

          if (!name || name.trim().length < 3) {
            result.errors.push({
              row: i + 1,
              field: "Name",
              message: "Name is required and must be at least 3 characters",
            });
          }

          if (!type || !["customer", "vendor"].includes(type.toLowerCase())) {
            result.errors.push({
              row: i + 1,
              field: "Type",
              message: "Type must be 'customer' or 'vendor'",
            });
          }

          if (result.errors.length === 0) {
            result.imported++;
          }
        }
      } else if (format === "json") {
        const parsed = JSON.parse(data);

        if (!parsed.trunks || !Array.isArray(parsed.trunks)) {
          result.errors.push({
            row: 0,
            field: "structure",
            message: "Invalid JSON structure - 'trunks' array required",
          });
          result.success = false;
          return result;
        }

        parsed.trunks.forEach((trunk: any, index: number) => {
          if (!trunk.basic?.name) {
            result.errors.push({
              row: index + 1,
              field: "basic.name",
              message: "Trunk name is required",
            });
          }

          if (!trunk.basic?.type) {
            result.errors.push({
              row: index + 1,
              field: "basic.type",
              message: "Trunk type is required",
            });
          }

          if (result.errors.length === 0) {
            result.imported++;
          }
        });
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push({
        row: 0,
        field: "parsing",
        message: `Failed to parse ${format.toUpperCase()}: ${error}`,
      });
      result.success = false;
    }

    return result;
  };

  const handleImport = async () => {
    if (!importData.trim()) return;

    setIsProcessing(true);
    setImportProgress(0);

    // Simulate import progress
    for (let i = 0; i <= 100; i += 10) {
      setImportProgress(i);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const format = importData.trim().startsWith("{") ? "json" : "csv";
    const result = validateImportData(importData, format);

    setImportResult(result);
    setIsProcessing(false);
    onImportComplete?.(result);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DatabaseIcon className="w-5 h-5 text-[#58C5C7]" />

            <span>Import / Export Trunk Configurations</span>
          </CardTitle>
          <CardDescription>
            Bulk import and export trunk configurations in multiple formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="export">Export</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
            </TabsList>

            {/* Export Tab */}
            <TabsContent value="export" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="export-format">Export Format</Label>
                    <Select
                      value={exportOptions.format}
                      onValueChange={(value: "csv" | "json" | "xml") =>
                        setExportOptions((prev) => ({ ...prev, format: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">
                          CSV (Comma Separated)
                        </SelectItem>
                        <SelectItem value="json">
                          JSON (JavaScript Object)
                        </SelectItem>
                        <SelectItem value="xml">
                          XML (Extensible Markup)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label>Export Options</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="include-stats"
                          checked={exportOptions.includeStats}
                          onChange={(e) =>
                            setExportOptions((prev) => ({
                              ...prev,
                              includeStats: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />

                        <Label htmlFor="include-stats" className="text-sm">
                          Include Statistics
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="include-rates"
                          checked={exportOptions.includeRates}
                          onChange={(e) =>
                            setExportOptions((prev) => ({
                              ...prev,
                              includeRates: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />

                        <Label htmlFor="include-rates" className="text-sm">
                          Include Rate Configuration
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="include-secrets"
                          checked={exportOptions.includeSecrets}
                          onChange={(e) =>
                            setExportOptions((prev) => ({
                              ...prev,
                              includeSecrets: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />

                        <Label htmlFor="include-secrets" className="text-sm">
                          Include Passwords/Secrets
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Export Summary</Label>
                    <div className="mt-2 p-4 border rounded-lg bg-gray-50">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Total Trunks:</span>
                          <Badge>{exportOptions.trunks.length}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Customer Trunks:</span>
                          <Badge>
                            {
                              exportOptions.trunks.filter(
                                (t) => t.basic?.type === "customer"
                              ).length
                            }
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Vendor Trunks:</span>
                          <Badge>
                            {
                              exportOptions.trunks.filter(
                                (t) => t.basic?.type === "vendor"
                              ).length
                            }
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Format:</span>
                          <Badge className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
                            {exportOptions.format.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleExport}
                    disabled={isProcessing}
                    className="w-full bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                  >
                    {isProcessing ? (
                      <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <DownloadIcon className="w-4 h-4 mr-2" />
                    )}
                    {isProcessing ? "Generating..." : "Export Configurations"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Import Tab */}
            <TabsContent value="import" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="import-method">Import Method</Label>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-24 flex-col space-y-2"
                    >
                      <UploadIcon className="w-6 h-6" />

                      <span>Upload File</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const sampleData = generateJSON({
                          ...exportOptions,
                          trunks: mockTrunks.slice(0, 2),
                        });
                        setImportData(sampleData);
                      }}
                      className="h-24 flex-col space-y-2"
                    >
                      <FileTextIcon className="w-6 h-6" />

                      <span>Use Sample Data</span>
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div>
                  <Label htmlFor="import-data">Import Data</Label>
                  <Textarea
                    id="import-data"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder="Paste CSV, JSON, or XML data here..."
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>

                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Processing import...</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} />
                  </div>
                )}

                <Button
                  onClick={handleImport}
                  disabled={!importData.trim() || isProcessing}
                  className="w-full bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                >
                  {isProcessing ? (
                    <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UploadIcon className="w-4 h-4 mr-2" />
                  )}
                  {isProcessing ? "Importing..." : "Import Configurations"}
                </Button>
              </div>

              {/* Import Results */}
              {importResult && (
                <Alert
                  className={
                    importResult.success
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }
                >
                  <AlertDescription>
                    <div className="flex items-center space-x-2 mb-2">
                      {importResult.success ? (
                        <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-red-600" />
                      )}
                      <span className="font-medium">
                        {importResult.success
                          ? `Successfully imported ${importResult.imported} trunk configurations`
                          : `Import failed with ${importResult.errors.length} errors`}
                      </span>
                    </div>

                    {importResult.errors.length > 0 && (
                      <div className="mt-3">
                        <h5 className="font-medium text-red-900 mb-2">
                          Errors:
                        </h5>
                        <div className="space-y-1">
                          {importResult.errors
                            .slice(0, 5)
                            .map((error, index) => (
                              <div key={index} className="text-sm text-red-700">
                                Row {error.row}, {error.field}: {error.message}
                              </div>
                            ))}
                          {importResult.errors.length > 5 && (
                            <div className="text-sm text-red-600">
                              ... and {importResult.errors.length - 5} more
                              errors
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {importResult.warnings.length > 0 && (
                      <div className="mt-3">
                        <h5 className="font-medium text-yellow-900 mb-2">
                          Warnings:
                        </h5>
                        <div className="space-y-1">
                          {importResult.warnings
                            .slice(0, 3)
                            .map((warning, index) => (
                              <div
                                key={index}
                                className="text-sm text-yellow-700"
                              >
                                Row {warning.row}, {warning.field}:{" "}
                                {warning.message}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Format Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Format Examples</CardTitle>
          <CardDescription>
            Sample data formats for import reference
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="csv-example">
            <TabsList>
              <TabsTrigger value="csv-example">CSV Example</TabsTrigger>
              <TabsTrigger value="json-example">JSON Example</TabsTrigger>
            </TabsList>

            <TabsContent value="csv-example">
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <pre>
                  {`Name,Type,Status,Description,Max Concurrent Calls,IP Addresses,Auth Method
Customer-Acme-Primary,customer,active,Primary trunk for Acme Corp,100,192.168.1.10;192.168.1.11,ip_acl
Vendor-Bandwidth-Term,vendor,active,Bandwidth termination trunk,500,203.0.113.1,sip_digest`}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="json-example">
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <pre>
                  {`{
  "trunks": [
    {
      "basic": {
        "name": "Customer-Acme-Primary",
        "type": "customer",
        "status": "active",
        "description": "Primary trunk for Acme Corp",
        "maxConcurrentCalls": 100
      },
      "network": {
        "ipAddresses": ["192.168.1.10", "192.168.1.11"]
      },
      "authentication": {
        "method": "ip_acl"
      }
    }
  ]
}`}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default TrunkImportExport;
