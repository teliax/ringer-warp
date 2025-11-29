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
import {
  AlertTriangleIcon,
  SaveIcon,
  XIcon,
  CheckCircleIcon,
  UserPlusIcon,
  MailIcon,
  TrashIcon,
  EditIcon,
  ShieldIcon,
} from "lucide-react";
import { type CustomerAccount } from "@/polymet/data/admin-mock-data";

interface CustomerUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user" | "billing" | "support";
  status: "active" | "pending" | "inactive";
  lastLogin?: string;
  createdDate: string;
}

interface CustomerEditFormProps {
  customer: CustomerAccount;
  isOpen?: boolean;
  onSave?: (updatedCustomer: Partial<CustomerAccount>) => void;
  onCancel?: () => void;
}

export function CustomerEditForm({
  customer,
  isOpen = true,
  onSave,
  onCancel,
}: CustomerEditFormProps) {
  const [formData, setFormData] = useState<Partial<CustomerAccount>>({
    companyName: customer.companyName,
    contactName: customer.contactName,
    email: customer.email,
    phone: customer.phone,
    address: { ...customer.address },
    status: customer.status,
    creditLimit: customer.creditLimit,
    warningThreshold: customer.warningThreshold,
    tier: customer.tier,
    products: { ...customer.products },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Users management state
  const [users, setUsers] = useState<CustomerUser[]>([
    {
      id: "user-001",
      email: customer.email,
      name: customer.contactName,
      role: "admin",
      status: "active",
      lastLogin: "2024-01-15T10:30:00Z",
      createdDate: "2023-01-15",
    },
  ]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<CustomerUser["role"]>("user");
  const [userErrors, setUserErrors] = useState<Record<string, string>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName?.trim()) {
      newErrors.companyName = "Company name is required";
    }

    if (!formData.contactName?.trim()) {
      newErrors.contactName = "Contact name is required";
    }

    if (!formData.email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.phone?.trim()) {
      newErrors.phone = "Phone number is required";
    }

    if (!formData.creditLimit || formData.creditLimit <= 0) {
      newErrors.creditLimit = "Credit limit must be greater than 0";
    }

    if (!formData.warningThreshold || formData.warningThreshold <= 0) {
      newErrors.warningThreshold = "Warning threshold must be greater than 0";
    }

    if (
      formData.warningThreshold &&
      formData.creditLimit &&
      formData.warningThreshold >= formData.creditLimit
    ) {
      newErrors.warningThreshold =
        "Warning threshold must be less than credit limit";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onSave?.(formData);
    setIsSubmitting(false);
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
  };

  const updateAddress = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      address: {
        ...prev.address!,
        [field]: value,
      },
    }));
  };

  const updateProducts = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      products: {
        ...prev.products!,
        [field]: value,
      },
    }));
  };

  // User management functions
  const validateUserEmail = (email: string) => {
    if (!email.trim()) {
      return "Email is required";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Invalid email format";
    }
    if (users.some((u) => u.email === email && u.id !== editingUserId)) {
      return "User with this email already exists";
    }
    return "";
  };

  const handleAddUser = () => {
    const emailError = validateUserEmail(newUserEmail);
    const nameError = !newUserName.trim() ? "Name is required" : "";

    if (emailError || nameError) {
      setUserErrors({
        email: emailError,
        name: nameError,
      });
      return;
    }

    const newUser: CustomerUser = {
      id: `user-${Date.now()}`,
      email: newUserEmail,
      name: newUserName,
      role: newUserRole,
      status: "pending",
      createdDate: new Date().toISOString().split("T")[0],
    };

    setUsers([...users, newUser]);
    setNewUserEmail("");
    setNewUserName("");
    setNewUserRole("user");
    setUserErrors({});
  };

  const handleRemoveUser = (userId: string) => {
    // Prevent removing the last admin user
    const user = users.find((u) => u.id === userId);
    if (user?.role === "admin") {
      const adminCount = users.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        alert("Cannot remove the last admin user");
        return;
      }
    }
    setUsers(users.filter((u) => u.id !== userId));
  };

  const handleUpdateUserRole = (
    userId: string,
    newRole: CustomerUser["role"]
  ) => {
    // Prevent changing the last admin user
    const user = users.find((u) => u.id === userId);
    if (user?.role === "admin" && newRole !== "admin") {
      const adminCount = users.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        alert("Cannot change the role of the last admin user");
        return;
      }
    }
    setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
  };

  const handleUpdateUserStatus = (
    userId: string,
    newStatus: CustomerUser["status"]
  ) => {
    setUsers(
      users.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
    );
  };

  if (!isOpen) return null;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Edit Customer Account</CardTitle>
          <CardDescription>
            Update customer information, billing settings, and product
            configuration
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Badge
            variant={customer.status === "active" ? "default" : "secondary"}
          >
            {customer.status}
          </Badge>
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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName || ""}
                    onChange={(e) =>
                      updateFormData("companyName", e.target.value)
                    }
                    className={errors.companyName ? "border-red-500" : ""}
                  />

                  {errors.companyName && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 mr-1" />

                      {errors.companyName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name *</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName || ""}
                    onChange={(e) =>
                      updateFormData("contactName", e.target.value)
                    }
                    className={errors.contactName ? "border-red-500" : ""}
                  />

                  {errors.contactName && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 mr-1" />

                      {errors.contactName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    className={errors.email ? "border-red-500" : ""}
                  />

                  {errors.email && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 mr-1" />

                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) => updateFormData("phone", e.target.value)}
                    className={errors.phone ? "border-red-500" : ""}
                  />

                  {errors.phone && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 mr-1" />

                      {errors.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      value={formData.address?.street || ""}
                      onChange={(e) => updateAddress("street", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.address?.city || ""}
                      onChange={(e) => updateAddress("city", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.address?.state || ""}
                      onChange={(e) => updateAddress("state", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={formData.address?.zip || ""}
                      onChange={(e) => updateAddress("zip", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="creditLimit">Credit Limit ($) *</Label>
                  <Input
                    id="creditLimit"
                    type="number"
                    value={formData.creditLimit || ""}
                    onChange={(e) =>
                      updateFormData(
                        "creditLimit",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className={errors.creditLimit ? "border-red-500" : ""}
                  />

                  {errors.creditLimit && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 mr-1" />

                      {errors.creditLimit}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warningThreshold">
                    Warning Threshold ($) *
                  </Label>
                  <Input
                    id="warningThreshold"
                    type="number"
                    value={formData.warningThreshold || ""}
                    onChange={(e) =>
                      updateFormData(
                        "warningThreshold",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className={errors.warningThreshold ? "border-red-500" : ""}
                  />

                  {errors.warningThreshold && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 mr-1" />

                      {errors.warningThreshold}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tier">Customer Tier</Label>
                  <Select
                    value={formData.tier || ""}
                    onValueChange={(value) => updateFormData("tier", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="platinum">Platinum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Account Status</Label>
                  <Select
                    value={formData.status || ""}
                    onValueChange={(value) => updateFormData("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="products" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="trunks">SIP Trunks</Label>
                  <Input
                    id="trunks"
                    type="number"
                    value={formData.products?.trunks || 0}
                    onChange={(e) =>
                      updateProducts("trunks", parseInt(e.target.value) || 0)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numbers">Phone Numbers</Label>
                  <Input
                    id="numbers"
                    type="number"
                    value={formData.products?.numbers || 0}
                    onChange={(e) =>
                      updateProducts("numbers", parseInt(e.target.value) || 0)
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="messaging"
                    checked={formData.products?.messaging || false}
                    onCheckedChange={(checked) =>
                      updateProducts("messaging", checked)
                    }
                  />

                  <Label htmlFor="messaging">Messaging Services</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="telecomData"
                    checked={formData.products?.telecomData || false}
                    onCheckedChange={(checked) =>
                      updateProducts("telecomData", checked)
                    }
                  />

                  <Label htmlFor="telecomData">Telecom Data Services</Label>
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
                            <SelectItem value="admin">
                              <div className="flex items-center">
                                <ShieldIcon className="w-4 h-4 mr-2" />
                                Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="billing">Billing</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          onClick={handleAddUser}
                          className="w-full"
                        >
                          <UserPlusIcon className="w-4 h-4 mr-2" />
                          Add User
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Existing Users List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Existing Users</h4>
                  {users.map((user) => (
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
                                {user.role === "admin" && (
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
                                  {new Date(
                                    user.lastLogin
                                  ).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Select
                              value={user.role}
                              onValueChange={(value) =>
                                handleUpdateUserRole(
                                  user.id,
                                  value as CustomerUser["role"]
                                )
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="billing">Billing</SelectItem>
                                <SelectItem value="support">Support</SelectItem>
                              </SelectContent>
                            </Select>

                            <Select
                              value={user.status}
                              onValueChange={(value) =>
                                handleUpdateUserStatus(
                                  user.id,
                                  value as CustomerUser["status"]
                                )
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="inactive">
                                  Inactive
                                </SelectItem>
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
                  ))}
                </div>

                {/* User Roles Info */}
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2">
                      User Role Permissions
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <strong>Admin:</strong> Full access to all account
                        features and settings
                      </div>
                      <div>
                        <strong>User:</strong> Access to basic features and
                        reporting
                      </div>
                      <div>
                        <strong>Billing:</strong> Access to billing, invoices,
                        and payment methods
                      </div>
                      <div>
                        <strong>Support:</strong> Access to support tickets and
                        documentation
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
