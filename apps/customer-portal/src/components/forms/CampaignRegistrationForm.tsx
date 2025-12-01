import { useForm, useFieldArray } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlusIcon, XIcon, InfoIcon, AlertCircleIcon } from "lucide-react";
import type { CreateCampaignRequest, Brand10DLC, UseCaseInfo } from "@/types/messaging";

// Complete TCR campaign schema matching API requirements
const campaignSchema = z.object({
  // Core Campaign Info
  brand_id: z.string().uuid("Please select a brand"),
  use_case: z.string().min(1, "Please select a use case"),
  sub_use_cases: z.array(z.string()).optional(),

  // Descriptions (40+ chars required by TCR)
  description: z.string().min(40, "Description must be at least 40 characters").max(500),
  message_flow: z.string().min(40, "Message flow must be at least 40 characters").max(500),

  // Sample Messages (1-5 required, 20-1024 chars each)
  sample_messages: z.array(
    z.string().min(20, "Each sample must be at least 20 characters").max(1024, "Max 1024 characters per sample")
  ).min(1, "At least 1 sample message required").max(5, "Maximum 5 sample messages"),

  // Subscriber Management
  subscriber_optin: z.boolean().default(false),
  subscriber_optout: z.boolean().default(true),
  subscriber_help: z.boolean().default(true),

  // Keywords
  optin_keywords: z.string().max(255).optional().or(z.literal("")),
  optin_message: z.string().max(500).optional().or(z.literal("")),
  optout_keywords: z.string().max(255).default("STOP,CANCEL,UNSUBSCRIBE"),
  optout_message: z.string().max(500).optional().or(z.literal("")),
  help_keywords: z.string().max(255).default("HELP,INFO"),
  help_message: z.string().max(500).optional().or(z.literal("")),

  // Content Attributes
  embedded_link: z.boolean().default(false),
  embedded_phone: z.boolean().default(false),
  number_pool: z.boolean().default(false),
  age_gated: z.boolean().default(false),
  direct_lending: z.boolean().default(false),

  // Affiliate Marketing (if applicable)
  affiliate_marketing: z.boolean().default(false).optional(),

  // Compliance Links
  privacy_policy_url: z.string().url("Must be valid URL").max(500).optional().or(z.literal("")),
  terms_url: z.string().url("Must be valid URL").max(500).optional().or(z.literal("")),

  // Settings
  auto_renewal: z.boolean().default(true),
  reference_id: z.string().max(50).optional().or(z.literal("")),
}).refine((data) => {
  // If subscriber_optin is true, optin keywords and message are required
  if (data.subscriber_optin) {
    return data.optin_keywords && data.optin_message;
  }
  return true;
}, {
  message: "Opt-in keywords and message required when opt-in is enabled",
  path: ["optin_keywords"],
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface CampaignRegistrationFormProps {
  brands: Brand10DLC[];
  useCases: UseCaseInfo[];
  onSubmit: (data: CreateCampaignRequest) => Promise<void>;
  onCancel: () => void;
}

export function CampaignRegistrationForm({
  brands,
  useCases,
  onSubmit,
  onCancel,
}: CampaignRegistrationFormProps) {
  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      subscriber_optout: true,
      subscriber_help: true,
      subscriber_optin: false,
      optout_keywords: "STOP,CANCEL,UNSUBSCRIBE",
      help_keywords: "HELP,INFO",
      auto_renewal: true,
      embedded_link: false,
      embedded_phone: false,
      number_pool: false,
      age_gated: false,
      direct_lending: false,
      affiliate_marketing: false,
      sample_messages: [""], // Start with one sample
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sample_messages",
  });

  const selectedUseCase = form.watch("use_case");
  const subscriberOptin = form.watch("subscriber_optin");
  const selectedBrandId = form.watch("brand_id");
  const selectedBrand = brands.find((b) => b.id === selectedBrandId);

  // Check if selected brand can create campaigns (Auth+ validation)
  const canCreateCampaigns = (brand: Brand10DLC | undefined): boolean => {
    if (!brand) return false;

    // Non-PUBLIC_PROFIT brands: Only need identity verification
    if (brand.entity_type !== "PUBLIC_PROFIT") {
      return brand.identity_status === "VERIFIED" || brand.identity_status === "VETTED_VERIFIED";
    }

    // PUBLIC_PROFIT brands: Need both identity AND Auth+ verification
    const identityOK = brand.identity_status === "VERIFIED" || brand.identity_status === "VETTED_VERIFIED";
    const authPlusOK = brand.vetting_status === "ACTIVE";

    return identityOK && authPlusOK;
  };

  const canProceed = canCreateCampaigns(selectedBrand);

  // Determine blocking reason
  let blockedReason = "";
  if (selectedBrand && !canProceed) {
    const identityOK = selectedBrand.identity_status === "VERIFIED" || selectedBrand.identity_status === "VETTED_VERIFIED";
    if (!identityOK) {
      blockedReason = "Brand must be verified before creating campaigns";
    } else if (selectedBrand.entity_type === "PUBLIC_PROFIT") {
      blockedReason = "Auth+ verification required for PUBLIC_PROFIT brands";
    }
  }

  const handleSubmit = async (data: CampaignFormData) => {
    try {
      // Filter out empty sample messages
      const cleanedData = {
        ...data,
        sample_messages: data.sample_messages.filter((msg) => msg.trim().length > 0),
      };
      await onSubmit(cleanedData as CreateCampaignRequest);
    } catch (error: any) {
      form.setError("root", {
        type: "manual",
        message: error.message || "Failed to submit campaign registration",
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

        {/* Auth+ Validation Alert */}
        {selectedBrand && !canProceed && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Cannot Create Campaign</AlertTitle>
            <AlertDescription>
              {blockedReason}
              <br />
              <span className="text-sm">
                Complete brand verification requirements before creating campaigns.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Campaign Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Campaign Details</h3>

          <FormField
            control={form.control}
            name="brand_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an approved brand" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {brands.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No approved brands available. Register a brand first.
                      </div>
                    ) : (
                      brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.display_name}
                          {brand.trust_score && ` (Trust: ${brand.trust_score})`}
                          {brand.status && ` - ${brand.status}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Select the brand this campaign belongs to
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedBrand && selectedBrand.trust_score && (
            <div className={`p-4 rounded-md border ${
              selectedBrand.trust_score >= 75 ? 'bg-green-50 border-green-200' :
              selectedBrand.trust_score >= 50 ? 'bg-yellow-50 border-yellow-200' :
              'bg-orange-50 border-orange-200'
            }`}>
              <p className="text-sm font-medium">Brand Trust Score: {selectedBrand.trust_score}</p>
              <p className="text-sm mt-1">
                {selectedBrand.trust_score >= 75 && "High throughput: ~15 msg/sec, 40,000/day"}
                {selectedBrand.trust_score >= 50 && selectedBrand.trust_score < 75 && "Medium throughput: ~2 msg/sec, 6,000/day"}
                {selectedBrand.trust_score < 50 && "Limited throughput: ~1 msg/sec, 2,000/day. Consider external vetting."}
              </p>
            </div>
          )}

          <FormField
            control={form.control}
            name="use_case"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Use Case *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select campaign use case" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {useCases.map((useCase) => (
                      <SelectItem key={useCase.code} value={useCase.code}>
                        {useCase.display_name} ({useCase.difficulty})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Primary purpose of your messaging campaign
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign Description *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the purpose and goals of this campaign... (minimum 40 characters)"
                    rows={3}
                    maxLength={500}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Explain what this campaign is for ({field.value?.length || 0}/40 minimum, 500 max)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message_flow"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message Flow / User Journey *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Explain how users will interact with your messages... (minimum 40 characters)"
                    rows={3}
                    maxLength={500}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Describe the consumer interaction workflow ({field.value?.length || 0}/40 minimum, 500 max)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Sample Messages Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-semibold">Sample Messages *</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append("")}
              disabled={fields.length >= 5}
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Sample ({fields.length}/5)
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Provide 1-5 examples of actual messages you'll send. Each must be 20-1024 characters.
          </p>

          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start space-x-2">
              <FormField
                control={form.control}
                name={`sample_messages.${index}`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Sample Message {index + 1}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={`Example: "ACME Alert: Your password was changed. Contact us at 1-800-555-0123 if this wasn't you. Reply STOP to unsubscribe."`}
                        rows={3}
                        maxLength={1024}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{field.value?.length || 0}/20 minimum, 1024 max</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="mt-8"
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Subscriber Management */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Subscriber Management *</h3>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="subscriber_optin"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Require Opt-In</FormLabel>
                    <FormDescription>Users must opt-in before messages</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subscriber_optout"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-red-50">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Support Opt-Out * (Required)</FormLabel>
                    <FormDescription>STOP keywords (required by law)</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subscriber_help"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-blue-50">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Support HELP * (Required)</FormLabel>
                    <FormDescription>HELP keywords (required)</FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          {/* Opt-In Configuration */}
          {subscriberOptin && (
            <div className="space-y-4 bg-blue-50 p-4 rounded-md border border-blue-200">
              <p className="text-sm font-medium text-blue-900">Opt-In Configuration (Required when enabled)</p>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="optin_keywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opt-In Keywords *</FormLabel>
                      <FormControl>
                        <Input placeholder="START,YES,JOIN" maxLength={255} {...field} />
                      </FormControl>
                      <FormDescription>Comma-separated keywords</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="optin_message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opt-In Confirmation Message *</FormLabel>
                      <FormControl>
                        <Textarea placeholder="You've subscribed to ACME alerts..." rows={2} maxLength={500} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {/* Opt-Out and Help Keywords */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="optout_keywords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opt-Out Keywords *</FormLabel>
                  <FormControl>
                    <Input placeholder="STOP,CANCEL,UNSUBSCRIBE,END" maxLength={255} {...field} />
                  </FormControl>
                  <FormDescription>Comma-separated (STOP required by law)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="help_keywords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Help Keywords *</FormLabel>
                  <FormControl>
                    <Input placeholder="HELP,INFO,SUPPORT" maxLength={255} {...field} />
                  </FormControl>
                  <FormDescription>Comma-separated help keywords</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="optout_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opt-Out Confirmation Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="You've been unsubscribed from ACME alerts. No more messages will be sent."
                      rows={2}
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Sent when user opts out (optional)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="help_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Help Response Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="ACME Alerts: Text STOP to unsubscribe. Contact support@acme.com or 1-800-555-0123."
                      rows={2}
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Sent when user texts HELP (optional)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Content Attributes */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Content Attributes</h3>
          <p className="text-sm text-muted-foreground">
            Indicate what type of content your messages will contain
          </p>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="embedded_link"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Contains Links/URLs</FormLabel>
                    <FormDescription>Messages will include clickable links</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="embedded_phone"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Contains Phone Numbers</FormLabel>
                    <FormDescription>Messages include phone numbers</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="number_pool"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Number Pool (50+)</FormLabel>
                    <FormDescription>Using 50 or more phone numbers</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="age_gated"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Age-Gated Content (18+)</FormLabel>
                    <FormDescription>Restricted to adults only</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="direct_lending"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Direct Lending/Loans</FormLabel>
                    <FormDescription>Financial lending products</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="affiliate_marketing"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Affiliate Marketing</FormLabel>
                    <FormDescription>Promotes third-party products</FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Compliance & Legal */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Compliance & Legal Links</h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="privacy_policy_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Privacy Policy URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/privacy" maxLength={500} {...field} />
                  </FormControl>
                  <FormDescription>Link to your privacy policy</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terms_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms & Conditions URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/terms" maxLength={500} {...field} />
                  </FormControl>
                  <FormDescription>Link to your terms of service</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Campaign Settings</h3>

          <FormField
            control={form.control}
            name="auto_renewal"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Auto-Renewal</FormLabel>
                  <FormDescription>
                    Automatically renew campaign annually (recommended)
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reference_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reference ID (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Your internal tracking ID" maxLength={50} {...field} />
                </FormControl>
                <FormDescription>
                  Internal reference for your records (max 50 chars)
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
          <Button type="submit" disabled={form.formState.isSubmitting || !canProceed}>
            {form.formState.isSubmitting ? "Submitting to TCR..." : "Create Campaign"}
          </Button>
        </div>

        {/* Campaign Approval Process */}
        <div className="text-sm text-muted-foreground bg-gray-50 p-4 rounded-md">
          <p className="font-medium mb-2 flex items-center gap-2">
            <InfoIcon className="w-4 h-4" />
            Campaign Approval Process:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Campaign submitted to The Campaign Registry (TCR)</li>
            <li>TCR reviews campaign details, samples, and compliance</li>
            <li>Each carrier (T-Mobile, AT&T, Verizon) reviews independently</li>
            <li>
              Approval time varies by use case:
              <ul className="ml-6 mt-1 list-disc">
                <li>2FA, Account Alerts: 1-2 days (Easy approval)</li>
                <li>Marketing, Charity: 3-5 days (Medium approval)</li>
                <li>Political, Sweepstakes: 5-7+ days (Hard approval)</li>
              </ul>
            </li>
            <li>Once approved by all carriers, you can assign phone numbers and start messaging</li>
            <li>Throughput limits based on brand trust score and use case</li>
          </ol>
        </div>
      </form>
    </Form>
  );
}
