import React, { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  PlusIcon,
  TrashIcon,
  EditIcon,
  AlertTriangleIcon,
  ShieldIcon,
  BanIcon,
} from "lucide-react";
import { type SipTrunk } from "@/polymet/data/trunk-mock-data";

interface ExclusionRule {
  id: string;
  type: "provider" | "destination" | "pattern";
  name: string;
  value: string;
  description?: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
  lastModified: string;
}

interface TrunkExclusionsProps {
  trunk?: SipTrunk | null;
  onUpdate: (exclusions: ExclusionRule[]) => void;
}

const mockExclusionRules: ExclusionRule[] = [
  {
    id: "exc-001",
    type: "provider",
    name: "Block Carrier XYZ",
    value: "OCN:1234",
    description: "Poor quality carrier - high failure rate",
    enabled: true,
    priority: 1,
    createdAt: "2024-01-15T10:30:00Z",
    lastModified: "2024-01-15T10:30:00Z",
  },
  {
    id: "exc-002",
    type: "destination",
    name: "Block Premium Rate Numbers",
    value: "1900NXXXXXX",
    description: "Block all 1-900 premium rate numbers",
    enabled: true,
    priority: 2,
    createdAt: "2024-01-10T14:20:00Z",
    lastModified: "2024-01-20T09:15:00Z",
  },
  {
    id: "exc-003",
    type: "pattern",
    name: "Block International Fraud Pattern",
    value: "011882*",
    description: "Known fraud destination pattern",
    enabled: true,
    priority: 3,
    createdAt: "2024-01-05T16:45:00Z",
    lastModified: "2024-01-05T16:45:00Z",
  },
  {
    id: "exc-004",
    type: "destination",
    name: "Block Specific NPA-NXX",
    value: "212555XXXX",
    description: "High-cost destination block",
    enabled: false,
    priority: 4,
    createdAt: "2024-01-01T12:00:00Z",
    lastModified: "2024-01-25T11:30:00Z",
  },
];

