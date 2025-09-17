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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  KeyIcon,
  PlusIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  TrashIcon,
  EditIcon,
  ShieldIcon,
  GlobeIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from "lucide-react";

interface OAuthToken {
  id: string;
  name: string;
  token: string;
  scopes: string[];
  ipWhitelist: string[];
  modules: string[];
  created: string;
  lastUsed: string;
  status: "active" | "inactive" | "expired";
}

const mockTokens: OAuthToken[] = [
  {
    id: "1",
    name: "Production API",
    token: "rng_live_1234567890abcdef",
    scopes: ["read", "write"],
    ipWhitelist: ["192.168.1.100", "10.0.0.50"],
    modules: ["numbers", "trunks", "messaging"],
    created: "2024-01-10",
    lastUsed: "2024-01-15 14:30",
    status: "active",
  },
  {
    id: "2",
    name: "Development Token",
    token: "rng_test_abcdef1234567890",
    scopes: ["read"],
    ipWhitelist: ["*"],
    modules: ["numbers"],
    created: "2024-01-05",
    lastUsed: "2024-01-14 09:15",
    status: "active",
  },
  {
    id: "3",
    name: "Legacy Integration",
    token: "rng_live_fedcba0987654321",
    scopes: ["read", "write", "admin"],
    ipWhitelist: ["203.0.113.10"],
    modules: ["trunks", "intelligence"],
    created: "2023-12-20",
    lastUsed: "2024-01-10 16:45",
    status: "inactive",
  },
];

const availableScopes = [
  { id: "read", label: "Read", description: "View resources and data" },
  { id: "write", label: "Write", description: "Create and update resources" },
  { id: "delete", label: "Delete", description: "Remove resources" },
  { id: "admin", label: "Admin", description: "Full administrative access" },
];

const availableModules = [
  {
    id: "numbers",
    label: "Numbers",
    description: "DID and toll-free number management",
  },
  {
    id: "trunks",
    label: "SIP Trunks",
    description: "Trunk configuration and monitoring",
  },
  {
    id: "messaging",
    label: "Messaging",
    description: "SMS, MMS, and RCS services",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    description: "LRN and LERG data services",
  },
  {
    id: "billing",
    label: "Billing",
    description: "Invoices and payment information",
  },
];

