import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  PlusIcon,
  MessageSquareIcon,
  Building2Icon,
  PhoneIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  SettingsIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useBrands } from "@/hooks/useBrands";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMessagingEnums } from "@/hooks/useMessagingEnums";
import type {
  Brand10DLC,
  Campaign10DLC,
  UseCaseInfo,
  EntityTypeInfo,
  VerticalInfo,
  BrandStatus,
  CampaignStatus,
  CreateBrandRequest,
  CreateCampaignRequest,
} from "@/types/messaging";
import { BrandRegistrationForm } from "@/components/forms/BrandRegistrationForm";
import { CampaignRegistrationForm } from "@/components/forms/CampaignRegistrationForm";
import { toast } from "sonner";

export function Messaging() {
  // Dialog state
  const [selectedTab, setSelectedTab] = useState("overview");
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [numberAssignDialogOpen, setNumberAssignDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState("");

  // Data state
  const [brands, setBrands] = useState<Brand10DLC[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign10DLC[]>([]);
  const [useCases, setUseCases] = useState<UseCaseInfo[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityTypeInfo[]>([]);
  const [verticals, setVerticals] = useState<VerticalInfo[]>([]);

  // Hooks
  const brandsHook = useBrands();
  const campaignsHook = useCampaigns();
  const enumsHook = useMessagingEnums();

  // Loading state flag
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsInitialLoad(true);
    try {
      const [brandsData, campaignsData, useCasesData, entityTypesData, verticalsData] = await Promise.all([
        brandsHook.listBrands().catch(err => { console.error('Brands error:', err); return []; }),
        campaignsHook.listCampaigns().catch(err => { console.error('Campaigns error:', err); return []; }),
        enumsHook.getUseCases().catch(err => { console.error('Use cases error:', err); return []; }),
        enumsHook.getEntityTypes().catch(err => { console.error('Entity types error:', err); return []; }),
        enumsHook.getVerticals().catch(err => { console.error('Verticals error:', err); return []; }),
      ]);
      setBrands(brandsData);
      setCampaigns(campaignsData);
      setUseCases(useCasesData);
      setEntityTypes(entityTypesData);
      setVerticals(verticalsData);
    } catch (error) {
      console.error('Failed to load messaging data:', error);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const getStatusBadge = (status: BrandStatus | CampaignStatus) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      VERIFIED: "default",
      VETTED_VERIFIED: "default",
      ACTIVE: "default",
      REGISTERED: "default",
      PENDING: "secondary",
      UNVERIFIED: "secondary",
      REJECTED: "destructive",
      FAILED: "destructive",
      SUSPENDED: "outline",
      EXPIRED: "outline",
    };

    const colors: Record<string, string> = {
      VERIFIED: "bg-green-100 text-green-800",
      VETTED_VERIFIED: "bg-green-100 text-green-800",
      ACTIVE: "bg-green-100 text-green-800",
      REGISTERED: "bg-green-100 text-green-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      UNVERIFIED: "bg-yellow-100 text-yellow-800",
      REJECTED: "bg-red-100 text-red-800",
      FAILED: "bg-red-100 text-red-800",
      SUSPENDED: "bg-gray-100 text-gray-800",
      EXPIRED: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge variant={variants[status] || "secondary"} className={colors[status] || "bg-gray-100 text-gray-800"}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Auth+ status badge variant
  const getAuthPlusVariant = (vettingStatus?: string | null) => {
    if (!vettingStatus) return "secondary";

    const variants: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      FAILED: "bg-red-100 text-red-800",
      EXPIRED: "bg-gray-100 text-gray-800",
    };

    return variants[vettingStatus] || "bg-gray-100 text-gray-800";
  };

  // Check if brand can create campaigns
  const canCreateCampaigns = (brand: Brand10DLC): boolean => {
    // Non-PUBLIC_PROFIT brands: Only need identity verification
    if (brand.entity_type !== "PUBLIC_PROFIT") {
      return brand.identity_status === "VERIFIED" || brand.identity_status === "VETTED_VERIFIED";
    }

    // PUBLIC_PROFIT brands: Need both identity AND Auth+ verification
    const identityOK = brand.identity_status === "VERIFIED" || brand.identity_status === "VETTED_VERIFIED";
    const authPlusOK = brand.vetting_status === "ACTIVE";

    return identityOK && authPlusOK;
  };

  // Calculate stats from real data
  // Active = Fully verified and ready for campaigns
  const activeBrands = brands.filter(
    (brand) => brand.status === "VERIFIED" || brand.status === "VETTED_VERIFIED" || brand.status === "ACTIVE"
  );
  // Pending = Registered but awaiting verification, or in review
  const pendingBrands = brands.filter(
    (brand) => brand.status === "REGISTERED" || brand.status === "PENDING" || brand.status === "UNVERIFIED" || brand.status === "SELF_DECLARED"
  );

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "ACTIVE");
  const pendingCampaigns = campaigns.filter((campaign) => campaign.status === "PENDING");

  // TODO: Messages sent/delivered will come from MDR data when integrated
  const totalMessagesSent = 0; // Placeholder until MDR integration
  const totalMessagesDelivered = 0; // Placeholder until MDR integration
  const deliveryRate = 0; // Placeholder until MDR integration

  // TODO: Available numbers will come from DID inventory
  const assignedNumbersCount = 0; // Placeholder until phone number integration
  const availableNumbersCount = 0; // Placeholder until phone number integration

  // Form submission handlers
  const handleBrandSubmit = async (data: CreateBrandRequest) => {
    try {
      const result = await brandsHook.createBrand(data);
      // Show message from backend (includes TCR status and trust score)
      const message = result.message || "Brand registered successfully!";
      toast.success(message);
      await loadData(); // Refresh data
      setBrandDialogOpen(false);
    } catch (error: any) {
      // Show specific error from backend (e.g., "TCR registration failed: credentials invalid")
      toast.error(error.message || "Failed to create brand");
      throw error; // Re-throw so form can handle it
    }
  };

  const handleCampaignSubmit = async (data: CreateCampaignRequest) => {
    try {
      await campaignsHook.createCampaign(data);
      toast.success("Campaign submitted for registration! Carrier approval typically takes 1-7 days.");
      await loadData(); // Refresh data
      setCampaignDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create campaign");
      throw error; // Re-throw so form can handle it
    }
  };

  const handleNumberAssignment = () => {
    // Handle number assignment logic
    setNumberAssignDialogOpen(false);
  };

  // Loading state (only show on initial load)
  if (isInitialLoad) {
    return (
      <div className="p-6 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messaging</h1>
          <p className="text-muted-foreground">
            Manage A2P 10DLC brands, campaigns, and messaging compliance
          </p>
        </div>

        <div className="flex space-x-2">
          <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Building2Icon className="w-4 h-4 mr-2" />
                Register Brand
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Brand Registration</DialogTitle>
                <DialogDescription>
                  Register a new brand for A2P 10DLC messaging compliance
                </DialogDescription>
              </DialogHeader>
              <div className="p-6">
                <BrandRegistrationForm
                  entityTypes={entityTypes}
                  verticals={verticals}
                  onSubmit={handleBrandSubmit}
                  onCancel={() => setBrandDialogOpen(false)}
                />
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={campaignDialogOpen}
            onOpenChange={setCampaignDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Campaign Registration</DialogTitle>
                <DialogDescription>
                  Create a new messaging campaign for your approved brand
                </DialogDescription>
              </DialogHeader>
              <div className="p-6">
                <CampaignRegistrationForm
                  brands={activeBrands}
                  useCases={useCases}
                  onSubmit={handleCampaignSubmit}
                  onCancel={() => setCampaignDialogOpen(false)}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Brands</CardTitle>
            <Building2Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBrands.length}</div>
            <p className="text-xs text-muted-foreground">
              {pendingBrands.length} pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Campaigns
            </CardTitle>
            <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns.length}</div>
            <p className="text-xs text-muted-foreground">
              {pendingCampaigns.length} pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalMessagesSent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {deliveryRate}% delivery rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Assigned Numbers
            </CardTitle>
            <PhoneIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignedNumbersCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {availableNumbersCount} available for assignment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="numbers">Numbers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest brand and campaign updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />

                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      TechCorp Communications approved
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Brand registration completed
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    2 days ago
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />

                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Marketing Promotions pending
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Campaign under review
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    1 day ago
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />

                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Customer Notifications approved
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Campaign ready for messaging
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    3 days ago
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
                <CardDescription>A2P 10DLC compliance overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Brand Verification</span>
                    <span className="text-green-600">Complete</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Campaign Approval</span>
                    <span className="text-yellow-600">In Progress</span>
                  </div>
                  <Progress value={67} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Number Assignment</span>
                    <span className="text-green-600">Active</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="brands" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registered Brands</CardTitle>
              <CardDescription>
                Manage your A2P 10DLC brand registrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand Name</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Vertical</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Auth+ Status</TableHead>
                      <TableHead>Can Create Campaigns</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>Trust Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brands.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No brands registered yet. Click "Register Brand" to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      brands.map((brand) => (
                        <TableRow key={brand.id}>
                          <TableCell className="font-medium">
                            <Link
                              to={`/messaging/brands/${brand.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {brand.display_name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {brand.entity_type?.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>{brand.vertical || "N/A"}</TableCell>
                          <TableCell>{getStatusBadge(brand.status as BrandStatus || "PENDING")}</TableCell>
                          <TableCell>
                            {brand.entity_type === "PUBLIC_PROFIT" ? (
                              brand.vetting_status ? (
                                <Badge className={getAuthPlusVariant(brand.vetting_status)}>
                                  {brand.vetting_status}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                  Required
                                </Badge>
                              )
                            ) : (
                              <span className="text-muted-foreground text-sm">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {canCreateCampaigns(brand) ? (
                              <CheckCircleIcon className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircleIcon className="h-4 w-4 text-red-600" />
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDate(brand.created_at)}
                          </TableCell>
                          <TableCell>
                            {brand.trust_score ? (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">
                                  {brand.trust_score}
                                </span>
                                <Progress
                                  value={brand.trust_score}
                                  className="w-16 h-2"
                                />
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Pending
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={`/messaging/brands/${brand.id}`}>
                              <Button variant="ghost" size="sm">
                                <SettingsIcon className="w-4 h-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Messaging Campaigns</CardTitle>
              <CardDescription>
                Manage your A2P 10DLC messaging campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Use Case</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Messages Sent</TableHead>
                      <TableHead>Assigned Numbers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No campaigns created yet. Click "Create Campaign" to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      campaigns.map((campaign) => {
                        const brand = brands.find((b) => b.id === campaign.brand_id);
                        return (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium">
                              {campaign.description.substring(0, 50)}
                              {campaign.description.length > 50 ? "..." : ""}
                            </TableCell>
                            <TableCell>{brand?.display_name || "Unknown"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{campaign.use_case}</Badge>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(campaign.status as CampaignStatus)}
                            </TableCell>
                            <TableCell>
                              {0} {/* TODO: Get from MDR data */}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <span>{0}</span> {/* TODO: Get assigned numbers count */}
                                {campaign.status === "ACTIVE" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedCampaign(campaign.id);
                                      setNumberAssignDialogOpen(true);
                                    }}
                                  >
                                    <PlusIcon className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">
                                <SettingsIcon className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Messaging Numbers</CardTitle>
              <CardDescription>
                Phone numbers assigned to messaging campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Messages Sent</TableHead>
                      <TableHead>Messages Received</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Phone number assignments coming soon. This will integrate with your DID inventory.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
