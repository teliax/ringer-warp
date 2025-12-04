import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Brand10DLC, UpdateBrandRequest, EntityTypeInfo, VerticalInfo } from "@/types/messaging";
import { formatPhoneE164 } from "@/lib/utils/phone-formatter";

// Comprehensive brand update schema - all fields optional
const updateBrandSchema = z.object({
  // Business Information
  display_name: z.string().min(2).max(255).optional(),
  company_name: z.string().min(2).max(255).optional(), // ⚠️ Core
  website: z.string().url().max(255).optional().or(z.literal("")),
  vertical: z.string().optional(),
  entity_type: z.enum(["PRIVATE_PROFIT", "PUBLIC_PROFIT", "NON_PROFIT", "GOVERNMENT", "SOLE_PROPRIETOR"]).optional(), // ⚠️ Core
  tax_id: z.string().optional(), // ⚠️ Core

  // Address
  street: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional().or(z.literal("")),
  postal_code: z.string().max(10).optional(),

  // Contact
  email: z.string().email().max(100).optional().or(z.literal("")),
  phone: z.string().regex(/^\+1[0-9]{10}$/).optional().or(z.literal("")),
  business_contact_first_name: z.string().max(100).optional(),
  business_contact_last_name: z.string().max(100).optional(),
  business_contact_email: z.string().email().max(255).optional().or(z.literal("")),
  business_contact_phone: z.string().max(20).optional().or(z.literal("")),

  // Stock
  stock_symbol: z.string().max(10).optional().or(z.literal("")),
  stock_exchange: z.string().optional().or(z.literal("")),

  // Alt IDs
  alt_business_id: z.string().max(50).optional().or(z.literal("")),
  alt_business_id_type: z.enum(["NONE", "DUNS", "GIIN", "LEI"]).optional(),
  reference_id: z.string().max(50).optional().or(z.literal("")),
});

type UpdateBrandFormData = z.infer<typeof updateBrandSchema>;

interface EditBrandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: Brand10DLC;
  entityTypes?: EntityTypeInfo[];
  verticals?: VerticalInfo[];
  onSubmit: (data: UpdateBrandRequest) => Promise<void>;
  onResubmit?: (brandId: string) => Promise<void>;
}

