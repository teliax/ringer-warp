import { useState, useCallback, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  PlusIcon,
  XIcon,
  InfoIcon,
  AlertCircleIcon,
  BrainIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIChatPanel } from '@/components/ai';
import { useAIChat } from '@/hooks/useAIChat';
import type {
  CreateCampaignRequest,
  Brand10DLC,
  UseCaseInfo,
} from '@/types/messaging';

// Campaign schema
const campaignSchema = z
  .object({
    brand_id: z.string().uuid('Please select a brand'),
    use_case: z.string().min(1, 'Please select a use case'),
    sub_use_cases: z.array(z.string()).optional(),
    description: z
      .string()
      .min(40, 'Description must be at least 40 characters')
      .max(500),
    message_flow: z
      .string()
      .min(40, 'Message flow must be at least 40 characters')
      .max(500),
    sample_messages: z
      .array(
        z
          .string()
          .min(20, 'Each sample must be at least 20 characters')
          .max(1024, 'Max 1024 characters per sample')
      )
      .min(1, 'At least 1 sample message required')
      .max(5, 'Maximum 5 sample messages'),
    subscriber_optin: z.boolean().default(false),
    subscriber_optout: z.boolean().default(true),
    subscriber_help: z.boolean().default(true),
    optin_keywords: z.string().max(255).optional().or(z.literal('')),
    optin_message: z.string().max(500).optional().or(z.literal('')),
    optout_keywords: z.string().max(255).default('STOP,CANCEL,UNSUBSCRIBE'),
    optout_message: z.string().max(500).optional().or(z.literal('')),
    help_keywords: z.string().max(255).default('HELP,INFO'),
    help_message: z.string().max(500).optional().or(z.literal('')),
    embedded_link: z.boolean().default(false),
    embedded_phone: z.boolean().default(false),
    number_pool: z.boolean().default(false),
    age_gated: z.boolean().default(false),
    direct_lending: z.boolean().default(false),
    affiliate_marketing: z.boolean().default(false).optional(),
    privacy_policy_url: z
      .string()
      .url('Must be valid URL')
      .max(500)
      .optional()
      .or(z.literal('')),
    terms_url: z
      .string()
      .url('Must be valid URL')
      .max(500)
      .optional()
      .or(z.literal('')),
    auto_renewal: z.boolean().default(true),
    reference_id: z.string().max(50).optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.subscriber_optin) {
        return data.optin_keywords && data.optin_message;
      }
      return true;
    },
    {
      message: 'Opt-in keywords and message required when opt-in is enabled',
      path: ['optin_keywords'],
    }
  );

type CampaignFormData = z.infer<typeof campaignSchema>;

interface CampaignRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brands: Brand10DLC[];
  useCases: UseCaseInfo[];
  onSubmit: (data: CreateCampaignRequest) => Promise<void>;
  userName?: string;
}

// Field mapping from AI assistant field names to form field names
const FIELD_MAP: Record<string, string> = {
  brand_id: 'brand_id',
  use_case: 'use_case',
  description: 'description',
  message_flow: 'message_flow',
  'sample_messages.0': 'sample_messages.0',
  'sample_messages.1': 'sample_messages.1',
  'sample_messages.2': 'sample_messages.2',
  'sample_messages.3': 'sample_messages.3',
  'sample_messages.4': 'sample_messages.4',
  subscriber_optin: 'subscriber_optin',
  optin_keywords: 'optin_keywords',
  optin_message: 'optin_message',
  optout_keywords: 'optout_keywords',
  optout_message: 'optout_message',
  help_keywords: 'help_keywords',
  help_message: 'help_message',
  embedded_link: 'embedded_link',
  embedded_phone: 'embedded_phone',
  number_pool: 'number_pool',
  age_gated: 'age_gated',
  direct_lending: 'direct_lending',
  affiliate_marketing: 'affiliate_marketing',
  privacy_policy_url: 'privacy_policy_url',
  terms_url: 'terms_url',
};