export function SettingsOAuth() {
  const [tokens, setTokens] = useState<OAuthToken[]>(mockTokens);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());
  const [createForm, setCreateForm] = useState({
    name: "",
    scopes: [] as string[],
    modules: [] as string[],
    ipWhitelist: "",
  });

  const handleCreateToken = () => {
    if (
      createForm.name &&
      createForm.scopes.length > 0 &&
      createForm.modules.length > 0
    ) {
      const newToken: OAuthToken = {
        id: Date.now().toString(),
        name: createForm.name,
        token: `rng_${Math.random().toString(36).substring(2, 15)}`,
        scopes: createForm.scopes,
        modules: createForm.modules,
        ipWhitelist: createForm.ipWhitelist
          ? createForm.ipWhitelist.split("\n").filter((ip) => ip.trim())
          : ["*"],
        created: new Date().toISOString().split("T")[0],
        lastUsed: "Never",
        status: "active",
      };
      setTokens([...tokens, newToken]);
      setCreateForm({ name: "", scopes: [], modules: [], ipWhitelist: "" });
      setIsCreateOpen(false);
    }
  };

  const toggleTokenVisibility = (tokenId: string) => {
    const newVisible = new Set(visibleTokens);
    if (newVisible.has(tokenId)) {
      newVisible.delete(tokenId);
    } else {
      newVisible.add(tokenId);
    }
    setVisibleTokens(newVisible);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusBadge = (status: OAuthToken["status"]) => {
    const variants = {
      active: { color: "bg-green-500", label: "Active" },
      inactive: { color: "bg-gray-500", label: "Inactive" },
      expired: { color: "bg-red-500", label: "Expired" },
    };
    return variants[status];
  };

  const activeTokens = tokens.filter(
    (token) => token.status === "active"
  ).length;
  const totalRequests = 45672; // Mock data

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#231F20]">OAuth Tokens</h1>
          <p className="text-gray-600">
            Manage API access tokens with granular permissions and security
            controls
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Token
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New OAuth Token</DialogTitle>
              <DialogDescription>
                Generate a new API token with specific permissions and access
                controls
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div>
                  <Label htmlFor="tokenName">Token Name</Label>
                  <Input
                    id="tokenName"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    placeholder="e.g., Production API, Development Token"
                  />
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4">
                <div>
                  <Label>API Scopes</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {availableScopes.map((scope) => (
                      <div
                        key={scope.id}
                        className="flex items-start space-x-2"
                      >
                        <Checkbox
                          id={scope.id}
                          checked={createForm.scopes.includes(scope.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCreateForm({
                                ...createForm,
                                scopes: [...createForm.scopes, scope.id],
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                scopes: createForm.scopes.filter(
                                  (s) => s !== scope.id
                                ),
                              });
                            }
                          }}
                        />

                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor={scope.id}
                            className="text-sm font-medium"
                          >
                            {scope.label}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {scope.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Module Access</Label>
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {availableModules.map((module) => (
                      <div
                        key={module.id}
                        className="flex items-start space-x-2"
                      >
                        <Checkbox
                          id={module.id}
                          checked={createForm.modules.includes(module.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCreateForm({
                                ...createForm,
                                modules: [...createForm.modules, module.id],
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                modules: createForm.modules.filter(
                                  (m) => m !== module.id
                                ),
                              });
                            }
                          }}
                        />

                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor={module.id}
                            className="text-sm font-medium"
                          >
                            {module.label}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {module.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <div>
                  <Label htmlFor="ipWhitelist">IP Whitelist</Label>
                  <Textarea
                    id="ipWhitelist"
                    value={createForm.ipWhitelist}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        ipWhitelist: e.target.value,
                      })
                    }
                    placeholder="192.168.1.100&#10;10.0.0.50&#10;203.0.113.10&#10;&#10;Leave empty for no restrictions"
                    rows={4}
                  />

                  <p className="text-xs text-muted-foreground mt-1">
                    Enter one IP address per line. Leave empty to allow all IPs.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateToken}
                className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                Create Token
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <KeyIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tokens.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeTokens} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <GlobeIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRequests.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.8%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1000</div>
            <p className="text-xs text-muted-foreground">Requests/hour</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Tokens</CardTitle>
          <CardDescription>
            Manage your OAuth tokens and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead>IP Restrictions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => {
                  const statusInfo = getStatusBadge(token.status);
                  const isVisible = visibleTokens.has(token.id);

                  return (
                    <TableRow key={token.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{token.name}</div>
                          <div className="text-sm text-gray-500">
                            Created: {token.created}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {isVisible ? token.token : "•".repeat(20)}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleTokenVisibility(token.id)}
                          >
                            {isVisible ? (
                              <EyeOffIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(token.token)}
                          >
                            <CopyIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {token.scopes.map((scope) => (
                            <Badge
                              key={scope}
                              variant="outline"
                              className="text-xs"
                            >
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {token.modules.slice(0, 2).map((module) => (
                            <Badge
                              key={module}
                              variant="secondary"
                              className="text-xs"
                            >
                              {module}
                            </Badge>
                          ))}
                          {token.modules.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{token.modules.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <ShieldIcon className="h-3 w-3 text-gray-400" />

                          <span className="text-sm">
                            {token.ipWhitelist.includes("*")
                              ? "Any IP"
                              : `${token.ipWhitelist.length} IPs`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${statusInfo.color} hover:${statusInfo.color}/80 text-white`}
                        >
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="ghost" size="sm">
                            <EditIcon className="w-4 h-4" />
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>API Documentation</CardTitle>
            <CardDescription>
              Quick reference for using your tokens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-medium mb-2">Authentication Header</h4>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                Authorization: Bearer YOUR_TOKEN_HERE
              </code>
            </div>
            <div>
              <h4 className="font-medium mb-2">Base URL</h4>
              <code className="text-sm bg-gray-100 p-2 rounded block">
                https://api.ringer.tel/v1/
              </code>
            </div>
            <div>
              <h4 className="font-medium mb-2">Rate Limits</h4>
              <p className="text-sm text-gray-600">
                1000 requests per hour per token
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Best Practices</CardTitle>
            <CardDescription>Keep your tokens secure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <div>✓ Use IP whitelisting when possible</div>
              <div>✓ Grant minimal required scopes</div>
              <div>✓ Rotate tokens regularly</div>
              <div>✓ Monitor token usage</div>
              <div>✓ Revoke unused tokens</div>
              <div>✓ Store tokens securely</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
