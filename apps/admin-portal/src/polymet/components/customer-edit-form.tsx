import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrunkIPWhitelist } from "@/polymet/components/trunk-ip-whitelist";
import {
  AlertTriangleIcon,
  SaveIcon,
  XIcon,
  CheckCircleIcon,
  UserPlusIcon,
  MailIcon,
  TrashIcon,
  ShieldIcon,
} from "lucide-react";
import { type Customer, useUpdateCustomer, useCreateCustomer, type UpdateCustomerRequest, type CreateCustomerRequest } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { useHubSpotCompanySearch } from "@/hooks/useHubSpotSearch";
import { useCreateInvitation } from "@/hooks/useInvitations";
import {
  useCustomerUsers,
  useRemoveCustomerUser,
  useUpdateCustomerUserRole,
  useCustomerInvitations,
  type CustomerUserDisplay as CustomerUser
} from "@/hooks/useCustomerUsers";

interface CustomerEditFormProps {
  customer?: Customer; // Optional for create mode
  isOpen?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
}

export function CustomerEditForm({
  customer,
  isOpen = true,
  onSave,
  onCancel,
}: CustomerEditFormProps) {
  const { toast } = useToast();
  const updateCustomer = useUpdateCustomer();
  const createCustomer = useCreateCustomer();
  const isEditMode = !!customer;

  const [formData, setFormData] = useState({
    ban: customer?.ban || "",
    company_name: customer?.company_name || "",
    legal_name: customer?.legal_name || "",
    customer_type: customer?.customer_type || "POSTPAID",
    status: customer?.status || "ACTIVE",

    // Contact (flattened from JSONB)
    contact_name: customer?.contact?.name || "",
    contact_email: customer?.contact?.email || "",
    contact_phone: customer?.contact?.phone || "",

    // Address (flattened from JSONB)
    address_street: customer?.address?.line1 || "",
    address_city: customer?.address?.city || "",
    address_state: customer?.address?.state || "",
    address_zip: customer?.address?.zip || "",
    address_country: customer?.address?.country || "US",

    // Billing
    credit_limit: customer?.credit_limit?.toString() || "",
    payment_terms: customer?.payment_terms?.toString() || "30",
    billing_cycle: customer?.billing_cycle || "MONTHLY",

    // Services (from JSONB)
    voice_enabled: customer?.services?.voice?.enabled || false,
    messaging_enabled: customer?.services?.messaging?.enabled || false,
    data_enabled: customer?.services?.telecom_data?.enabled || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showHubSpotSuggestions, setShowHubSpotSuggestions] = useState(false);
  const [selectedHubSpotCompany, setSelectedHubSpotCompany] = useState<any>(null);
  const [hubspotContacts, setHubspotContacts] = useState<any[]>([]);
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const isSubmitting = updateCustomer.isPending || createCustomer.isPending;

  // Users management state and hooks
  const createInvitation = useCreateInvitation();
  const { data: users = [], isLoading: loadingUsers, refetch: refetchUsers } = useCustomerUsers(customer?.id);
  const { data: invitations = [] } = useCustomerInvitations(customer?.id);
  const removeUserMutation = useRemoveCustomerUser();
  const updateRoleMutation = useUpdateCustomerUserRole();

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<CustomerUser["role"]>("viewer");
  const [userErrors, setUserErrors] = useState<Record<string, string>>({});

  // HubSpot company search (only for create mode)
  const { companies: hubspotCompanies, loading: hubspotLoading } = useHubSpotCompanySearch(
    !isEditMode ? formData.company_name : '',
    500 // 500ms debounce
  );

  // User management functions
  const validateUserEmail = (email: string): string => {
    if (!email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
    if (users.some((u) => u.email === email)) return "User already added";
    return "";
  };

  const handleAddUser = async () => {
    const emailError = validateUserEmail(newUserEmail);
    const nameError = !newUserName.trim() ? "Name is required" : "";

    if (emailError || nameError) {
      setUserErrors({ email: emailError, name: nameError });
      return;
    }

    if (!customer?.id) {
      setUserErrors({ email: "Must save customer before adding users" });
      return;
    }

    try {
      // Send invitation via API
      await createInvitation.mutateAsync({
        customerId: customer.id,
        data: {
          email: newUserEmail,
          user_type: newUserRole,
          role: newUserRole === 'customer_admin' ? 'ADMIN' : 'USER',
          message: `You've been invited to access ${customer.company_name} on the WARP platform.`,
        },
      });

      // Refresh the users list from the API
      await refetchUsers();

      // Clear the form
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("viewer");
      setUserErrors({});

      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${newUserEmail}`,
      });
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error?.message || "Failed to send invitation";
      setUserErrors({ email: errorMsg });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!customer?.id) return;

    // Prevent removing the last admin user
    const user = users.find((u) => u.id === userId);
    if (user?.role === "customer_admin") {
      const adminCount = users.filter((u) => u.role === "customer_admin").length;
      if (adminCount <= 1) {
        toast({
          title: "Cannot Remove",
          description: "Cannot remove the last admin user",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      await removeUserMutation.mutateAsync({ customerId: customer.id, userId });
      toast({
        title: "User Removed",
        description: "User access has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error?.message || "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: CustomerUser["role"]) => {
    if (!customer?.id) return;

    // Prevent changing the last admin user
    const user = users.find((u) => u.id === userId);
    if (user?.role === "customer_admin" && newRole !== "customer_admin") {
      const adminCount = users.filter((u) => u.role === "customer_admin").length;
      if (adminCount <= 1) {
        toast({
          title: "Cannot Change Role",
          description: "Cannot change the role of the last admin user",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      await updateRoleMutation.mutateAsync({ customerId: customer.id, userId, role: newRole });
      toast({
        title: "Role Updated",
        description: "User role has been updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error?.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUserStatus = (userId: string, newStatus: CustomerUser["status"]) => {
    // Status updates would need a separate API endpoint
    // For now, this is a no-op since status is derived from is_active
    toast({
      title: "Not Implemented",
      description: "Status updates are not yet available",
      variant: "destructive",
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name?.trim()) {
      newErrors.company_name = "Company name is required";
    }

    if (!formData.contact_email?.trim()) {
      newErrors.contact_email = "Contact email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = "Invalid email format";
    }

    if (!formData.address_street?.trim()) {
      newErrors.address_street = "Street address is required";
    }

    if (!formData.address_city?.trim()) {
      newErrors.address_city = "City is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Form submitted", { formData, isEditMode });

    if (!validateForm()) {
      console.log("Validation failed", errors);
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }

    console.log("Validation passed, submitting to API...");

    try {
      if (isEditMode && customer) {
        // Update existing customer
        const updateData: UpdateCustomerRequest = {
          company_name: formData.company_name,
          legal_name: formData.legal_name || undefined,
          status: formData.status as any,
          contact: {
            name: formData.contact_name,
            email: formData.contact_email,
            phone: formData.contact_phone,
          },
          address: {
            line1: formData.address_street,
            city: formData.address_city,
            state: formData.address_state,
            zip: formData.address_zip,
            country: formData.address_country,
          },
          services: {
            voice: { enabled: formData.voice_enabled, types: [] },
            messaging: { enabled: formData.messaging_enabled, types: [] },
            telecom_data: { enabled: formData.data_enabled, types: [] },
          },
          credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : undefined,
          payment_terms: formData.payment_terms ? parseInt(formData.payment_terms) : undefined,
          billing_cycle: formData.billing_cycle,
        };

        await updateCustomer.mutateAsync({ id: customer.id, data: updateData });

        toast({
          title: "Customer Updated",
          description: `${formData.company_name} has been updated successfully.`,
        });
      } else {
        // Create new customer (BAN will be auto-generated by backend)
        const createData: CreateCustomerRequest = {
          company_name: formData.company_name,
          legal_name: formData.legal_name,
          customer_type: formData.customer_type as any,
          contact: {
            name: formData.contact_name,
            email: formData.contact_email,
            phone: formData.contact_phone,
          },
          address: {
            line1: formData.address_street,
            city: formData.address_city,
            state: formData.address_state,
            zip: formData.address_zip,
            country: formData.address_country,
          },
          services: {
            voice: { enabled: formData.voice_enabled, types: [] },
            messaging: { enabled: formData.messaging_enabled, types: [] },
            telecom_data: { enabled: formData.data_enabled, types: [] },
          },
          // If HubSpot company was selected, store its ID
          external_ids: selectedHubSpotCompany ? {
            hubspot_company_id: selectedHubSpotCompany.id,
          } : undefined,
          credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : undefined,
          payment_terms: formData.payment_terms ? parseInt(formData.payment_terms) : 30,
          billing_cycle: formData.billing_cycle,
        };

        console.log("Calling createCustomer.mutateAsync with:", createData);
        const result = await createCustomer.mutateAsync(createData);
        console.log("Customer created successfully:", result);

        toast({
          title: "Customer Created",
          description: `${formData.company_name} has been created successfully.`,
        });
      }

      onSave?.();
    } catch (error: any) {
      console.error("Form submission error:", error);
      console.error("Error response:", error.response);
      toast({
        title: isEditMode ? "Update Failed" : "Creation Failed",
        description: error.response?.data?.error?.message || error.message,
        variant: "destructive",
      });
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }

    // Show HubSpot suggestions when typing company name (create mode only)
    if (field === 'company_name' && !isEditMode) {
      setShowHubSpotSuggestions(value.length >= 2);
      setSelectedHubSpotCompany(null);
    }
  };

  const selectHubSpotCompany = async (company: any) => {
    setSelectedHubSpotCompany(company);
    setShowHubSpotSuggestions(false);

    // Pre-fill form with HubSpot data
    setFormData(prev => ({
      ...prev,
      company_name: company.name || prev.company_name,
      contact_email: company.domain || prev.contact_email,
      contact_phone: company.phone || prev.contact_phone,
      address_city: company.city || prev.address_city,
      address_state: company.state || prev.address_state,
      // Extract WARP custom properties if they exist
      credit_limit: company.properties?.warp_credit_limit?.toString() || prev.credit_limit,
    }));

    // Fetch associated contacts
    setLoadingContacts(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/v1/sync/hubspot/companies/${company.id}/contacts`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHubspotContacts(data.data.contacts || []);

        toast({
          title: "HubSpot Company Selected",
          description: `Found ${data.data.contacts?.length || 0} contacts for ${company.name}`,
        });
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const selectHubSpotContact = (contact: any) => {
    setShowContactSuggestions(false);

    // Pre-fill contact fields
    setFormData(prev => ({
      ...prev,
      contact_name: contact.name || prev.contact_name,
      contact_email: contact.email || prev.contact_email,
      contact_phone: contact.phone || prev.contact_phone,
    }));

    toast({
      title: "Contact Selected",
      description: `Pre-filled with: ${contact.name}`,
    });
  };


  if (!isOpen) return null;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{isEditMode ? "Edit Customer Account" : "Create New Customer"}</CardTitle>
          <CardDescription>
            {isEditMode ? "Update customer information, billing settings, and product configuration" : "Enter customer details to create a new account"}
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          {customer && (
            <Badge
              variant={customer.status === "ACTIVE" ? "default" : "secondary"}
            >
              {customer.status}
            </Badge>
          )}
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <XIcon className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="ip-whitelist">IP Whitelist</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 relative">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) =>
                      updateFormData("company_name", e.target.value)
                    }
                    onFocus={() => !isEditMode && formData.company_name.length >= 2 && setShowHubSpotSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowHubSpotSuggestions(false), 200)}
                    className={errors.company_name ? "border-red-500" : ""}
                    placeholder={!isEditMode ? "Start typing to search HubSpot..." : ""}
                  />
                  {errors.company_name && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 mr-1" />
                      {errors.company_name}
                    </p>
                  )}

                  {/* HubSpot Autocomplete Dropdown */}
                  {!isEditMode && showHubSpotSuggestions && formData.company_name.length >= 2 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {hubspotLoading ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          Searching HubSpot...
                        </div>
                      ) : hubspotCompanies.length > 0 ? (
                        <>
                          <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b">
                            Found {hubspotCompanies.length} companies in HubSpot
                          </div>
                          {hubspotCompanies.map((company) => (
                            <div
                              key={company.id}
                              className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                              onClick={() => selectHubSpotCompany(company)}
                            >
                              <div className="font-medium text-sm">{company.name}</div>
                              {company.domain && (
                                <div className="text-xs text-gray-500">{company.domain}</div>
                              )}
                              {company.city && company.state && (
                                <div className="text-xs text-gray-400">
                                  {company.city}, {company.state}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="p-4 text-sm text-gray-500">
                          <div className="flex items-center text-green-600">
                            <CheckCircleIcon className="w-4 h-4 mr-2" />
                            No matching companies in HubSpot - will create new
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedHubSpotCompany && (
                    <div className="flex items-center text-xs text-blue-600 mt-1">
                      <CheckCircleIcon className="w-3 h-3 mr-1" />
                      Linked to HubSpot company (ID: {selectedHubSpotCompany.id})
                    </div>
                  )}
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="contact_name">
                    Contact Name *
                    {selectedHubSpotCompany && hubspotContacts.length > 0 && (
                      <span className="ml-2 text-xs text-blue-600">
                        ({hubspotContacts.length} contacts from HubSpot)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) =>
                      updateFormData("contact_name", e.target.value)
                    }
                    onFocus={() => selectedHubSpotCompany && hubspotContacts.length > 0 && setShowContactSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowContactSuggestions(false), 200)}
                    placeholder={selectedHubSpotCompany ? "Select from HubSpot or enter manually..." : ""}
                  />

                  {/* HubSpot Contacts Dropdown */}
                  {!isEditMode && showContactSuggestions && hubspotContacts.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto">
                      <div className="p-2 text-xs text-gray-500 bg-blue-50 border-b">
                        Select a contact from {selectedHubSpotCompany.name}
                      </div>
                      {hubspotContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => selectHubSpotContact(contact)}
                        >
                          <div className="font-medium text-sm">{contact.name}</div>
                          {contact.jobtitle && (
                            <div className="text-xs text-gray-500">{contact.jobtitle}</div>
                          )}
                          {contact.email && (
                            <div className="text-xs text-gray-400">{contact.email}</div>
                          )}
                        </div>
                      ))}
                      <div className="p-2 text-xs text-gray-400 bg-gray-50 border-t text-center">
                        Or type a name to enter manually
                      </div>
                    </div>
                  )}

                  {loadingContacts && (
                    <div className="text-xs text-blue-600 mt-1">
                      Loading contacts from HubSpot...
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email Address *</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => updateFormData("contact_email", e.target.value)}
                    className={errors.contact_email ? "border-red-500" : ""}
                  />
                  {errors.contact_email && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 mr-1" />
                      {errors.contact_email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Phone Number *</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => updateFormData("contact_phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address_street">Street Address</Label>
                    <Input
                      id="address_street"
                      value={formData.address_street}
                      onChange={(e) => updateFormData("address_street", e.target.value)}
                      className={errors.address_street ? "border-red-500" : ""}
                    />
                    {errors.address_street && (
                      <p className="text-sm text-red-500">{errors.address_street}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_city">City</Label>
                    <Input
                      id="address_city"
                      value={formData.address_city}
                      onChange={(e) => updateFormData("address_city", e.target.value)}
                      className={errors.address_city ? "border-red-500" : ""}
                    />
                    {errors.address_city && (
                      <p className="text-sm text-red-500">{errors.address_city}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_state">State</Label>
                    <Input
                      id="address_state"
                      value={formData.address_state}
                      onChange={(e) => updateFormData("address_state", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_zip">ZIP Code</Label>
                    <Input
                      id="address_zip"
                      value={formData.address_zip}
                      onChange={(e) => updateFormData("address_zip", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="credit_limit">Credit Limit ($)</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    step="0.01"
                    value={formData.credit_limit}
                    onChange={(e) => updateFormData("credit_limit", e.target.value)}
                    placeholder="10000.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum credit allowed for postpaid customers
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment Terms (days)</Label>
                  <Input
                    id="payment_terms"
                    type="number"
                    value={formData.payment_terms}
                    onChange={(e) => updateFormData("payment_terms", e.target.value)}
                    placeholder="30"
                  />
                  <p className="text-xs text-muted-foreground">
                    Net payment terms (e.g., 30 = NET30)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_cycle">Billing Cycle</Label>
                  <Select
                    value={formData.billing_cycle}
                    onValueChange={(value) => updateFormData("billing_cycle", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select billing cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="ANNUAL">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Account Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => updateFormData("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="TRIAL">Trial</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="products" className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Enabled Services</h3>
                  <p className="text-sm text-muted-foreground">
                    Select which services are enabled for this customer
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="voice_enabled" className="text-base font-medium">
                          Voice Services
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Inbound/Outbound (Local, Toll-Free, International)
                        </p>
                      </div>
                      <Switch
                        id="voice_enabled"
                        checked={formData.voice_enabled}
                        onCheckedChange={(checked) =>
                          updateFormData("voice_enabled", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="messaging_enabled" className="text-base font-medium">
                          Messaging Services
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          SMS/MMS (A2P and P2P)
                        </p>
                      </div>
                      <Switch
                        id="messaging_enabled"
                        checked={formData.messaging_enabled}
                        onCheckedChange={(checked) =>
                          updateFormData("messaging_enabled", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="data_enabled" className="text-base font-medium">
                          Telecom Data Services
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          CNAM, LRN, CIC, ROR, DNO, DNC, SS
                        </p>
                      </div>
                      <Switch
                        id="data_enabled"
                        checked={formData.data_enabled}
                        onCheckedChange={(checked) =>
                          updateFormData("data_enabled", checked)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Account Users</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage users who have access to this customer account
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {users.length} {users.length === 1 ? "User" : "Users"}
                  </Badge>
                </div>

                {/* Add New User Form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <UserPlusIcon className="w-4 h-4 inline mr-2" />
                      Add New User
                    </CardTitle>
                    <CardDescription>
                      Invite a new user by email to access this account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newUserEmail">Email Address *</Label>
                        <Input
                          id="newUserEmail"
                          type="email"
                          placeholder="user@example.com"
                          value={newUserEmail}
                          onChange={(e) => {
                            setNewUserEmail(e.target.value);
                            if (userErrors.email) {
                              setUserErrors({ ...userErrors, email: "" });
                            }
                          }}
                          className={userErrors.email ? "border-red-500" : ""}
                        />
                        {userErrors.email && (
                          <p className="text-sm text-red-500 flex items-center">
                            <AlertTriangleIcon className="w-4 h-4 mr-1" />
                            {userErrors.email}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newUserName">Full Name *</Label>
                        <Input
                          id="newUserName"
                          placeholder="John Doe"
                          value={newUserName}
                          onChange={(e) => {
                            setNewUserName(e.target.value);
                            if (userErrors.name) {
                              setUserErrors({ ...userErrors, name: "" });
                            }
                          }}
                          className={userErrors.name ? "border-red-500" : ""}
                        />
                        {userErrors.name && (
                          <p className="text-sm text-red-500 flex items-center">
                            <AlertTriangleIcon className="w-4 h-4 mr-1" />
                            {userErrors.name}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newUserRole">Role</Label>
                        <Select
                          value={newUserRole}
                          onValueChange={(value) =>
                            setNewUserRole(value as CustomerUser["role"])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer_admin">
                              <div className="flex items-center">
                                <ShieldIcon className="w-4 h-4 mr-2" />
                                Customer Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="billing">Billing</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          onClick={handleAddUser}
                          className="w-full"
                          disabled={createInvitation.isPending || !customer}
                        >
                          <UserPlusIcon className="w-4 h-4 mr-2" />
                          {createInvitation.isPending ? "Sending..." : "Add User"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Existing Users List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Existing Users</h4>
                  {loadingUsers ? (
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span>Loading users...</span>
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users added yet</p>
                  ) : (
                    users.map((user) => (
                      <Card key={user.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 flex-1">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <MailIcon className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <p className="font-medium">{user.name}</p>
                                  <Badge
                                    variant={
                                      user.status === "active"
                                        ? "default"
                                        : user.status === "pending"
                                          ? "secondary"
                                          : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {user.status}
                                  </Badge>
                                  {user.role === "customer_admin" && (
                                    <Badge variant="outline" className="text-xs">
                                      <ShieldIcon className="w-3 h-3 mr-1" />
                                      Admin
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {user.email}
                                </p>
                                {user.lastLogin && (
                                  <p className="text-xs text-muted-foreground">
                                    Last login:{" "}
                                    {new Date(user.lastLogin).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Select
                                value={user.role}
                                onValueChange={(value) =>
                                  handleUpdateUserRole(user.id, value as CustomerUser["role"])
                                }
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="customer_admin">Customer Admin</SelectItem>
                                  <SelectItem value="developer">Developer</SelectItem>
                                  <SelectItem value="billing">Billing</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select
                                value={user.status}
                                onValueChange={(value) =>
                                  handleUpdateUserStatus(user.id, value as CustomerUser["status"])
                                }
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                              </Select>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveUser(user.id)}
                              >
                                <TrashIcon className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* User Roles Info */}
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2">User Role Permissions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <strong>Customer Admin:</strong> Full access to all account features and settings
                      </div>
                      <div>
                        <strong>Developer:</strong> Technical and API access only
                      </div>
                      <div>
                        <strong>Billing:</strong> Access to billing, invoices, and payment methods
                      </div>
                      <div>
                        <strong>Viewer:</strong> Read-only access to reports and data
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="ip-whitelist" className="space-y-6">
              {customer && <TrunkIPWhitelist customerBAN={customer.ban} />}
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Account Settings</h3>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Auto-payment</h4>
                      <p className="text-sm text-muted-foreground">
                        Automatically charge the default payment method
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Usage Alerts</h4>
                      <p className="text-sm text-muted-foreground">
                        Send notifications when approaching credit limit
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Marketing Communications</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive product updates and promotional offers
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end space-x-2 pt-6 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <SaveIcon className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
