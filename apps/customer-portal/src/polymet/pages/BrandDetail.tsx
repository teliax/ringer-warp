import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Building2Icon, InfoIcon } from "lucide-react";
import { AuthPlusProgressCard } from "@/components/vetting/AuthPlusProgressCard";
import { RequestAuthPlusDialog } from "@/components/dialogs/RequestAuthPlusDialog";
import { EditBrandDialog } from "@/components/dialogs/EditBrandDialog";
import { RequestVettingDialog } from "@/components/dialogs/RequestVettingDialog";
import { useBrands } from "@/hooks/useBrands";
import { useMessagingEnums } from "@/hooks/useMessagingEnums";
import type { Brand10DLC, UpdateBrandRequest, EntityTypeInfo, VerticalInfo } from "@/types/messaging";
import { toast } from "sonner";

export function BrandDetail() {
  const { id } = useParams<{ id: string }>();
  const [brand, setBrand] = useState<Brand10DLC | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPlusDialogOpen, setAuthPlusDialogOpen] = useState(false);
  const [editBrandDialogOpen, setEditBrandDialogOpen] = useState(false);
  const [vettingDialogOpen, setVettingDialogOpen] = useState(false);
  const [entityTypes, setEntityTypes] = useState<EntityTypeInfo[]>([]);
  const [verticals, setVerticals] = useState<VerticalInfo[]>([]);

  const brandsHook = useBrands();
  const enumsHook = useMessagingEnums();

  useEffect(() => {
    loadBrand();
    loadEnums();
  }, [id]);

  const loadEnums = async () => {
    try {
      const [entityTypesData, verticalsData] = await Promise.all([
        enumsHook.getEntityTypes(),
        enumsHook.getVerticals(),
      ]);
      setEntityTypes(entityTypesData);
      setVerticals(verticalsData);
    } catch (error) {
      console.error('Failed to load enums:', error);
    }
  };

  const loadBrand = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const brands = await brandsHook.listBrands();
      const foundBrand = brands.find(b => b.id === id);
      setBrand(foundBrand || null);
    } catch (error) {
      console.error('Failed to load brand:', error);
      toast.error("Failed to load brand details");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAuthPlus = async () => {
    if (!brand?.id) return;
    try {
      await brandsHook.requestVetting(brand.id, "AEGIS", "AUTHPLUS");
      toast.success("Auth+ verification requested! 2FA email sent to business contact.");
      await loadBrand();
    } catch (error: any) {
      toast.error(error.message || "Failed to request Auth+ verification");
    }
  };

  const handleUpdateBrand = async (data: UpdateBrandRequest) => {
    if (!brand?.id) return;
    try {
      await brandsHook.updateBrand(brand.id, data);
      toast.success("Brand updated successfully!");
      await loadBrand();
    } catch (error: any) {
      toast.error(error.message || "Failed to update brand");
      throw error;
    }
  };

  const handleRequestVetting = async (vettingClass: string) => {
    if (!brand?.id) return;
    try {
      await brandsHook.requestVetting(brand.id, "AEGIS", vettingClass);
      toast.success(`${vettingClass} vetting requested! Estimated time: 3-5 business days.`);
      await loadBrand();
    } catch (error: any) {
      toast.error(error.message || "Failed to request vetting");
      throw error;
    }
  };

  const handleResubmitBrand = async (brandId: string) => {
    try {
      await brandsHook.resubmitBrand(brandId);
      toast.success("Brand resubmitted for verification!");
      await loadBrand();
    } catch (error: any) {
      toast.error(error.message || "Failed to resubmit brand");
      throw error;
    }
  };

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
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Brand Not Found</AlertTitle>
          <AlertDescription>
            The requested brand could not be found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isPublicProfit = brand.entity_type === "PUBLIC_PROFIT";
  const identityOK = brand.identity_status === "VERIFIED" || brand.identity_status === "VETTED_VERIFIED";
  const authPlusOK = brand.vetting_status === "ACTIVE";
  const needsAuthPlus = isPublicProfit && identityOK && !authPlusOK;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{brand.display_name}</h1>
          <p className="text-muted-foreground">TCR Brand ID: {brand.tcr_brand_id}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setEditBrandDialogOpen(true)}>
            Edit Brand
          </Button>
          {brand.identity_status === "UNVERIFIED" && (
            <Button onClick={() => setVettingDialogOpen(true)}>
              Request Vetting
            </Button>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Registration Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={
              brand.status === "VERIFIED" || brand.status === "VETTED_VERIFIED" ? "bg-green-100 text-green-800" :
              brand.status === "REGISTERED" ? "bg-blue-100 text-blue-800" :
              brand.status === "UNVERIFIED" ? "bg-yellow-100 text-yellow-800" :
              "bg-gray-100 text-gray-800"
            }>
              {brand.status || "PENDING"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Identity Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={
              identityOK ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }>
              {brand.identity_status || "PENDING"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Auth+ Vetting</CardTitle>
          </CardHeader>
          <CardContent>
            {isPublicProfit ? (
              <Badge className={
                authPlusOK ? "bg-green-100 text-green-800" :
                brand.vetting_status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                brand.vetting_status === "FAILED" ? "bg-red-100 text-red-800" :
                "bg-gray-100 text-gray-800"
              }>
                {brand.vetting_status || "Required"}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">N/A</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auth+ Required Alert */}
      {needsAuthPlus && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Auth+ Verification Required</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Your brand needs Auth+ verification to create campaigns.</span>
            <Button onClick={() => setAuthPlusDialogOpen(true)} size="sm">
              Request Auth+ Verification →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Auth+ Active Success */}
      {isPublicProfit && authPlusOK && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">Auth+ Verification Complete</AlertTitle>
          <AlertDescription className="text-green-800">
            Your brand is fully verified. You can now create campaigns!
          </AlertDescription>
        </Alert>
      )}

      {/* Brand Information */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Information</CardTitle>
          <CardDescription>Company registration details</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Legal Name</p>
            <p className="font-medium">{brand.legal_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Entity Type</p>
            <p className="font-medium">{brand.entity_type?.replace(/_/g, " ")}</p>
          </div>
          {brand.tax_id && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tax ID / EIN</p>
              <p className="font-medium">{brand.tax_id}</p>
            </div>
          )}
          {brand.vertical && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Vertical</p>
              <p className="font-medium">{brand.vertical}</p>
            </div>
          )}
          {brand.website && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Website</p>
              <p className="font-medium">{brand.website}</p>
            </div>
          )}
          {brand.business_contact_email && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Business Contact</p>
              <p className="font-medium">
                {brand.business_contact_first_name} {brand.business_contact_last_name}
                <br />
                <span className="text-sm text-muted-foreground">{brand.business_contact_email}</span>
              </p>
            </div>
          )}
          {brand.trust_score && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Trust Score</p>
              <p className="font-medium text-lg">{brand.trust_score}/100</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auth+ Progress Card (only for PUBLIC_PROFIT) */}
      {isPublicProfit && brand.vetting_status && (
        <AuthPlusProgressCard brand={brand} />
      )}

      {/* Dialogs */}
      <RequestAuthPlusDialog
        open={authPlusDialogOpen}
        onOpenChange={setAuthPlusDialogOpen}
        brand={brand}
        onSubmit={handleRequestAuthPlus}
      />
      <EditBrandDialog
        open={editBrandDialogOpen}
        onOpenChange={setEditBrandDialogOpen}
        brand={brand}
        entityTypes={entityTypes}
        verticals={verticals}
        onSubmit={handleUpdateBrand}
        onResubmit={handleResubmitBrand}
      />
      <RequestVettingDialog
        open={vettingDialogOpen}
        onOpenChange={setVettingDialogOpen}
        brand={brand}
        onSubmit={handleRequestVetting}
      />
    </div>
  );
}
