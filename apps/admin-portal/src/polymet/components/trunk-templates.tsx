import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileTextIcon,
  PlusIcon,
  CopyIcon,
  EditIcon,
  TrashIcon,
  PlayIcon,
  StarIcon,
  CheckCircleIcon,
  BuildingIcon,
  NetworkIcon,
  ShieldIcon,
} from "lucide-react";
import {
  mockRateTemplates,
  type SipTrunk,
} from "@/polymet/data/trunk-mock-data";

interface TrunkTemplate {
  id: string;
  name: string;
  description: string;
  category: "customer" | "vendor" | "internal";
  type: "standard" | "premium" | "enterprise" | "custom";
  isDefault: boolean;
  usageCount: number;
  lastUsed: string;
  configuration: Partial<SipTrunk>;
  tags: string[];
}

interface TrunkTemplatesProps {
  onTemplateApply?: (template: TrunkTemplate) => void;
  onTemplateCreate?: (
    template: Omit<TrunkTemplate, "id" | "usageCount" | "lastUsed">
  ) => void;
  onTemplateUpdate?: (
    templateId: string,
    template: Partial<TrunkTemplate>
  ) => void;
  onTemplateDelete?: (templateId: string) => void;
}

const predefinedTemplates: TrunkTemplate[] = [
  {
    id: "customer-standard",
    name: "Customer Standard",
    description:
      "Standard customer trunk with basic authentication and routing",
    category: "customer",
    type: "standard",
    isDefault: true,
    usageCount: 45,
    lastUsed: "2024-01-15T10:30:00Z",
    tags: ["customer", "standard", "sip-digest"],
    configuration: {
      basic: {
        type: "customer",
        status: "active",
        maxConcurrentCalls: 100,
        description: "Standard customer trunk configuration",
      },
      network: {
        sipPort: 5060,
        rtpPortRange: "10000-20000",
        codecPreference: ["G.711", "G.729"],
      },
      authentication: {
        method: "sip_digest",
        requireTls: false,
        enableSrtp: false,
      },
      routing: {
        partition: "customer-default",
        dialPatterns: ["^1[2-9]\\d{9}$", "^011.*"],
      },
      rates: {
        zones: [
          { name: "US-48", rate: 0.015, billingIncrement: 60 },
          { name: "International", rate: 0.25, billingIncrement: 60 },
        ],
      },
    },
  },
  {
    id: "customer-premium",
    name: "Customer Premium",
    description: "Premium customer trunk with enhanced security and features",
    category: "customer",
    type: "premium",
    isDefault: false,
    usageCount: 23,
    lastUsed: "2024-01-14T15:45:00Z",
    tags: ["customer", "premium", "tls", "srtp"],
    configuration: {
      basic: {
        type: "customer",
        status: "active",
        maxConcurrentCalls: 500,
        description: "Premium customer trunk with enhanced security",
      },
      network: {
        sipPort: 5061,
        rtpPortRange: "20000-30000",
        codecPreference: ["G.722", "G.711", "G.729"],
      },
      authentication: {
        method: "sip_digest",
        requireTls: true,
        enableSrtp: true,
      },
      routing: {
        partition: "customer-premium",
        dialPatterns: ["^1[2-9]\\d{9}$", "^011.*", "^\\+.*"],
      },
      rates: {
        zones: [
          { name: "US-48", rate: 0.012, billingIncrement: 6 },
          { name: "International", rate: 0.2, billingIncrement: 6 },
        ],
      },
    },
  },
  {
    id: "vendor-termination",
    name: "Vendor Termination",
    description: "Standard vendor trunk for call termination",
    category: "vendor",
    type: "standard",
    isDefault: true,
    usageCount: 18,
    lastUsed: "2024-01-13T09:20:00Z",
    tags: ["vendor", "termination", "ip-acl"],
    configuration: {
      basic: {
        type: "vendor",
        status: "active",
        maxConcurrentCalls: 1000,
        description: "Vendor termination trunk",
      },
      network: {
        sipPort: 5060,
        rtpPortRange: "30000-40000",
        codecPreference: ["G.711", "G.729"],
      },
      authentication: {
        method: "ip_acl",
        requireTls: false,
        enableSrtp: false,
      },
      routing: {
        partition: "vendor-termination",
        dialPatterns: ["^1[2-9]\\d{9}$", "^011.*"],
      },
      rates: {
        zones: [
          { name: "US-48", rate: 0.008, billingIncrement: 60 },
          { name: "International", rate: 0.15, billingIncrement: 60 },
        ],
      },
    },
  },
  {
    id: "vendor-origination",
    name: "Vendor Origination",
    description: "Vendor trunk for call origination with DID support",
    category: "vendor",
    type: "standard",
    isDefault: false,
    usageCount: 12,
    lastUsed: "2024-01-12T14:10:00Z",
    tags: ["vendor", "origination", "did"],
    configuration: {
      basic: {
        type: "vendor",
        status: "active",
        maxConcurrentCalls: 500,
        description: "Vendor origination trunk with DID support",
      },
      network: {
        sipPort: 5060,
        rtpPortRange: "40000-50000",
        codecPreference: ["G.711", "G.729"],
      },
      authentication: {
        method: "ip_acl",
        requireTls: false,
        enableSrtp: false,
      },
      routing: {
        partition: "vendor-origination",
        dialPatterns: ["^\\+1[2-9]\\d{9}$"],
      },
      rates: {
        zones: [
          { name: "DID-Monthly", rate: 2.5, billingIncrement: 2592000 }, // Monthly
          { name: "DID-Usage", rate: 0.005, billingIncrement: 60 },
        ],
      },
    },
  },
  {
    id: "enterprise-secure",
    name: "Enterprise Secure",
    description: "High-security enterprise trunk with full encryption",
    category: "customer",
    type: "enterprise",
    isDefault: false,
    usageCount: 8,
    lastUsed: "2024-01-11T11:30:00Z",
    tags: ["enterprise", "secure", "tls", "srtp", "high-capacity"],
    configuration: {
      basic: {
        type: "customer",
        status: "active",
        maxConcurrentCalls: 2000,
        description: "Enterprise-grade secure trunk",
      },
      network: {
        sipPort: 5061,
        rtpPortRange: "50000-60000",
        codecPreference: ["G.722", "G.711", "G.729", "Opus"],
      },
      authentication: {
        method: "sip_digest",
        requireTls: true,
        enableSrtp: true,
      },
      routing: {
        partition: "enterprise-secure",
        dialPatterns: [
          "^1[2-9]\\d{9}$",
          "^011.*",
          "^\\+.*",
          "^[2-9]\\d{6,10}$",
        ],
      },
      rates: {
        zones: [
          { name: "US-48", rate: 0.01, billingIncrement: 1 },
          { name: "International", rate: 0.18, billingIncrement: 1 },
          { name: "Toll-Free", rate: 0.025, billingIncrement: 6 },
        ],
      },
    },
  },
];