export function TrunkExclusions({ trunk, onUpdate }: TrunkExclusionsProps) {
  const [exclusionRules, setExclusionRules] =
    useState<ExclusionRule[]>(mockExclusionRules);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ExclusionRule | null>(null);
  const [newRule, setNewRule] = useState<Partial<ExclusionRule>>({
    type: "destination",
    enabled: true,
    priority: exclusionRules.length + 1,
  });

  const handleAddRule = () => {
    if (!newRule.name || !newRule.value) return;

    const rule: ExclusionRule = {
      id: `exc-${Date.now()}`,
      type: newRule.type as "provider" | "destination" | "pattern",
      name: newRule.name,
      value: newRule.value,
      description: newRule.description || "",
      enabled: newRule.enabled ?? true,
      priority: newRule.priority ?? exclusionRules.length + 1,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    const updatedRules = [...exclusionRules, rule].sort(
      (a, b) => a.priority - b.priority
    );
    setExclusionRules(updatedRules);
    onUpdate(updatedRules);
    setNewRule({
      type: "destination",
      enabled: true,
      priority: updatedRules.length + 1,
    });
    setIsAddDialogOpen(false);
  };

  const handleUpdateRule = (
    ruleId: string,
    updates: Partial<ExclusionRule>
  ) => {
    const updatedRules = exclusionRules.map((rule) =>
      rule.id === ruleId
        ? { ...rule, ...updates, lastModified: new Date().toISOString() }
        : rule
    );
    setExclusionRules(updatedRules);
    onUpdate(updatedRules);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = exclusionRules.filter((rule) => rule.id !== ruleId);
    setExclusionRules(updatedRules);
    onUpdate(updatedRules);
  };

  const handleToggleRule = (ruleId: string) => {
    handleUpdateRule(ruleId, {
      enabled: !exclusionRules.find((r) => r.id === ruleId)?.enabled,
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "provider":
        return <ShieldIcon className="w-4 h-4" />;

      case "destination":
        return <BanIcon className="w-4 h-4" />;

      case "pattern":
        return <AlertTriangleIcon className="w-4 h-4" />;

      default:
        return <BanIcon className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "provider":
        return "bg-blue-100 text-blue-800";
      case "destination":
        return "bg-red-100 text-red-800";
      case "pattern":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BanIcon className="w-5 h-5" />
                Exclusion Rules
              </CardTitle>
              <CardDescription>
                Configure provider and destination exclusions to block specific
                routes or patterns
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Exclusion Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Exclusion Rule</DialogTitle>
                  <DialogDescription>
                    Create a new exclusion rule to block specific providers,
                    destinations, or patterns
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rule-type">Rule Type</Label>
                      <Select
                        value={newRule.type}
                        onValueChange={(value) =>
                          setNewRule({
                            ...newRule,
                            type: value as
                              | "provider"
                              | "destination"
                              | "pattern",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="provider">
                            Provider Exclusion
                          </SelectItem>
                          <SelectItem value="destination">
                            Destination Exclusion
                          </SelectItem>
                          <SelectItem value="pattern">
                            Pattern Exclusion
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rule-priority">Priority</Label>
                      <Input
                        id="rule-priority"
                        type="number"
                        value={newRule.priority || ""}
                        onChange={(e) =>
                          setNewRule({
                            ...newRule,
                            priority: parseInt(e.target.value) || 1,
                          })
                        }
                        placeholder="1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-name">Rule Name</Label>
                    <Input
                      id="rule-name"
                      value={newRule.name || ""}
                      onChange={(e) =>
                        setNewRule({ ...newRule, name: e.target.value })
                      }
                      placeholder="Enter rule name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-value">
                      {newRule.type === "provider"
                        ? "Provider Identifier (OCN:1234, LATA:456, etc.)"
                        : newRule.type === "destination"
                          ? "Destination Pattern (NPANXXXXXX, 1900NXXXXXX, etc.)"
                          : "Pattern (011882*, +1234*, etc.)"}
                    </Label>
                    <Input
                      id="rule-value"
                      value={newRule.value || ""}
                      onChange={(e) =>
                        setNewRule({ ...newRule, value: e.target.value })
                      }
                      placeholder={
                        newRule.type === "provider"
                          ? "OCN:1234"
                          : newRule.type === "destination"
                            ? "1900NXXXXXX"
                            : "011882*"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-description">
                      Description (Optional)
                    </Label>
                    <Textarea
                      id="rule-description"
                      value={newRule.description || ""}
                      onChange={(e) =>
                        setNewRule({ ...newRule, description: e.target.value })
                      }
                      placeholder="Describe the reason for this exclusion"
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="rule-enabled"
                      checked={newRule.enabled ?? true}
                      onCheckedChange={(checked) =>
                        setNewRule({ ...newRule, enabled: checked })
                      }
                    />

                    <Label htmlFor="rule-enabled">
                      Enable rule immediately
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddRule}
                    disabled={!newRule.name || !newRule.value}
                  >
                    Add Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {exclusionRules.length === 0 ? (
            <div className="text-center py-8">
              <BanIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />

              <h3 className="text-lg font-medium mb-2">No Exclusion Rules</h3>
              <p className="text-muted-foreground mb-4">
                No exclusion rules configured for this trunk
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <PlusIcon className="w-4 h-4 mr-2" />
                Add First Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exclusionRules
                  .sort((a, b) => a.priority - b.priority)
                  .map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">
                        {rule.priority}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(rule.type)}>
                          <div className="flex items-center gap-1">
                            {getTypeIcon(rule.type)}
                            {rule.type}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rule.name}</div>
                          {rule.description && (
                            <div className="text-sm text-muted-foreground">
                              {rule.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-sm">
                          {rule.value}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => handleToggleRule(rule.id)}
                            size="sm"
                          />

                          <span className="text-sm">
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(rule.lastModified).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRule(rule)}
                          >
                            <EditIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle>Exclusion Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{exclusionRules.length}</div>
              <div className="text-sm text-muted-foreground">Total Rules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {exclusionRules.filter((r) => r.enabled).length}
              </div>
              <div className="text-sm text-muted-foreground">Active Rules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {exclusionRules.filter((r) => r.type === "provider").length}
              </div>
              <div className="text-sm text-muted-foreground">
                Provider Rules
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {exclusionRules.filter((r) => r.type === "destination").length}
              </div>
              <div className="text-sm text-muted-foreground">
                Destination Rules
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
