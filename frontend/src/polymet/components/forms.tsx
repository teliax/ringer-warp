import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  SettingsIcon,
  NetworkIcon,
  PhoneIcon,
  ShieldIcon,
  CopyIcon,
} from "lucide-react";
import { type SipTrunk } from "@/polymet/data/telecom-mock-data";

interface TrunkConfigFormProps {
  trunk?: SipTrunk | null;
  onSubmit: (data: Partial<SipTrunk>) => void;
  onCancel: () => void;
}

export function TrunkConfigForm({
  trunk,
  onSubmit,
  onCancel,
}: TrunkConfigFormProps) {
  const [formData, setFormData] = useState({
    name: trunk?.name || "",
    ipAddress: trunk?.ipAddress || "",
    port: trunk?.port || 5060,
    maxConcurrentCalls: trunk?.maxConcurrentCalls || 30,
    status: trunk?.status || "active",
    codecs: trunk?.codecs || ["G.711", "G.729"],
    authentication: {
      username: "",
      password: "",
      realm: "",
    },
    routing: {
      inboundRouting: "default",
      outboundRouting: "default",
      failoverTrunk: "",
    },
    security: {
      ipWhitelist: trunk?.ipAddress ? [trunk.ipAddress] : [],
      requireAuth: true,
      tlsEnabled: false,
    },
    advanced: {
      dtmfMode: "rfc2833",
      sessionTimer: 1800,
      rtpTimeout: 60,
      description: "",
    },
  });

  const [showApiPreview, setShowApiPreview] = useState(false);
  const [availableCodecs] = useState([
    "G.711",
    "G.729",
    "G.722",
    "G.726",
    "GSM",
    "iLBC",
    "Opus",
  ]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (section: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value,
      },
    }));
  };

  const handleCodecToggle = (codec: string) => {
    setFormData((prev) => ({
      ...prev,
      codecs: prev.codecs.includes(codec)
        ? prev.codecs.filter((c) => c !== codec)
        : [...prev.codecs, codec],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      port: Number(formData.port),
      maxConcurrentCalls: Number(formData.maxConcurrentCalls),
    });
  };

  const generateApiPreview = () => {
    const method = trunk ? "PUT" : "POST";
    const endpoint = trunk ? `/api/v1/trunks/${trunk.id}` : "/api/v1/trunks";
    const payload = JSON.stringify(formData, null, 2);

    return `curl -X ${method} "https://api.ringer.com${endpoint}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${payload}'`;
  };

  const copyApiCommand = () => {
    navigator.clipboard.writeText(generateApiPreview());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <SettingsIcon className="w-5 h-5 text-[#58C5C7]" />

                <span>Basic Configuration</span>
              </CardTitle>
              <CardDescription>
                Configure basic SIP trunk settings and connection details
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowApiPreview(!showApiPreview)}
            >
              <CopyIcon className="w-4 h-4 mr-2" />
              API Preview
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Trunk Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Primary SIP Trunk"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="ipAddress"
                className="flex items-center space-x-2"
              >
                <NetworkIcon className="w-4 h-4" />

                <span>IP Address</span>
              </Label>
              <Input
                id="ipAddress"
                value={formData.ipAddress}
                onChange={(e) => handleInputChange("ipAddress", e.target.value)}
                placeholder="e.g., 192.168.1.100"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) => handleInputChange("port", e.target.value)}
                placeholder="5060"
                min="1"
                max="65535"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="maxConcurrentCalls"
              className="flex items-center space-x-2"
            >
              <PhoneIcon className="w-4 h-4" />

              <span>Max Concurrent Calls</span>
            </Label>
            <Input
              id="maxConcurrentCalls"
              type="number"
              value={formData.maxConcurrentCalls}
              onChange={(e) =>
                handleInputChange("maxConcurrentCalls", e.target.value)
              }
              placeholder="30"
              min="1"
              max="1000"
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Codec Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PhoneIcon className="w-5 h-5 text-[#58C5C7]" />

            <span>Codec Configuration</span>
          </CardTitle>
          <CardDescription>
            Select supported audio codecs for this trunk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {availableCodecs.map((codec) => (
              <div key={codec} className="flex items-center space-x-2">
                <Checkbox
                  id={codec}
                  checked={formData.codecs.includes(codec)}
                  onCheckedChange={() => handleCodecToggle(codec)}
                />

                <Label htmlFor={codec} className="text-sm font-medium">
                  {codec}
                </Label>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Label className="text-sm text-muted-foreground">
              Selected Codecs:
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.codecs.map((codec) => (
                <Badge key={codec} variant="secondary">
                  {codec}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShieldIcon className="w-5 h-5 text-[#58C5C7]" />

            <span>Security Settings</span>
          </CardTitle>
          <CardDescription>
            Configure authentication and security options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.authentication.username}
                onChange={(e) =>
                  handleNestedChange(
                    "authentication",
                    "username",
                    e.target.value
                  )
                }
                placeholder="SIP username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.authentication.password}
                onChange={(e) =>
                  handleNestedChange(
                    "authentication",
                    "password",
                    e.target.value
                  )
                }
                placeholder="SIP password"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="realm">Realm</Label>
            <Input
              id="realm"
              value={formData.authentication.realm}
              onChange={(e) =>
                handleNestedChange("authentication", "realm", e.target.value)
              }
              placeholder="SIP realm"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="requireAuth"
              checked={formData.security.requireAuth}
              onCheckedChange={(checked) =>
                handleNestedChange("security", "requireAuth", checked)
              }
            />

            <Label htmlFor="requireAuth">Require Authentication</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="tlsEnabled"
              checked={formData.security.tlsEnabled}
              onCheckedChange={(checked) =>
                handleNestedChange("security", "tlsEnabled", checked)
              }
            />

            <Label htmlFor="tlsEnabled">Enable TLS Encryption</Label>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon className="w-5 h-5 text-[#58C5C7]" />

            <span>Advanced Settings</span>
          </CardTitle>
          <CardDescription>
            Configure advanced SIP trunk parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dtmfMode">DTMF Mode</Label>
              <Select
                value={formData.advanced.dtmfMode}
                onValueChange={(value) =>
                  handleNestedChange("advanced", "dtmfMode", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rfc2833">RFC 2833</SelectItem>
                  <SelectItem value="inband">In-band</SelectItem>
                  <SelectItem value="info">SIP INFO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sessionTimer">Session Timer (seconds)</Label>
              <Input
                id="sessionTimer"
                type="number"
                value={formData.advanced.sessionTimer}
                onChange={(e) =>
                  handleNestedChange(
                    "advanced",
                    "sessionTimer",
                    Number(e.target.value)
                  )
                }
                placeholder="1800"
                min="300"
                max="7200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtpTimeout">RTP Timeout (seconds)</Label>
              <Input
                id="rtpTimeout"
                type="number"
                value={formData.advanced.rtpTimeout}
                onChange={(e) =>
                  handleNestedChange(
                    "advanced",
                    "rtpTimeout",
                    Number(e.target.value)
                  )
                }
                placeholder="60"
                min="30"
                max="300"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.advanced.description}
              onChange={(e) =>
                handleNestedChange("advanced", "description", e.target.value)
              }
              placeholder="Optional description for this trunk"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* API Preview */}
      {showApiPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CopyIcon className="w-5 h-5 text-[#FBAD18]" />

              <span>REST API Equivalent</span>
            </CardTitle>
            <CardDescription>
              Use this cURL command to create/update the trunk via API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                <code>{generateApiPreview()}</code>
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={copyApiCommand}
              >
                <CopyIcon className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{trunk ? "Update Trunk" : "Create Trunk"}</Button>
      </div>
    </form>
  );
}
