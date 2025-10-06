import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SaveIcon, TestTubeIcon, PlusIcon, TrashIcon } from "lucide-react";
import { mockPartitions, type SipTrunk } from "@/polymet/data/trunk-mock-data";
import { TrunkRates } from "@/polymet/components/trunk-rates";
import { TrunkOverrides } from "@/polymet/components/trunk-overrides";

interface TrunkConfigFormProps {
  trunk?: SipTrunk | null;
  onSave: (config: Partial<SipTrunk>) => void;
  onCancel: () => void;
  onTest?: (config: Partial<SipTrunk>) => void;
}

export function TrunkConfigForm({
  trunk,
  onSave,
  onCancel,
  onTest,
}: TrunkConfigFormProps) {
  const [config, setConfig] = useState<Partial<SipTrunk>>(
    trunk || {
      basic: {
        id: "",
        type: "customer",
        name: "",
        status: "testing",
        machineId: "",
      },
      authentication: { type: "ip_acl", ipWhitelist: [] },
      routing: {
        partitions: [],
        supportedZones: [],
        jurisdictionPolicy: {
          behavior: "MIXED",
          aniClassification: "DOM",
          normalizeAni: true,
        },
      },
      rates: { zones: {}, rateLimiting: { enabled: false } },
    }
  );

  const updateConfig = (section: keyof SipTrunk, updates: any) => {
    setConfig((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
  };

  const handleConfigChange = (updates: any) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const addIpWhitelist = () => {
    const newIp = { ip: "", subnet: "32", label: "" };
    updateConfig("authentication", {
      ipWhitelist: [...(config.authentication?.ipWhitelist || []), newIp],
    });
  };

  const removeIpWhitelist = (index: number) => {
    const ipList = config.authentication?.ipWhitelist || [];
    updateConfig("authentication", {
      ipWhitelist: ipList.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {trunk ? "Edit" : "Create"} SIP Trunk Configuration
          </h2>
          <p className="text-muted-foreground">
            Configure {config.basic?.type || "trunk"} trunk settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {onTest && (
            <Button variant="outline" onClick={() => onTest(config)}>
              <TestTubeIcon className="w-4 h-4 mr-2" />
              Test
            </Button>
          )}
          <Button onClick={() => onSave(config)}>
            <SaveIcon className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Configure basic trunk identification and routing partition
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trunk Type</Label>
                  <Select
                    value={config.basic?.type}
                    onValueChange={(value: "customer" | "vendor") =>
                      updateConfig("basic", { type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">
                        Customer (Inbound)
                      </SelectItem>
                      <SelectItem value="vendor">Vendor (Outbound)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={config.basic?.status}
                    onValueChange={(
                      value: "active" | "suspended" | "testing"
                    ) => updateConfig("basic", { status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="testing">Testing</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.basic?.type === "customer" && (
                  <div className="space-y-2">
                    <Label>BAN (Billing Account Number)</Label>
                    <Input
                      value={config.basic?.ban || ""}
                      onChange={(e) =>
                        updateConfig("basic", { ban: e.target.value })
                      }
                      placeholder="BAN-12345678"
                    />
                  </div>
                )}

                {config.basic?.type === "vendor" && (
                  <div className="space-y-2">
                    <Label>Provider ID</Label>
                    <Input
                      value={config.basic?.providerId || ""}
                      onChange={(e) =>
                        updateConfig("basic", { providerId: e.target.value })
                      }
                      placeholder="PROV-001"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Trunk Name</Label>
                  <Input
                    value={config.basic?.name || ""}
                    onChange={(e) =>
                      updateConfig("basic", { name: e.target.value })
                    }
                    placeholder="Enter trunk name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Routing Partition</Label>
                  <Select
                    value={config.basic?.machineId}
                    onValueChange={(value) =>
                      updateConfig("basic", { machineId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select partition" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockPartitions.map((partition) => (
                        <SelectItem key={partition.id} value={partition.id}>
                          {partition.name} ({partition.location})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={config.basic?.description || ""}
                  onChange={(e) =>
                    updateConfig("basic", { description: e.target.value })
                  }
                  placeholder="Optional trunk description"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Configuration</CardTitle>
              <CardDescription>
                Configure IP ACL and SIP digest authentication methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Authentication Type</Label>
                <Select
                  value={config.authentication?.type}
                  onValueChange={(
                    value: "ip_acl" | "sip_digest" | "both" | "none"
                  ) => updateConfig("authentication", { type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ip_acl">IP ACL Only</SelectItem>
                    <SelectItem value="sip_digest">SIP Digest Only</SelectItem>
                    <SelectItem value="both">
                      Both IP ACL and SIP Digest
                    </SelectItem>
                    <SelectItem value="none">No Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(config.authentication?.type === "ip_acl" ||
                config.authentication?.type === "both") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>IP Whitelist</Label>
                    <Button size="sm" onClick={addIpWhitelist}>
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Add IP
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {config.authentication?.ipWhitelist?.map((ip, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="IP Address"
                          value={ip.ip}
                          onChange={(e) => {
                            const ipList = [
                              ...(config.authentication?.ipWhitelist || []),
                            ];

                            ipList[index] = { ...ip, ip: e.target.value };
                            updateConfig("authentication", {
                              ipWhitelist: ipList,
                            });
                          }}
                        />

                        <Input
                          placeholder="Subnet"
                          value={ip.subnet}
                          onChange={(e) => {
                            const ipList = [
                              ...(config.authentication?.ipWhitelist || []),
                            ];

                            ipList[index] = { ...ip, subnet: e.target.value };
                            updateConfig("authentication", {
                              ipWhitelist: ipList,
                            });
                          }}
                          className="w-20"
                        />

                        <Input
                          placeholder="Label"
                          value={ip.label}
                          onChange={(e) => {
                            const ipList = [
                              ...(config.authentication?.ipWhitelist || []),
                            ];

                            ipList[index] = { ...ip, label: e.target.value };
                            updateConfig("authentication", {
                              ipWhitelist: ipList,
                            });
                          }}
                        />

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeIpWhitelist(index)}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(config.authentication?.type === "sip_digest" ||
                config.authentication?.type === "both") && (
                <div className="space-y-4">
                  <Label>SIP Digest Credentials</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={
                          config.authentication?.credentials?.username || ""
                        }
                        onChange={(e) =>
                          updateConfig("authentication", {
                            credentials: {
                              ...config.authentication?.credentials,
                              username: e.target.value,
                            },
                          })
                        }
                        placeholder="SIP username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={
                          config.authentication?.credentials?.password || ""
                        }
                        onChange={(e) =>
                          updateConfig("authentication", {
                            credentials: {
                              ...config.authentication?.credentials,
                              password: e.target.value,
                            },
                          })
                        }
                        placeholder="SIP password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Realm (Optional)</Label>
                      <Input
                        value={config.authentication?.credentials?.realm || ""}
                        onChange={(e) =>
                          updateConfig("authentication", {
                            credentials: {
                              ...config.authentication?.credentials,
                              realm: e.target.value,
                            },
                          })
                        }
                        placeholder="SIP realm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Routing Configuration</CardTitle>
              <CardDescription>
                Configure partition assignment, supported zones, and
                jurisdiction policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Supported Zones</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    "INTERSTATE",
                    "INTRASTATE",
                    "LOCAL",
                    "INTERNATIONAL",
                    "ZONE1",
                    "TOLLFREE",
                  ].map((zone) => (
                    <div key={zone} className="flex items-center space-x-2">
                      <Checkbox
                        id={zone}
                        checked={config.routing?.supportedZones?.includes(
                          zone as any
                        )}
                        onCheckedChange={(checked) => {
                          const zones = config.routing?.supportedZones || [];
                          if (checked) {
                            updateConfig("routing", {
                              supportedZones: [...zones, zone],
                            });
                          } else {
                            updateConfig("routing", {
                              supportedZones: zones.filter((z) => z !== zone),
                            });
                          }
                        }}
                      />

                      <Label htmlFor={zone} className="text-sm">
                        {zone}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label>Jurisdiction Policy</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Behavior</Label>
                    <Select
                      value={config.routing?.jurisdictionPolicy?.behavior}
                      onValueChange={(
                        value: "INTRASTATE" | "INTERSTATE" | "POI" | "MIXED"
                      ) =>
                        updateConfig("routing", {
                          jurisdictionPolicy: {
                            ...config.routing?.jurisdictionPolicy,
                            behavior: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTRASTATE">Intrastate</SelectItem>
                        <SelectItem value="INTERSTATE">Interstate</SelectItem>
                        <SelectItem value="POI">POI</SelectItem>
                        <SelectItem value="MIXED">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ANI Classification</Label>
                    <Select
                      value={
                        config.routing?.jurisdictionPolicy?.aniClassification
                      }
                      onValueChange={(
                        value: "DOM" | "DOMTF" | "INTL" | "ANY"
                      ) =>
                        updateConfig("routing", {
                          jurisdictionPolicy: {
                            ...config.routing?.jurisdictionPolicy,
                            aniClassification: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DOM">Domestic</SelectItem>
                        <SelectItem value="DOMTF">
                          Domestic Toll-Free
                        </SelectItem>
                        <SelectItem value="INTL">International</SelectItem>
                        <SelectItem value="ANY">Any</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="normalize-ani"
                    checked={config.routing?.jurisdictionPolicy?.normalizeAni}
                    onCheckedChange={(checked) =>
                      updateConfig("routing", {
                        jurisdictionPolicy: {
                          ...config.routing?.jurisdictionPolicy,
                          normalizeAni: checked,
                        },
                      })
                    }
                  />

                  <Label htmlFor="normalize-ani">Normalize ANI</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="space-y-4">
          <TrunkRates
            trunk={config as SipTrunk}
            onUpdate={handleConfigChange}
          />
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4">
          <TrunkOverrides
            trunk={config as SipTrunk}
            onUpdate={handleConfigChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
