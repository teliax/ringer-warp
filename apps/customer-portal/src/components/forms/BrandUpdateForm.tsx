import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
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
import { toast } from "sonner";
import type { Brand10DLC, EntityTypeInfo, VerticalInfo } from "@/types/messaging";

// Brand update schema - all fields optional
const brandUpdateSchema = z.object({
  // Business Information
  display_name: z.string().min(2).max(255).optional(),
  company_name: z.string().min(2).max(255).optional(), // ⚠️ Core identity field
  website: z.string().url().max(255).optional().or(z.literal("")),
  vertical: z.string().optional(),
  entity_type: z.enum(["PRIVATE_PROFIT", "PUBLIC_PROFIT", "NON_PROFIT", "GOVERNMENT", "SOLE_PROPRIETOR"]).optional(), // ⚠️ Core identity field
  tax_id: z.string().optional(), // ⚠️ Core identity field

  // Address
  street: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  postal_code: z.string().max(10).optional(),

  // Contact Information
  email: z.string().email().max(100).optional(),
  phone: z.string().regex(/^\+1[0-9]{10}$/).max(20).optional().or(z.literal("")),

  // Business Contact
  business_contact_first_name: z.string().max(100).optional(),
  business_contact_last_name: z.string().max(100).optional(),
  business_contact_email: z.string().email().max(255).optional().or(z.literal("")),
  business_contact_phone: z.string().max(20).optional().or(z.literal("")),

  // Stock Information (Public Companies)
  stock_symbol: z.string().max(10).optional().or(z.literal("")),
  stock_exchange: z.string().optional().or(z.literal("")),

  // Alternative Business IDs
  alt_business_id: z.string().max(50).optional().or(z.literal("")),
  alt_business_id_type: z.enum(["NONE", "DUNS", "GIIN", "LEI"]).optional(),

  // Reference ID
  reference_id: z.string().max(50).optional().or(z.literal("")),
});

type BrandUpdateData = z.infer<typeof brandUpdateSchema>;

interface BrandUpdateFormProps {
  brand: Brand10DLC;
  entityTypes: EntityTypeInfo[];
  verticals: VerticalInfo[];
  onSubmit: (data: Partial<BrandUpdateData>) => Promise<void>;
  onResubmit: () => Promise<void>;
  onCancel: () => void;
}