export function CampaignRegistrationDialog({
  open,
  onOpenChange,
  brands,
  useCases,
  onSubmit,
  userName,
}: CampaignRegistrationDialogProps) {
  const [showAssistant, setShowAssistant] = useState(true);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      subscriber_optout: true,
      subscriber_help: true,
      subscriber_optin: false,
      optout_keywords: 'STOP,CANCEL,UNSUBSCRIBE',
      help_keywords: 'HELP,INFO',
      auto_renewal: true,
      embedded_link: false,
      embedded_phone: false,
      number_pool: false,
      age_gated: false,
      direct_lending: false,
      affiliate_marketing: false,
      sample_messages: [''],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'sample_messages' as never,
  });

  // Form field updater for AI assistant
  const handleFormUpdate = useCallback(
    (field: string, value: unknown) => {
      const mappedField = FIELD_MAP[field] || field;

      // Handle sample messages array expansion
      if (field.startsWith('sample_messages.')) {
        const index = parseInt(field.split('.')[1], 10);
        const currentFields = form.getValues('sample_messages');
        // Expand array if needed
        while (currentFields.length <= index) {
          append('');
        }
      }

      form.setValue(mappedField as keyof CampaignFormData, value as never, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [form, append]
  );

  // Build context for AI assistant
  const formValues = form.watch();
  const selectedBrand = brands.find((b) => b.id === formValues.brand_id);
  const selectedUseCase = useCases.find((u) => u.code === formValues.use_case);

  const aiContext = {
    brands: brands.map((b) => ({
      id: b.id,
      name: b.display_name,
      entity_type: b.entity_type,
      trust_score: b.trust_score,
    })),
    useCases: useCases.map((u) => ({
      code: u.code,
      name: u.display_name,
      difficulty: u.difficulty,
    })),
    currentFormValues: formValues,
    selectedBrand: selectedBrand
      ? {
          name: selectedBrand.display_name,
          entity_type: selectedBrand.entity_type,
          trust_score: selectedBrand.trust_score,
        }
      : null,
    selectedUseCase: selectedUseCase
      ? {
          code: selectedUseCase.code,
          name: selectedUseCase.display_name,
        }
      : null,
  };

  const {
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    clearChat,
    completeConversation,
  } = useAIChat({
    agentType: 'campaign',
    context: aiContext,
    onFormUpdate: handleFormUpdate,
    initialMessage:
      "Hi! I'm your Campaign Registration Assistant. I can help you fill out this form correctly for TCR 10DLC compliance. Tell me about the messaging campaign you want to create, or ask me any questions about the requirements.",
  });

  // Reset form and chat when dialog opens
  useEffect(() => {
    if (open) {
      form.reset();
      clearChat();
    }
  }, [open, form, clearChat]);

  const subscriberOptin = form.watch('subscriber_optin');

  // Check if brand can create campaigns
  const canCreateCampaigns = (brand: Brand10DLC | undefined): boolean => {
    if (!brand) return false;
    if (brand.entity_type !== 'PUBLIC_PROFIT') {
      return (
        brand.identity_status === 'VERIFIED' ||
        brand.identity_status === 'VETTED_VERIFIED'
      );
    }
    const identityOK =
      brand.identity_status === 'VERIFIED' ||
      brand.identity_status === 'VETTED_VERIFIED';
    const authPlusOK = brand.vetting_status === 'ACTIVE';
    return identityOK && authPlusOK;
  };

  const canProceed = canCreateCampaigns(selectedBrand);

  let blockedReason = '';
  if (selectedBrand && !canProceed) {
    const identityOK =
      selectedBrand.identity_status === 'VERIFIED' ||
      selectedBrand.identity_status === 'VETTED_VERIFIED';
    if (!identityOK) {
      blockedReason = 'Brand must be verified before creating campaigns';
    } else if (selectedBrand.entity_type === 'PUBLIC_PROFIT') {
      blockedReason = 'Auth+ verification required for PUBLIC_PROFIT brands';
    }
  }

  const handleSubmit = async (data: CampaignFormData) => {
    try {
      const cleanedData = {
        ...data,
        sample_messages: data.sample_messages.filter(
          (msg) => msg.trim().length > 0
        ),
      };

      // Complete the AI conversation with final form data
      if (sessionId) {
        await completeConversation(cleanedData);
      }

      await onSubmit(cleanedData as CreateCampaignRequest);
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to submit campaign registration';
      form.setError('root', {
        type: 'manual',
        message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[90vh] p-0 gap-0',
          showAssistant ? 'max-w-[1400px]' : 'max-w-4xl'
        )}
      >
        <div className="flex h-[85vh]">
          {/* Form Panel (70% or 100%) */}
          <div
            className={cn(
              'flex flex-col',
              showAssistant ? 'w-[70%]' : 'w-full'
            )}
          >
            <DialogHeader className="px-6 py-4 border-b flex-row items-center justify-between space-y-0">
              <DialogTitle className="text-xl">
                Register New Campaign
              </DialogTitle>
              <Button
                variant={showAssistant ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowAssistant(!showAssistant)}
                className="gap-2"
              >
                <BrainIcon className="h-4 w-4" />
                {showAssistant ? (
                  <>
                    <PanelRightCloseIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Hide Assistant</span>
                  </>
                ) : (
                  <>
                    <PanelRightOpenIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Show Assistant</span>
                  </>
                )}
              </Button>
            </DialogHeader>

            <ScrollArea className="flex-1 px-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-6 py-4"
                >
                  {form.formState.errors.root && (
                    <Alert variant="destructive">
                      <AlertCircleIcon className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>
                        {form.formState.errors.root.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {selectedBrand && !canProceed && (
                    <Alert variant="destructive">
                      <AlertCircleIcon className="h-4 w-4" />
                      <AlertTitle>Cannot Create Campaign</AlertTitle>
                      <AlertDescription>{blockedReason}</AlertDescription>
                    </Alert>
                  )}

                  {/* Campaign Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">
                      Campaign Details
                    </h3>

                    <FormField
                      control={form.control}
                      name="brand_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an approved brand" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {brands.map((brand) => (
                                <SelectItem key={brand.id} value={brand.id}>
                                  {brand.display_name}
                                  {typeof brand.trust_score === 'number' &&
                                    ` (Trust: ${brand.trust_score})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select the brand this campaign belongs to
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedBrand &&
                      typeof selectedBrand.trust_score === 'number' && (
                        <div
                          className={cn(
                            'p-3 rounded-md border text-sm',
                            selectedBrand.trust_score >= 75
                              ? 'bg-green-50 border-green-200'
                              : selectedBrand.trust_score >= 50
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-orange-50 border-orange-200'
                          )}
                        >
                          <p className="font-medium">
                            Trust Score: {selectedBrand.trust_score}
                          </p>
                          <p className="text-muted-foreground">
                            {selectedBrand.trust_score >= 75 &&
                              'High throughput: ~15 msg/sec'}
                            {selectedBrand.trust_score >= 50 &&
                              selectedBrand.trust_score < 75 &&
                              'Medium throughput: ~2 msg/sec'}
                            {selectedBrand.trust_score < 50 &&
                              'Limited throughput: ~1 msg/sec'}
                          </p>
                        </div>
                      )}

                    <FormField
                      control={form.control}
                      name="use_case"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Use Case *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select campaign use case" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {useCases.map((useCase) => (
                                <SelectItem
                                  key={useCase.code}
                                  value={useCase.code}
                                >
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
                            {field.value?.length || 0}/40 minimum, 500 max
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
                            {field.value?.length || 0}/40 minimum, 500 max
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Sample Messages */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-lg font-semibold">
                        Sample Messages *
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append('')}
                        disabled={fields.length >= 5}
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Add ({fields.length}/5)
                      </Button>
                    </div>

                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-2">
                        <FormField
                          control={form.control}
                          name={`sample_messages.${index}`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>Sample {index + 1}</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Example message..."
                                  rows={2}
                                  maxLength={1024}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {field.value?.length || 0}/20 min, 1024 max
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
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
                    <h3 className="text-lg font-semibold border-b pb-2">
                      Subscriber Management
                    </h3>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="subscriber_optin"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">
                                Require Opt-In
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="subscriber_optout"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-muted/50">
                            <FormControl>
                              <Checkbox checked={field.value} disabled />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">
                                Opt-Out (Required)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="subscriber_help"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-muted/50">
                            <FormControl>
                              <Checkbox checked={field.value} disabled />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">
                                HELP (Required)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    {subscriberOptin && (
                      <div className="space-y-4 bg-blue-50 p-4 rounded-md border border-blue-200">
                        <p className="text-sm font-medium text-blue-900">
                          Opt-In Configuration
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="optin_keywords"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Keywords *</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="START,YES,JOIN"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="optin_message"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirmation Message *</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="You've subscribed..."
                                    rows={2}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="optout_keywords"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Opt-Out Keywords</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="help_keywords"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Help Keywords</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
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
                            <FormLabel>Opt-Out Message</FormLabel>
                            <FormControl>
                              <Textarea rows={2} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="help_message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Help Message</FormLabel>
                            <FormControl>
                              <Textarea rows={2} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Content Attributes */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">
                      Content Attributes
                    </h3>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {
                          name: 'embedded_link' as const,
                          label: 'Contains Links',
                        },
                        {
                          name: 'embedded_phone' as const,
                          label: 'Contains Phone Numbers',
                        },
                        {
                          name: 'number_pool' as const,
                          label: 'Number Pool (50+)',
                        },
                        {
                          name: 'age_gated' as const,
                          label: 'Age-Gated (18+)',
                        },
                        {
                          name: 'direct_lending' as const,
                          label: 'Direct Lending',
                        },
                        {
                          name: 'affiliate_marketing' as const,
                          label: 'Affiliate Marketing',
                        },
                      ].map((attr) => (
                        <FormField
                          key={attr.name}
                          control={form.control}
                          name={attr.name}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                {attr.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Compliance Links */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">
                      Compliance Links
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="privacy_policy_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Privacy Policy URL</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://example.com/privacy"
                                {...field}
                              />
                            </FormControl>
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
                              <Input
                                placeholder="https://example.com/terms"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
                    <p className="font-medium mb-2 flex items-center gap-2">
                      <InfoIcon className="w-4 h-4" />
                      Campaign Approval Process
                    </p>
                    <p>
                      After submission, TCR and carriers will review your
                      campaign. Approval typically takes 1-7 days depending on
                      the use case.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background py-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={form.formState.isSubmitting || !canProceed}
                    >
                      {form.formState.isSubmitting
                        ? 'Submitting...'
                        : 'Create Campaign'}
                    </Button>
                  </div>
                </form>
              </Form>
            </ScrollArea>
          </div>

          {/* AI Assistant Panel (30%) */}
          {showAssistant && (
            <div className="w-[30%] border-l">
              <AIChatPanel
                messages={messages}
                isLoading={isLoading}
                error={error}
                onSendMessage={sendMessage}
                onClearChat={clearChat}
                onClose={() => setShowAssistant(false)}
                userName={userName}
                title="Campaign Assistant"
                inputPlaceholder="Ask about your campaign..."
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
