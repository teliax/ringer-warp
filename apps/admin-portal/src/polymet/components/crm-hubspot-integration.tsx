import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ExternalLinkIcon,
  RefreshCwIcon,
  SettingsIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  RotateCcwIcon,
  UserIcon,
  BuildingIcon,
  CalendarIcon,
  DollarSignIcon,
  PhoneIcon,
  MailIcon,
  LinkIcon,
} from "lucide-react";
import { type Vendor } from "@/polymet/data/admin-mock-data";

interface HubSpotContact {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  company: string;
  phone: string;
  lifecyclestage: string;
  createdate: string;
  lastmodifieddate: string;
  hubspot_owner_id?: string;
}

interface HubSpotCompany {
  id: string;
  name: string;
  domain: string;
  industry: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  createdate: string;
  lastmodifieddate: string;
}

interface HubSpotDeal {
  id: string;
  dealname: string;
  amount: string;
  dealstage: string;
  pipeline: string;
  closedate: string;
  createdate: string;
  hubspot_owner_id?: string;
}

interface CRMIntegrationProps {
  vendor?: Vendor;
  onSync?: (vendorId: string, crmData: any) => void;
}

export function CRMHubSpotIntegration({ vendor, onSync }: CRMIntegrationProps) {
  const [isConnected, setIsConnected] = useState(true); // Mock connected state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("2024-01-15T10:30:00Z");
  const [apiKey, setApiKey] = useState("");
  const [autoSync, setAutoSync] = useState(true);
  const [syncFrequency, setSyncFrequency] = useState("daily");

  // Mock HubSpot data
  const [hubspotContact] = useState<HubSpotContact>({
    id: "12345",
    email: vendor?.contactEmail || "contact@vendor.com",
    firstname: vendor?.contactName.split(" ")[0] || "John",
    lastname: vendor?.contactName.split(" ").slice(1).join(" ") || "Doe",
    company: vendor?.name || "Vendor Company",
    phone: vendor?.contactPhone || "+1-555-0123",
    lifecyclestage: "customer",
    createdate: "2023-06-15T10:00:00Z",
    lastmodifieddate: "2024-01-15T14:30:00Z",
    hubspot_owner_id: "owner123",
  });

  const [hubspotCompany] = useState<HubSpotCompany>({
    id: "67890",
    name: vendor?.name || "Vendor Company",
    domain: vendor?.contactEmail.split("@")[1] || "vendor.com",
    industry: "Telecommunications",
    phone: vendor?.contactPhone || "+1-555-0123",
    city: vendor?.address.city || "New York",
    state: vendor?.address.state || "NY",
    country: vendor?.address.country || "USA",
    createdate: "2023-06-15T10:00:00Z",
    lastmodifieddate: "2024-01-15T14:30:00Z",
  });

  const [hubspotDeals] = useState<HubSpotDeal[]>([
    {
      id: "deal001",
      dealname: `${vendor?.name || "Vendor"} - Annual Contract`,
      amount: "120000",
      dealstage: "contractsent",
      pipeline: "default",
      closedate: "2024-03-31",
      createdate: "2024-01-01T10:00:00Z",
      hubspot_owner_id: "owner123",
    },
    {
      id: "deal002",
      dealname: `${vendor?.name || "Vendor"} - Volume Discount`,
      amount: "25000",
      dealstage: "negotiation",
      pipeline: "default",
      closedate: "2024-02-15",
      createdate: "2024-01-10T15:30:00Z",
      hubspot_owner_id: "owner123",
    },
  ]);

  const handleSync = async () => {
    setIsSyncing(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const syncData = {
      contact: hubspotContact,
      company: hubspotCompany,
      deals: hubspotDeals,
      lastSync: new Date().toISOString(),
    };

    setLastSync(new Date().toISOString());
    setIsSyncing(false);

    if (onSync && vendor) {
      onSync(vendor.id, syncData);
    }
  };

  const handleConnect = async () => {
    // Simulate connection process
    setIsSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsConnected(true);
    setIsSyncing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getConnectionStatus = () => {
    if (!isConnected) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircleIcon className="w-3 h-3" />
          Disconnected
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-green-600 flex items-center gap-1">
        <CheckCircleIcon className="w-3 h-3" />
        Connected
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-[#FF7A59]" />

            <CardTitle>HubSpot CRM Integration</CardTitle>
          </div>
          {getConnectionStatus()}
        </div>
        <CardDescription>
          Sync vendor data with HubSpot CRM for enhanced relationship management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected ? (
          <div className="text-center py-8 space-y-4">
            <AlertCircleIcon className="w-12 h-12 text-muted-foreground mx-auto" />

            <div>
              <h3 className="font-medium">Connect to HubSpot</h3>
              <p className="text-sm text-muted-foreground">
                Connect your HubSpot account to sync vendor data
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <ExternalLinkIcon className="w-4 h-4 mr-2" />
                  Connect HubSpot
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect HubSpot CRM</DialogTitle>
                  <DialogDescription>
                    Enter your HubSpot API key to establish the connection
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="api-key">HubSpot API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />

                    <p className="text-xs text-muted-foreground mt-1">
                      You can find your API key in HubSpot Settings →
                      Integrations → API key
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto-sync"
                      checked={autoSync}
                      onCheckedChange={setAutoSync}
                    />

                    <Label htmlFor="auto-sync">Enable automatic sync</Label>
                  </div>
                  <div>
                    <Label htmlFor="sync-frequency">Sync Frequency</Label>
                    <Select
                      value={syncFrequency}
                      onValueChange={setSyncFrequency}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Every Hour</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="manual">Manual Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={!apiKey || isSyncing}
                    className="w-full"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sync Status */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <RotateCcwIcon className="w-5 h-5 text-[#58C5C7]" />

                <div>
                  <p className="font-medium">Last Sync</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(lastSync)}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                size="sm"
                className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                {isSyncing ? (
                  <>
                    <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCwIcon className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>

            {/* HubSpot Data Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-blue-600" />

                    <CardTitle className="text-sm">Contact</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="font-medium">
                      {hubspotContact.firstname} {hubspotContact.lastname}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {hubspotContact.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <PhoneIcon className="w-3 h-3" />

                    {hubspotContact.phone}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {hubspotContact.lifecyclestage}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="w-4 h-4 text-green-600" />

                    <CardTitle className="text-sm">Company</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="font-medium">{hubspotCompany.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {hubspotCompany.domain}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {hubspotCompany.city}, {hubspotCompany.state}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {hubspotCompany.industry}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <DollarSignIcon className="w-4 h-4 text-purple-600" />

                    <CardTitle className="text-sm">Deals</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="font-medium">{hubspotDeals.length} Active</p>
                    <p className="text-sm text-muted-foreground">
                      $
                      {hubspotDeals
                        .reduce((sum, deal) => sum + parseInt(deal.amount), 0)
                        .toLocaleString()}{" "}
                      total
                    </p>
                  </div>
                  <div className="space-y-1">
                    {hubspotDeals.slice(0, 2).map((deal) => (
                      <div key={deal.id} className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="truncate">{deal.dealname}</span>
                          <Badge variant="outline" className="text-xs ml-2">
                            {deal.dealstage}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h4 className="font-medium">Quick Actions</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button variant="outline" size="sm" className="justify-start">
                  <UserIcon className="w-4 h-4 mr-2" />
                  View Contact
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  <BuildingIcon className="w-4 h-4 mr-2" />
                  View Company
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  <DollarSignIcon className="w-4 h-4 mr-2" />
                  Create Deal
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Schedule Meeting
                </Button>
              </div>
            </div>

            {/* Sync Settings */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" />

                  <span className="font-medium">Sync Settings</span>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Configure
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>HubSpot Sync Settings</DialogTitle>
                      <DialogDescription>
                        Configure how vendor data syncs with HubSpot
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="auto-sync-settings"
                          checked={autoSync}
                          onCheckedChange={setAutoSync}
                        />

                        <Label htmlFor="auto-sync-settings">
                          Enable automatic sync
                        </Label>
                      </div>
                      <div>
                        <Label htmlFor="sync-frequency-settings">
                          Sync Frequency
                        </Label>
                        <Select
                          value={syncFrequency}
                          onValueChange={setSyncFrequency}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Every Hour</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="manual">Manual Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="sync-fields">Fields to Sync</Label>
                        <Textarea
                          id="sync-fields"
                          placeholder="Contact Name, Email, Phone, Company, Address..."
                          className="min-h-[100px]"
                        />
                      </div>
                      <Button className="w-full">Save Settings</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Auto-sync: {autoSync ? "Enabled" : "Disabled"} • Frequency:{" "}
                {syncFrequency} • Last sync: {formatDate(lastSync)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