export function TrunkTemplates({
  onTemplateApply,
  onTemplateCreate,
  onTemplateUpdate,
  onTemplateDelete,
}: TrunkTemplatesProps) {
  const [templates, setTemplates] =
    useState<TrunkTemplate[]>(predefinedTemplates);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TrunkTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // New template form state
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    category: "customer" as "customer" | "vendor" | "internal",
    type: "custom" as "standard" | "premium" | "enterprise" | "custom",
    tags: "",
    configuration: "{}",
  });

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory =
      filterCategory === "all" || template.category === filterCategory;
    const matchesType = filterType === "all" || template.type === filterType;
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return matchesCategory && matchesType && matchesSearch;
  });

  const handleApplyTemplate = (template: TrunkTemplate) => {
    // Update usage statistics
    const updatedTemplates = templates.map((t) =>
      t.id === template.id
        ? {
            ...t,
            usageCount: t.usageCount + 1,
            lastUsed: new Date().toISOString(),
          }
        : t
    );
    setTemplates(updatedTemplates);
    onTemplateApply?.(template);
  };

  const handleCreateTemplate = () => {
    try {
      const configuration = JSON.parse(newTemplate.configuration);
      const template: TrunkTemplate = {
        id: `custom-${Date.now()}`,
        name: newTemplate.name,
        description: newTemplate.description,
        category: newTemplate.category,
        type: newTemplate.type,
        isDefault: false,
        usageCount: 0,
        lastUsed: new Date().toISOString(),
        tags: newTemplate.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        configuration,
      };

      setTemplates((prev) => [...prev, template]);
      onTemplateCreate?.(template);
      setIsCreateDialogOpen(false);
      setNewTemplate({
        name: "",
        description: "",
        category: "customer",
        type: "custom",
        tags: "",
        configuration: "{}",
      });
    } catch (error) {
      alert("Invalid JSON configuration");
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      onTemplateDelete?.(templateId);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "standard":
        return <FileTextIcon className="w-4 h-4" />;

      case "premium":
        return <StarIcon className="w-4 h-4" />;

      case "enterprise":
        return <BuildingIcon className="w-4 h-4" />;

      case "custom":
        return <EditIcon className="w-4 h-4" />;

      default:
        return <FileTextIcon className="w-4 h-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "customer":
        return <BuildingIcon className="w-4 h-4" />;

      case "vendor":
        return <NetworkIcon className="w-4 h-4" />;

      case "internal":
        return <ShieldIcon className="w-4 h-4" />;

      default:
        return <FileTextIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileTextIcon className="w-5 h-5 text-[#58C5C7]" />

              <span>Trunk Configuration Templates</span>
            </div>
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Create a reusable trunk configuration template
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="template-name">Template Name</Label>
                      <Input
                        id="template-name"
                        value={newTemplate.name}
                        onChange={(e) =>
                          setNewTemplate((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g., Customer Premium Plus"
                      />
                    </div>
                    <div>
                      <Label htmlFor="template-category">Category</Label>
                      <Select
                        value={newTemplate.category}
                        onValueChange={(
                          value: "customer" | "vendor" | "internal"
                        ) =>
                          setNewTemplate((prev) => ({
                            ...prev,
                            category: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="vendor">Vendor</SelectItem>
                          <SelectItem value="internal">Internal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="template-description">Description</Label>
                    <Textarea
                      id="template-description"
                      value={newTemplate.description}
                      onChange={(e) =>
                        setNewTemplate((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Describe the template's purpose and use cases"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-tags">
                      Tags (comma-separated)
                    </Label>
                    <Input
                      id="template-tags"
                      value={newTemplate.tags}
                      onChange={(e) =>
                        setNewTemplate((prev) => ({
                          ...prev,
                          tags: e.target.value,
                        }))
                      }
                      placeholder="e.g., premium, tls, high-capacity"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-config">
                      Configuration (JSON)
                    </Label>
                    <Textarea
                      id="template-config"
                      value={newTemplate.configuration}
                      onChange={(e) =>
                        setNewTemplate((prev) => ({
                          ...prev,
                          configuration: e.target.value,
                        }))
                      }
                      placeholder="Paste trunk configuration JSON here"
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTemplate}
                      disabled={!newTemplate.name || !newTemplate.description}
                      className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                    >
                      Create Template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>
            Predefined and custom trunk configuration templates for quick
            deployment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters and Search */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Template Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(template.category)}
                      <CardTitle className="text-base">
                        {template.name}
                      </CardTitle>
                    </div>
                    <div className="flex items-center space-x-1">
                      {template.isDefault && (
                        <Badge className="bg-[#58C5C7] hover:bg-[#58C5C7]/80 text-xs">
                          Default
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {template.type}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1">
                    {template.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Usage:</span>
                      <span>{template.usageCount} times</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last used:</span>
                      <span>
                        {new Date(template.lastUsed).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleApplyTemplate(template)}
                      className="flex-1 bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                    >
                      <PlayIcon className="w-3 h-3 mr-1" />
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CopyIcon className="w-3 h-3" />
                    </Button>
                    {template.type === "custom" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileTextIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />

              <p>No templates found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Details Dialog */}
      {selectedTemplate && (
        <Dialog
          open={!!selectedTemplate}
          onOpenChange={() => setSelectedTemplate(null)}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                {getTypeIcon(selectedTemplate.type)}
                <span>{selectedTemplate.name}</span>
                <Badge className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
                  {selectedTemplate.category}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {selectedTemplate.description}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="configuration">Configuration</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Template Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <Badge variant="outline">{selectedTemplate.type}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Category:</span>
                        <Badge variant="outline">
                          {selectedTemplate.category}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Usage Count:</span>
                        <span>{selectedTemplate.usageCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Used:</span>
                        <span>
                          {new Date(
                            selectedTemplate.lastUsed
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="configuration">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm overflow-auto max-h-[400px]">
                    {JSON.stringify(selectedTemplate.configuration, null, 2)}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setSelectedTemplate(null)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  handleApplyTemplate(selectedTemplate);
                  setSelectedTemplate(null);
                }}
                className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                <PlayIcon className="w-4 h-4 mr-2" />
                Apply Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default TrunkTemplates;