export function BrandUpdateForm({
  brand,
  entityTypes,
  verticals,
  onSubmit,
  onResubmit,
  onCancel,
}: BrandUpdateFormProps) {
  const [coreFieldsChanged, setCoreFieldsChanged] = useState(false);
  const [showResubmitWarning, setShowResubmitWarning] = useState(false);

  const form = useForm<BrandUpdateData>({
    resolver: zodResolver(brandUpdateSchema),
    defaultValues: {
      display_name: brand.display_name || "",
      company_name: brand.company_name || "",
      website: brand.website || "",
      vertical: brand.vertical || "",
      entity_type: brand.entity_type as any || "PRIVATE_PROFIT",
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

  // Track changes to core identity fields
  const checkCoreFieldChanges = () => {
    const companyNameChanged = form.getValues("company_name") !== (brand.company_name || "");
    const taxIdChanged = form.getValues("tax_id") !== (brand.tax_id || "");
    const entityTypeChanged = form.getValues("entity_type") !== brand.entity_type;

    const hasChanges = companyNameChanged || taxIdChanged || entityTypeChanged;
    setCoreFieldsChanged(hasChanges);
    return hasChanges;
  };

  const handleSubmit = async (data: BrandUpdateData) => {
    // Filter out unchanged fields
    const changes: Partial<BrandUpdateData> = {};
    Object.keys(data).forEach((key) => {
      const k = key as keyof BrandUpdateData;
      if (data[k] !== brand[k as keyof Brand10DLC]) {
        changes[k] = data[k];
      }
    });

    if (Object.keys(changes).length === 0) {
      toast.info("No changes detected");
      return;
    }

    try {
      await onSubmit(changes);

      // Check if core fields were changed
      const coreChanged = checkCoreFieldChanges();
      if (coreChanged) {
        setShowResubmitWarning(true);
        toast.warning("Core identity fields updated", {
          description: "Brand status may change to UNVERIFIED. Click 'Resubmit for Verification' to re-verify.",
          duration: 10000,
        });
      } else {
        toast.success("Brand updated successfully");
        onCancel(); // Close form after successful non-core update
      }
    } catch (error: any) {
      form.setError("root", {
        type: "manual",
        message: error.message || "Failed to update brand",
      });
    }
  };

  const handleResubmit = async () => {
    try {
      await onResubmit();
      toast.success("Brand resubmitted for verification", {
        description: "TCR will review the changes. Check status in a few minutes.",
      });
      setShowResubmitWarning(false);
      onCancel();
    } catch (error: any) {
      toast.error("Failed to resubmit brand", {
        description: error.message || "Unable to resubmit to TCR",
      });
    }
  };

  const isPublicCompany = form.watch("entity_type") === "PUBLIC_PROFIT";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {form.formState.errors.root && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
          </Alert>
        )}

        {showResubmitWarning && (
          <Alert>
            <AlertTitle>⚠️ Resubmission Required</AlertTitle>
            <AlertDescription>
              You updated core identity fields (legal name, EIN, or entity type).
              Your brand status may have changed to UNVERIFIED. Click the button below
              to resubmit your brand for verification with TCR.
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={handleResubmit}
                  variant="default"
                >
                  Resubmit for Verification
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Core Identity Warning */}
        <Alert variant="warning">
          <AlertTitle>Update Guidelines</AlertTitle>
          <AlertDescription>
            <div className="space-y-2 text-sm">
              <p><strong>Freely updatable:</strong> Display name, website, address, contact info, stock info</p>
              <p className="text-red-600"><strong>⚠️ Requires resubmission:</strong> Legal name (company_name), Tax ID (EIN), Entity Type</p>
              <p className="text-xs text-muted-foreground mt-2">
                After updating core identity fields, your brand status will change to UNVERIFIED and you must resubmit for verification.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Business Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Business Information</h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="ACME Communications" {...field} />
                  </FormControl>
                  <FormDescription>Marketing/DBA name</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Legal Company Name
                    <span className="text-xs text-red-600">⚠️ Core Field</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ACME Communications LLC"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        checkCoreFieldChanges();
                      }}
                    />
                  </FormControl>
                  <FormDescription className="text-red-600 text-xs">
                    Changing this requires resubmission
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="entity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Entity Type
                    <span className="text-xs text-red-600">⚠️ Core Field</span>
                  </FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      checkCoreFieldChanges();
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {entityTypes.map((type) => (
                        <SelectItem key={type.code} value={type.code}>
                          {type.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-red-600 text-xs">
                    Changing this requires resubmission
                  </FormDescription>
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
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {verticals.map((vertical) => (
                        <SelectItem key={vertical.code} value={vertical.code}>
                          {vertical.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Primary industry segment</FormDescription>
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
                  <FormLabel className="flex items-center gap-2">
                    EIN / Tax ID
                    <span className="text-xs text-red-600">⚠️ Core Field</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="12-3456789"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        checkCoreFieldChanges();
                      }}
                    />
                  </FormControl>
                  <FormDescription className="text-red-600 text-xs">
                    Changing this requires resubmission
                  </FormDescription>
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
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormDescription>Company website URL</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Address Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Business Address</h3>

          <FormField
            control={form.control}
            name="street"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main Street" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="New York" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder="NY" maxLength={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postal_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input placeholder="10001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Primary Contact Information</h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@example.com" {...field} />
                  </FormControl>
                  <FormDescription>Primary support contact email</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+15551234567" {...field} />
                  </FormControl>
                  <FormDescription>E.164 format: +1XXXXXXXXXX</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Business Contact Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Business Contact</h3>
          <p className="text-sm text-muted-foreground">
            Separate business contact for TCR identity verification
          </p>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="business_contact_first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="business_contact_last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="business_contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Contact Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="business@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="business_contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Contact Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+15551234567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Stock Information (Public Companies) */}
        {isPublicCompany && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Stock Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stock_exchange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Exchange</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select exchange" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                        <SelectItem value="NYSE">NYSE</SelectItem>
                        <SelectItem value="AMEX">AMEX</SelectItem>
                        <SelectItem value="OTC">OTC Markets</SelectItem>
                        <SelectItem value="TSX">TSX (Toronto)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock_symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Symbol</FormLabel>
                    <FormControl>
                      <Input placeholder="ACME" maxLength={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {/* Alternative Business IDs */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Alternative Business Identifiers</h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="alt_business_id_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "NONE"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="DUNS">DUNS Number</SelectItem>
                      <SelectItem value="GIIN">GIIN (Global Intermediary)</SelectItem>
                      <SelectItem value="LEI">LEI (Legal Entity Identifier)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="alt_business_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alternative Business ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter ID number" maxLength={50} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Reference ID */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Tracking & Reference</h3>

          <FormField
            control={form.control}
            name="reference_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reference ID</FormLabel>
                <FormControl>
                  <Input placeholder="Your internal reference" maxLength={50} {...field} />
                </FormControl>
                <FormDescription>
                  Your internal tracking ID (optional, max 50 chars)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Updating..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
