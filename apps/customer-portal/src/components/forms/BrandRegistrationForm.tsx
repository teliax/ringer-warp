import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import type { CreateBrandRequest, EntityTypeInfo, VerticalInfo } from "@/types/messaging";
import { formatPhoneE164 } from "@/lib/utils/phone-formatter";

// Complete TCR brand schema matching API requirements
const brandSchema = z.object({
  // Core Business Info
  display_name: z.string().min(2, "Display name required").max(255, "Max 255 characters"),
  legal_name: z.string().min(2, "Legal/company name required").max(255, "Max 255 characters"),
  entity_type: z.enum(["PRIVATE_PROFIT", "PUBLIC_PROFIT", "NON_PROFIT", "GOVERNMENT", "SOLE_PROPRIETOR"], {
    required_error: "Please select an entity type",
  }),

  // Tax/Business IDs
  tax_id: z.string().optional(), // EIN - required for most entity types

  // Contact Info - Primary
  email: z.string().email("Valid email required").max(100),
  phone: z.string().regex(/^\+1[0-9]{10}$/, "Phone must be +1XXXXXXXXXX format").max(20),

  // Contact Info - Business (for PUBLIC_PROFIT)
  contact_first_name: z.string().max(100).optional(),
  contact_last_name: z.string().max(100).optional(),
  contact_email: z.string().email().max(255).optional().or(z.literal("")),
  contact_phone: z.string().max(20).optional().or(z.literal("")),

  // Address (All required)
  street: z.string().min(2, "Street address required").max(255),
  city: z.string().min(2, "City required").max(100),
  state: z.string().length(2, "2-letter state code (e.g., NY)").max(20),
  postal_code: z.string().min(5, "Postal code required").max(10),
  country: z.string().length(2, "2-letter country code").default("US"),

  // Public Company Fields
  stock_symbol: z.string().max(10).optional().or(z.literal("")),
  stock_exchange: z.string().optional().or(z.literal("")),

  // Optional Business Info
  website: z.string().url("Must be valid URL").max(255).optional().or(z.literal("")),
  vertical: z.string().optional(),
  company_name: z.string().max(255).optional(), // Can differ from legal_name

  // Alternative Business IDs
  alt_business_id: z.string().max(50).optional().or(z.literal("")),
  alt_business_id_type: z.enum(["NONE", "DUNS", "GIIN", "LEI"]).optional(),

  // Reference ID for tracking
  reference_id: z.string().max(50).optional().or(z.literal("")),
}).refine((data) => {
  // PUBLIC_PROFIT requires stock info
  if (data.entity_type === "PUBLIC_PROFIT") {
    return data.stock_symbol && data.stock_exchange && data.website;
  }
  return true;
}, {
  message: "Public companies must provide stock symbol, exchange, and website",
  path: ["entity_type"],
}).refine((data) => {
  // Most entity types require EIN/Tax ID
  if (data.entity_type !== "SOLE_PROPRIETOR") {
    return data.tax_id && data.tax_id.length > 0;
  }
  return true;
}, {
  message: "Tax ID (EIN) required for this entity type",
  path: ["tax_id"],
}).refine((data) => {
  // Business contact email required for all brands (TCR identity verification)
  return data.contact_email && data.contact_email.length > 0;
}, {
  message: "Business contact email required for TCR identity verification",
  path: ["contact_email"],
}).refine((data) => {
  // Business contact name required when email provided
  if (data.contact_email && data.contact_email.length > 0) {
    return data.contact_first_name && data.contact_last_name;
  }
  return true;
}, {
  message: "Business contact first and last name required",
  path: ["contact_first_name"],
});

type BrandFormData = z.infer<typeof brandSchema>;

interface BrandRegistrationFormProps {
  entityTypes: EntityTypeInfo[];
  verticals: VerticalInfo[];
  onSubmit: (data: CreateBrandRequest) => Promise<void>;
  onCancel: () => void;
}

