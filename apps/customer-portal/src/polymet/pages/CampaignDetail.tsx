import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  PlusIcon,
  Trash2,
  ArrowLeft,
  MessageSquare,
  Building2,
  RefreshCw,
} from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useBrands } from "@/hooks/useBrands";
import type {
  Campaign10DLC,
  CampaignMNOStatus,
  CampaignPhoneNumber,
  Brand10DLC,
} from "@/types/messaging";
import { toast } from "sonner";

// MNO name mapping for display (IDs from TCR /enum/mno endpoint)
const MNO_DISPLAY_NAMES: Record<string, string> = {
  "10017": "AT&T",
  "10035": "T-Mobile",
  "10038": "Verizon",
};

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign10DLC | null>(null);
  const [brand, setBrand] = useState<Brand10DLC | null>(null);
  const [mnoStatuses, setMnoStatuses] = useState<CampaignMNOStatus[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<CampaignPhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingMNO, setRefreshingMNO] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [assigningNumber, setAssigningNumber] = useState(false);

  const campaignsHook = useCampaigns();
  const brandsHook = useBrands();

  useEffect(() => {
    loadCampaignData();
  }, [id]);

  const loadCampaignData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Load campaign details
      const campaignData = await campaignsHook.getCampaign(id);
      setCampaign(campaignData);

      // Load associated brand
      const brands = await brandsHook.listBrands();
      const foundBrand = brands.find(b => b.id === campaignData.brand_id);
      setBrand(foundBrand || null);

      // Load MNO status
      const statuses = await campaignsHook.getMNOStatus(id);
      setMnoStatuses(statuses);

      // Load assigned phone numbers
      const numbers = await campaignsHook.getAssignedNumbers(id);
      setPhoneNumbers(numbers);
    } catch (error: any) {
      console.error('Failed to load campaign:', error);
      toast.error(error.message || "Failed to load campaign details");
    } finally {
      setLoading(false);
    }
  };

  const refreshMNOStatus = async () => {
    if (!id) return;
    setRefreshingMNO(true);
    try {
      const statuses = await campaignsHook.getMNOStatus(id);
      setMnoStatuses(statuses);
      toast.success("MNO status refreshed");
    } catch (error: any) {
      toast.error("Failed to refresh MNO status");
    } finally {
      setRefreshingMNO(false);
    }
  };

  const handleAssignNumber = async () => {
    if (!id || !newPhoneNumber.trim()) return;
    setAssigningNumber(true);
    try {
      // Format phone number (remove spaces, add + if missing)
      let formattedNumber = newPhoneNumber.replace(/\s/g, "");
      if (!formattedNumber.startsWith("+")) {
        formattedNumber = "+" + formattedNumber;
      }

      await campaignsHook.assignNumbers(id, [formattedNumber]);
      toast.success(`Phone number ${formattedNumber} assigned`);
      setNewPhoneNumber("");
      setAssignDialogOpen(false);

      // Refresh phone numbers
      const numbers = await campaignsHook.getAssignedNumbers(id);
      setPhoneNumbers(numbers);
    } catch (error: any) {
      toast.error(error.message || "Failed to assign phone number");
    } finally {
      setAssigningNumber(false);
    }
  };

  const handleRemoveNumber = async (phoneNumber: string) => {
    if (!id) return;
    try {
      await campaignsHook.removeNumbers(id, [phoneNumber]);
      toast.success(`Phone number ${phoneNumber} removed`);

      // Refresh phone numbers
      const numbers = await campaignsHook.getAssignedNumbers(id);
      setPhoneNumbers(numbers);
    } catch (error: any) {
      toast.error(error.message || "Failed to remove phone number");
    }
  };

  const getMNOStatusIcon = (status: string) => {
    switch (status) {
      case "REGISTERED":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "REJECTED":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "REVIEW":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "SUSPENDED":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getMNOStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      REGISTERED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      REVIEW: "bg-yellow-100 text-yellow-800",
      SUSPENDED: "bg-orange-100 text-orange-800",
    };
    return variants[status] || "bg-gray-100 text-gray-800";
  };

  const getCampaignStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      REJECTED: "bg-red-100 text-red-800",
      SUSPENDED: "bg-orange-100 text-orange-800",
      EXPIRED: "bg-gray-100 text-gray-800",
      FAILED: "bg-red-100 text-red-800",
    };
    return variants[status] || "bg-gray-100 text-gray-800";
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Campaign not found
  if (!campaign) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Campaign Not Found</AlertTitle>
          <AlertDescription>
            The requested campaign could not be found.
          </AlertDescription>
        </Alert>
        <Link to="/messaging" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Messaging
          </Button>
        </Link>
      </div>
    );
  }

  const isActive = campaign.status === "ACTIVE";
  const allCarriersApproved = mnoStatuses.length >= 3 &&
    mnoStatuses.every(s => s.status === "REGISTERED");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/messaging">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Campaign Details</h1>
            <p className="text-muted-foreground">
              TCR Campaign ID: {campaign.tcr_campaign_id || "Pending"}
            </p>
          </div>
        </div>
        <Badge className={getCampaignStatusBadge(campaign.status)}>
          {campaign.status}
        </Badge>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Use Case</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-base">
              {campaign.use_case.replace(/_/g, " ")}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Brand</CardTitle>
          </CardHeader>
          <CardContent>
            {brand ? (
              <Link
                to={`/messaging/brands/${brand.id}`}
                className="flex items-center text-blue-600 hover:underline"
              >
                <Building2 className="h-4 w-4 mr-2" />
                {brand.display_name}
              </Link>
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {campaign.throughput_limit || "N/A"}
              <span className="text-sm font-normal text-muted-foreground"> msg/sec</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Daily Cap</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {campaign.daily_cap?.toLocaleString() || "N/A"}
              <span className="text-sm font-normal text-muted-foreground"> msg/day</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* MNO Status Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Carrier Approval Status</CardTitle>
            <CardDescription>
              Per-carrier (MNO) approval status from T-Mobile, AT&T, and Verizon
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMNOStatus}
            disabled={refreshingMNO}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshingMNO ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {allCarriersApproved && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900">All Carriers Approved</AlertTitle>
              <AlertDescription className="text-green-800">
                Your campaign is approved by all major carriers. You can now assign phone numbers and start messaging.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-3 gap-4">
            {["10017", "10035", "10038"].map((mnoId) => {
              const status = mnoStatuses.find(s => s.mno_id === mnoId);
              return (
                <Card key={mnoId} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-lg">
                        {MNO_DISPLAY_NAMES[mnoId]}
                      </span>
                      {status ? getMNOStatusIcon(status.status) : <Clock className="h-5 w-5 text-gray-400" />}
                    </div>
                    <Badge className={getMNOStatusBadge(status?.status || "PENDING")}>
                      {status?.status || "PENDING"}
                    </Badge>
                    {status?.rejection_reason && (
                      <p className="mt-2 text-sm text-red-600">
                        {status.rejection_reason}
                      </p>
                    )}
                    {status?.status_updated_at && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated: {new Date(status.status_updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column - Description & Message Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="mt-1">{campaign.description}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Message Flow</p>
              <p className="mt-1">{campaign.message_flow}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Opt-In Required</p>
                <Badge variant={campaign.subscriber_optin ? "default" : "secondary"}>
                  {campaign.subscriber_optin ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Opt-Out Support</p>
                <Badge variant="default">Required</Badge>
              </div>
            </div>
            {campaign.privacy_policy_url && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Privacy Policy</p>
                <a
                  href={campaign.privacy_policy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {campaign.privacy_policy_url}
                </a>
              </div>
            )}
            {campaign.terms_url && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Terms & Conditions</p>
                <a
                  href={campaign.terms_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {campaign.terms_url}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Sample Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Sample Messages
            </CardTitle>
            <CardDescription>
              {campaign.sample_messages?.length || 0} sample message(s) registered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campaign.sample_messages?.map((sample, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded-lg border text-sm"
                >
                  <span className="font-medium text-muted-foreground">
                    Sample {index + 1}:
                  </span>
                  <p className="mt-1">{sample}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phone Numbers Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Phone className="h-5 w-5 mr-2" />
              Assigned Phone Numbers
            </CardTitle>
            <CardDescription>
              Phone numbers registered to this campaign for 10DLC messaging
            </CardDescription>
          </div>
          <Button
            onClick={() => setAssignDialogOpen(true)}
            disabled={!isActive}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Assign Number
          </Button>
        </CardHeader>
        <CardContent>
          {!isActive && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Campaign Not Active</AlertTitle>
              <AlertDescription>
                Phone numbers can only be assigned to active campaigns. Current status: {campaign.status}
              </AlertDescription>
            </Alert>
          )}

          {phoneNumbers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No phone numbers assigned yet.</p>
              {isActive && (
                <p className="text-sm mt-2">
                  Click "Assign Number" to register phone numbers to this campaign.
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Assigned At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phoneNumbers.map((number) => (
                  <TableRow key={number.id}>
                    <TableCell className="font-mono">
                      {number.phone_number}
                    </TableCell>
                    <TableCell>
                      {new Date(number.assigned_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={number.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {number.is_active ? "Active" : "Removed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {number.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveNumber(number.phone_number)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Content Attributes */}
      <Card>
        <CardHeader>
          <CardTitle>Content Attributes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              {campaign.embedded_link ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
              <span>Contains Links/URLs</span>
            </div>
            <div className="flex items-center space-x-2">
              {campaign.embedded_phone ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
              <span>Contains Phone Numbers</span>
            </div>
            <div className="flex items-center space-x-2">
              {campaign.number_pool ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
              <span>Number Pool (50+)</span>
            </div>
            <div className="flex items-center space-x-2">
              {campaign.age_gated ? (
                <CheckCircle className="h-4 w-4 text-yellow-600" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
              <span>Age-Gated (18+)</span>
            </div>
            <div className="flex items-center space-x-2">
              {campaign.direct_lending ? (
                <CheckCircle className="h-4 w-4 text-yellow-600" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
              <span>Direct Lending</span>
            </div>
            <div className="flex items-center space-x-2">
              {campaign.auto_renewal ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
              <span>Auto-Renewal</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {campaign.reference_id && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reference ID</p>
                <p className="font-medium">{campaign.reference_id}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(campaign.created_at).toLocaleDateString()}</p>
            </div>
            {campaign.tcr_submission_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Submitted to TCR</p>
                <p className="font-medium">{new Date(campaign.tcr_submission_date).toLocaleDateString()}</p>
              </div>
            )}
            {campaign.tcr_approval_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">TCR Approved</p>
                <p className="font-medium">{new Date(campaign.tcr_approval_date).toLocaleDateString()}</p>
              </div>
            )}
            {campaign.expiration_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiration Date</p>
                <p className="font-medium">{new Date(campaign.expiration_date).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assign Number Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Phone Number</DialogTitle>
            <DialogDescription>
              Enter the phone number to assign to this campaign. Use E.164 format (e.g., +14155551234).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="+14155551234"
              value={newPhoneNumber}
              onChange={(e) => setNewPhoneNumber(e.target.value)}
            />
            <p className="text-sm text-muted-foreground mt-2">
              The phone number must be a 10DLC-eligible number from your inventory.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignNumber} disabled={assigningNumber || !newPhoneNumber.trim()}>
              {assigningNumber ? "Assigning..." : "Assign Number"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