export function EditBrandDialog({
  open,
  onOpenChange,
  brand,
  entityTypes = [],
  verticals = [],
  onSubmit,
  onResubmit,
}: EditBrandDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coreFieldsChanged, setCoreFieldsChanged] = useState(false);
  const [showResubmitPrompt, setShowResubmitPrompt] = useState(false);

  const form = useForm<UpdateBrandFormData>({
    resolver: zodResolver(updateBrandSchema),
    defaultValues: {
      display_name: brand.display_name || "",
      company_name: brand.company_name || "",
      website: brand.website || "",
      vertical: brand.vertical || "",
      entity_type: brand.entity_type as any || undefined,
      tax_id: brand.tax_id || "",
      street: brand.street || "",
      city: brand.city || "",
      state: brand.state || "",
      postal_code: brand.postal_code || "",
      email: brand.email || "",
      phone: brand.phone || "",
      business_contact_first_name: brand.business_contact_first_name || "",
      business_contact_last_name: brand.business_contact_last_name || "",
      business_contact_email: brand.business_contact_email || "",
      business_contact_phone: brand.business_contact_phone || "",
      stock_symbol: brand.stock_symbol || "",
      stock_exchange: brand.stock_exchange || "",
      alt_business_id: brand.alt_business_id || "",
      alt_business_id_type: (brand.alt_business_id_type as any) || "NONE",
      reference_id: brand.reference_id || "",
    },
  });

  const checkCoreFieldChanges = () => {
    const companyNameChanged = form.getValues("company_name") !== (brand.company_name || "");
    const taxIdChanged = form.getValues("tax_id") !== (brand.tax_id || "");
    const entityTypeChanged = form.getValues("entity_type") !== brand.entity_type;
    const hasChanges = companyNameChanged || taxIdChanged || entityTypeChanged;
    setCoreFieldsChanged(hasChanges);
    return hasChanges;
  };

  const handleFormSubmit = async (data: UpdateBrandFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data as UpdateBrandRequest);

      const coreChanged = checkCoreFieldChanges();
      if (coreChanged) {
        setShowResubmitPrompt(true);
        // Don't show toast - let the resubmit prompt do the talking
      } else {
        toast.success("Brand updated successfully");
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error("Failed to update brand", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    if (!onResubmit) return;

    try {
      await onResubmit(brand.id);
      toast.success("Brand resubmitted for verification");
      setShowResubmitPrompt(false);
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Failed to resubmit brand", {
        description: error.message,
      });
    }
  };

  const isPublicCompany = form.watch("entity_type") === "PUBLIC_PROFIT";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" key={brand.updated_at || brand.id}>
        <DialogHeader>
          <DialogTitle>Edit Brand: {brand.display_name}</DialogTitle>
          <DialogDescription>
            Update brand information - changes automatically sync to TCR
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* Resubmit Prompt */}
            {showResubmitPrompt && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-900">Action Required: Resubmit Brand</AlertTitle>
                <AlertDescription className="text-orange-800">
                  <p className="mb-3">You changed core identity fields (legal name, EIN, or entity type). Your brand status is now UNVERIFIED.</p>
                  <p className="mb-3 font-semibold">Next step: Click the button below to resubmit your brand to TCR for verification.</p>
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleResubmit} variant="default" className="bg-orange-600 hover:bg-orange-700">
                      Resubmit for Verification Now →
                    </Button>
                    <Button type="button" onClick={() => { setShowResubmitPrompt(false); onOpenChange(false); }} variant="outline">
                      Skip (I'll do this later)
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Guidelines Alert */}
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <p className="text-red-600"><strong>⚠️ Requires resubmission:</strong> Legal name, Tax ID, Entity Type</p>
              </AlertDescription>
            </Alert>

            {/* Business Information */}
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">Business Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Legal Name <span className="text-xs text-red-600">⚠️</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} onChange={(e) => { field.onChange(e); checkCoreFieldChanges(); }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tax_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Tax ID / EIN <span className="text-xs text-red-600">⚠️</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} onChange={(e) => { field.onChange(e); checkCoreFieldChanges(); }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {entityTypes.length > 0 && verticals.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="entity_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Entity Type <span className="text-xs text-red-600">⚠️</span>
                        </FormLabel>
                        <Select onValueChange={(val) => { field.onChange(val); checkCoreFieldChanges(); }} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {entityTypes.map((type) => (
                              <SelectItem key={type.code} value={type.code}>{type.display_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vertical"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry Vertical</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {verticals.map((v) => (
                              <SelectItem key={v.code} value={v.code}>{v.display_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">Business Address</h3>

              <FormField
                control={form.control}
                name="street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem><FormLabel>State</FormLabel><FormControl><Input maxLength={2} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="postal_code" render={({ field }) => (
                  <FormItem><FormLabel>Zip</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">Contact Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          const formatted = formatPhoneE164(e.target.value);
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="business_contact_first_name" render={({ field }) => (
                  <FormItem><FormLabel>Business Contact First Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="business_contact_last_name" render={({ field }) => (
                  <FormItem><FormLabel>Business Contact Last Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="business_contact_email" render={({ field }) => (
                  <FormItem><FormLabel>Business Contact Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="business_contact_phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Contact Phone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          const formatted = formatPhoneE164(e.target.value);
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Stock Info (Public Companies) */}
            {isPublicCompany && (
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Stock Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="stock_exchange" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exchange</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                          <SelectItem value="NYSE">NYSE</SelectItem>
                          <SelectItem value="AMEX">AMEX</SelectItem>
                          <SelectItem value="AMX">AMX (Mexican Stock Exchange)</SelectItem>
                          <SelectItem value="TSX">TSX (Toronto)</SelectItem>
                          <SelectItem value="LON">LON (London)</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="stock_symbol" render={({ field }) => (
                    <FormItem><FormLabel>Symbol</FormLabel><FormControl><Input maxLength={10} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
            )}

            {/* Alt IDs */}
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">Alternative IDs</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="alt_business_id_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "NONE"}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="NONE">None</SelectItem>
                        <SelectItem value="DUNS">DUNS</SelectItem>
                        <SelectItem value="GIIN">GIIN</SelectItem>
                        <SelectItem value="LEI">LEI</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="alt_business_id" render={({ field }) => (
                  <FormItem><FormLabel>ID Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