export function BrandRegistrationForm({
  entityTypes,
  verticals,
  onSubmit,
  onCancel,
}: BrandRegistrationFormProps) {
  const form = useForm<BrandFormData>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      country: "US",
      entity_type: "PRIVATE_PROFIT",
      alt_business_id_type: "NONE",
      vertical: "",
      stock_exchange: "",
      stock_symbol: "",
      website: "",
      tax_id: "",
      contact_first_name: "",
      contact_last_name: "",
      contact_email: "",
      contact_phone: "",
      alt_business_id: "",
      reference_id: "",
      display_name: "",
      legal_name: "",
      email: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      postal_code: "",
      company_name: "",
    },
  });

  const selectedEntityType = form.watch("entity_type");
  const isPublicCompany = selectedEntityType === "PUBLIC_PROFIT";
  const isSoleProprietor = selectedEntityType === "SOLE_PROPRIETOR";

  const handleSubmit = async (data: BrandFormData) => {
    try {
      await onSubmit(data as CreateBrandRequest);
    } catch (error: any) {
      form.setError("root", {
        type: "manual",
        message: error.message || "Failed to submit brand registration",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {form.formState.errors.root && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {form.formState.errors.root.message}
          </div>
        )}

        {/* Business Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Business Information</h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="ACME Communications" {...field} />
                  </FormControl>
                  <FormDescription>
                    Brand/Marketing/DBA name (max 255 chars)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="legal_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Company Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="ACME Communications LLC" {...field} />
                  </FormControl>
                  <FormDescription>Official registered business name</FormDescription>
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
                  <FormLabel>Entity Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  <FormDescription>Business structure type</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vertical"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry Vertical {!isSoleProprietor && "*"}</FormLabel>
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
                  <FormLabel>EIN / Tax ID {!isSoleProprietor && "*"}</FormLabel>
                  <FormControl>
                    <Input placeholder="12-3456789" {...field} />
                  </FormControl>
                  <FormDescription>
                    US Employer Identification Number (required for most entity types)
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
                  <FormLabel>Website {isPublicCompany && "*"}</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormDescription>Company website URL (required for public companies)</FormDescription>
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
              name="contact_first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name {isSoleProprietor && "*"}</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormDescription>Contact person first name</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name {isSoleProprietor && "*"}</FormLabel>
                  <FormControl>
                    <Input placeholder="Smith" {...field} />
                  </FormControl>
                  <FormDescription>Contact person last name</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
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
                  <FormLabel>Phone *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+15551234567"
                      {...field}
                      onChange={(e) => {
                        const formatted = formatPhoneE164(e.target.value);
                        field.onChange(formatted);
                      }}
                    />
                  </FormControl>
                  <FormDescription>E.164 format: +1XXXXXXXXXX (auto-formatted)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {isSoleProprietor && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
              <p className="text-sm font-medium text-blue-900">Sole Proprietor Requirements:</p>
              <p className="text-sm text-blue-700 mt-1">
                Mobile phone and contact name are required for OTP verification.
              </p>
            </div>
          )}
        </div>

        {/* Business Contact (PUBLIC_PROFIT) */}
        {isPublicCompany && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Business Contact (Required for Public Companies)</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Contact Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="business@example.com" {...field} />
                    </FormControl>
                    <FormDescription>Separate business contact (required for PUBLIC_PROFIT)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Contact Phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+15551234567"
                        {...field}
                        onChange={(e) => {
                          const formatted = formatPhoneE164(e.target.value);
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <FormDescription>E.164 format (auto-formatted)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {/* Address Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Business Address *</h3>

          <FormField
            control={form.control}
            name="street"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address *</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main Street" {...field} />
                </FormControl>
                <FormDescription>House number and street (max 255 chars)</FormDescription>
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
                  <FormLabel>City *</FormLabel>
                  <FormControl>
                    <Input placeholder="New York" {...field} />
                  </FormControl>
                  <FormDescription>Max 100 chars</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State *</FormLabel>
                  <FormControl>
                    <Input placeholder="NY" maxLength={2} {...field} />
                  </FormControl>
                  <FormDescription>2-letter code</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postal_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code *</FormLabel>
                  <FormControl>
                    <Input placeholder="10001" {...field} />
                  </FormControl>
                  <FormDescription>Zip code</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country *</FormLabel>
                <FormControl>
                  <Input placeholder="US" maxLength={2} {...field} />
                </FormControl>
                <FormDescription>ISO-2 country code (e.g., US, CA)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Public Company Section */}
        {isPublicCompany && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Stock Information (Public Companies) *</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stock_exchange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Exchange *</FormLabel>
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
                    <FormDescription>Stock exchange listing</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock_symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Symbol *</FormLabel>
                    <FormControl>
                      <Input placeholder="ACME" maxLength={10} {...field} />
                    </FormControl>
                    <FormDescription>Trading ticker symbol</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-green-50 border border-green-200 p-4 rounded-md">
              <p className="text-sm font-medium text-green-900">Automatic Verification</p>
              <p className="text-sm text-green-700 mt-1">
                Public companies with valid stock symbols are automatically verified and receive higher trust scores (75-100).
              </p>
            </div>
          </div>
        )}

        {/* Alternative Business IDs */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Alternative Business Identifiers (Optional)</h3>

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
                  <FormDescription>Alternative business identifier type</FormDescription>
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
                  <FormDescription>DUNS, GIIN, or LEI number</FormDescription>
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
            {form.formState.isSubmitting ? "Submitting to TCR..." : "Register Brand"}
          </Button>
        </div>

        {/* What Happens Next */}
        <div className="text-sm text-muted-foreground bg-gray-50 p-4 rounded-md">
          <p className="font-medium mb-2">What happens after submission:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Brand submitted to The Campaign Registry (TCR)</li>
            <li>TCR verifies your business information (30 seconds - 5 minutes)</li>
            <li>Trust score assigned (0-100) based on entity type and verification</li>
            <li>
              {isPublicCompany && "Public companies with valid stock symbols: Trust Score 75-100 (auto-verified)"}
              {selectedEntityType === "PRIVATE_PROFIT" && "Private companies: Trust Score 25-50 (self-declared, can request vetting)"}
              {selectedEntityType === "NON_PROFIT" && "Non-profits: Trust Score 25-50 (can request vetting for higher limits)"}
              {selectedEntityType === "GOVERNMENT" && "Government: Trust Score 75-100 (auto-verified)"}
              {isSoleProprietor && "Sole Proprietor: Trust Score 10-25 (lowest tier, OTP verification required)"}
            </li>
            <li>Once approved, you can create messaging campaigns</li>
          </ol>
        </div>
      </form>
    </Form>
  );
}
