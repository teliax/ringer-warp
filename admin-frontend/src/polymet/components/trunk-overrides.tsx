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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon, TrashIcon, EditIcon, SaveIcon, XIcon } from "lucide-react";
import { type SipTrunk } from "@/polymet/data/trunk-mock-data";

interface TrunkOverridesProps {
  trunk?: SipTrunk | null;
  onUpdate: (overrides: any) => void;
}

interface DynamicOverride {
  id: string;
  type: "NPANxx" | "OCN/LATA" | "Prefix" | "CIC";
  pattern: string;
  overrideRate: string;
  priority: number;
  maxOverride: string;
  description?: string;
  enabled: boolean;
}

export function TrunkOverrides({ trunk, onUpdate }: TrunkOverridesProps) {
  const [staticOverrides, setStaticOverrides] = useState({
    domOverride: trunk?.overrides?.domOverride || "",
    intlOverride: trunk?.overrides?.intlOverride || "",
    cicOverride: trunk?.overrides?.cicOverride || "",
    enableDomOverride: trunk?.overrides?.enableDomOverride || false,
    enableIntlOverride: trunk?.overrides?.enableIntlOverride || false,
    enableCicOverride: trunk?.overrides?.enableCicOverride || false,
  });

  const [dynamicOverrides, setDynamicOverrides] = useState<DynamicOverride[]>(
    trunk?.overrides?.dynamicRules || [
      {
        id: "1",
        type: "NPANxx",
        pattern: "212555",
        overrideRate: "0.01500",
        priority: 1,
        maxOverride: "0.05000",
        description: "NYC Premium Rate",
        enabled: true,
      },
      {
        id: "2",
        type: "Prefix",
        pattern: "1800",
        overrideRate: "0.00000",
        priority: 2,
        maxOverride: "0.00000",
        description: "Toll-Free Override",
        enabled: true,
      },
    ]
  );

  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<DynamicOverride>>({
    type: "NPANxx",
    pattern: "",
    overrideRate: "",
    priority: 1,
    maxOverride: "",
    description: "",
    enabled: true,
  });

  const handleStaticOverrideChange = (
    field: string,
    value: string | boolean
  ) => {
    const updated = { ...staticOverrides, [field]: value };
    setStaticOverrides(updated);
    onUpdate({ ...trunk?.overrides, ...updated });
  };

  const handleAddDynamicRule = () => {
    if (newRule.pattern && newRule.overrideRate) {
      const rule: DynamicOverride = {
        id: Date.now().toString(),
        type: newRule.type as DynamicOverride["type"],
        pattern: newRule.pattern,
        overrideRate: newRule.overrideRate,
        priority: newRule.priority || 1,
        maxOverride: newRule.maxOverride || "0.00000",
        description: newRule.description || "",
        enabled: newRule.enabled !== false,
      };

      const updated = [...dynamicOverrides, rule];
      setDynamicOverrides(updated);
      onUpdate({ ...trunk?.overrides, dynamicRules: updated });

      setNewRule({
        type: "NPANxx",
        pattern: "",
        overrideRate: "",
        priority: 1,
        maxOverride: "",
        description: "",
        enabled: true,
      });
    }
  };

  const handleUpdateDynamicRule = (
    id: string,
    updates: Partial<DynamicOverride>
  ) => {
    const updated = dynamicOverrides.map((rule) =>
      rule.id === id ? { ...rule, ...updates } : rule
    );
    setDynamicOverrides(updated);
    onUpdate({ ...trunk?.overrides, dynamicRules: updated });
    setEditingRule(null);
  };

  const handleDeleteDynamicRule = (id: string) => {
    const updated = dynamicOverrides.filter((rule) => rule.id !== id);
    setDynamicOverrides(updated);
    onUpdate({ ...trunk?.overrides, dynamicRules: updated });
  };

  const overrideTypes = [
    {
      value: "NPANxx",
      label: "NPA-NXX",
      description: "Area code and exchange",
    },
    {
      value: "OCN/LATA",
      label: "OCN/LATA",
      description: "Operating Company Number / Local Access Transport Area",
    },
    { value: "Prefix", label: "Prefix", description: "Number prefix matching" },
    { value: "CIC", label: "CIC", description: "Carrier Identification Code" },
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="static" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="static">Static Overrides</TabsTrigger>
          <TabsTrigger value="dynamic">Dynamic Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="static" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Static Rate Overrides</CardTitle>
              <CardDescription>
                Set fixed override rates for specific traffic types
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* DOM Override */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableDomOverride"
                    checked={staticOverrides.enableDomOverride}
                    onCheckedChange={(checked) =>
                      handleStaticOverrideChange("enableDomOverride", checked)
                    }
                  />

                  <Label htmlFor="enableDomOverride" className="font-medium">
                    Domestic (DOM) Override
                  </Label>
                </div>

                {staticOverrides.enableDomOverride && (
                  <div className="space-y-2 ml-6">
                    <Label htmlFor="domOverride">Override Rate</Label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        id="domOverride"
                        type="text"
                        value={staticOverrides.domOverride}
                        onChange={(e) =>
                          handleStaticOverrideChange(
                            "domOverride",
                            e.target.value
                          )
                        }
                        placeholder="0.00000"
                        className="font-mono max-w-xs"
                      />

                      <span className="text-sm text-muted-foreground">
                        per minute
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Override rate for all domestic calls
                    </p>
                  </div>
                )}
              </div>

              {/* International Override */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableIntlOverride"
                    checked={staticOverrides.enableIntlOverride}
                    onCheckedChange={(checked) =>
                      handleStaticOverrideChange("enableIntlOverride", checked)
                    }
                  />

                  <Label htmlFor="enableIntlOverride" className="font-medium">
                    International (INTL) Override
                  </Label>
                </div>

                {staticOverrides.enableIntlOverride && (
                  <div className="space-y-2 ml-6">
                    <Label htmlFor="intlOverride">Override Rate</Label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        id="intlOverride"
                        type="text"
                        value={staticOverrides.intlOverride}
                        onChange={(e) =>
                          handleStaticOverrideChange(
                            "intlOverride",
                            e.target.value
                          )
                        }
                        placeholder="0.00000"
                        className="font-mono max-w-xs"
                      />

                      <span className="text-sm text-muted-foreground">
                        per minute
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Override rate for all international calls
                    </p>
                  </div>
                )}
              </div>

              {/* CIC Override */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableCicOverride"
                    checked={staticOverrides.enableCicOverride}
                    onCheckedChange={(checked) =>
                      handleStaticOverrideChange("enableCicOverride", checked)
                    }
                  />

                  <Label htmlFor="enableCicOverride" className="font-medium">
                    CIC Override
                  </Label>
                </div>

                {staticOverrides.enableCicOverride && (
                  <div className="space-y-2 ml-6">
                    <Label htmlFor="cicOverride">Override Rate</Label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        id="cicOverride"
                        type="text"
                        value={staticOverrides.cicOverride}
                        onChange={(e) =>
                          handleStaticOverrideChange(
                            "cicOverride",
                            e.target.value
                          )
                        }
                        placeholder="0.00000"
                        className="font-mono max-w-xs"
                      />

                      <span className="text-sm text-muted-foreground">
                        per minute
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Override rate for CIC-based routing
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dynamic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dynamic Override Rules</CardTitle>
              <CardDescription>
                Create pattern-based override rules with priority ordering
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add New Rule */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-4">Add New Override Rule</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Rule Type</Label>
                    <Select
                      value={newRule.type}
                      onValueChange={(value) =>
                        setNewRule({
                          ...newRule,
                          type: value as DynamicOverride["type"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {overrideTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {type.description}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Pattern</Label>
                    <Input
                      value={newRule.pattern}
                      onChange={(e) =>
                        setNewRule({ ...newRule, pattern: e.target.value })
                      }
                      placeholder="e.g., 212555, 1800, 0288"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Override Rate</Label>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm">$</span>
                      <Input
                        value={newRule.overrideRate}
                        onChange={(e) =>
                          setNewRule({
                            ...newRule,
                            overrideRate: e.target.value,
                          })
                        }
                        placeholder="0.00000"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Input
                      type="number"
                      value={newRule.priority}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          priority: parseInt(e.target.value),
                        })
                      }
                      min="1"
                      max="100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Override</Label>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm">$</span>
                      <Input
                        value={newRule.maxOverride}
                        onChange={(e) =>
                          setNewRule({
                            ...newRule,
                            maxOverride: e.target.value,
                          })
                        }
                        placeholder="0.00000"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={newRule.description}
                      onChange={(e) =>
                        setNewRule({ ...newRule, description: e.target.value })
                      }
                      placeholder="Rule description"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newRule.enabled !== false}
                      onCheckedChange={(checked) =>
                        setNewRule({ ...newRule, enabled: checked })
                      }
                    />

                    <Label>Enable Rule</Label>
                  </div>
                  <Button
                    onClick={handleAddDynamicRule}
                    disabled={!newRule.pattern || !newRule.overrideRate}
                    className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </div>

              {/* Existing Rules Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Max Override</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dynamicOverrides.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Badge variant="outline">{rule.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {rule.pattern}
                        </TableCell>
                        <TableCell className="font-mono">
                          ${rule.overrideRate}
                        </TableCell>
                        <TableCell>{rule.priority}</TableCell>
                        <TableCell className="font-mono">
                          ${rule.maxOverride}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={rule.enabled ? "default" : "secondary"}
                          >
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingRule(rule.id)}
                            >
                              <EditIcon className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteDynamicRule(rule.id)}
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

              {dynamicOverrides.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No dynamic override rules configured
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
