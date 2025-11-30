import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBanReload } from "@/hooks/useBanReload";
import { userManagementService, User as BackendUser } from "@/services/userManagementService";
import { userTypeService, UserType } from "@/services/userTypeService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  UsersIcon,
  PlusIcon,
  MailIcon,
  EditIcon,
  TrashIcon,
  ShieldIcon,
  CreditCardIcon,
  SettingsIcon,
  CheckCircleIcon,
  ClockIcon,
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "pending" | "inactive";
  lastLogin: string;
  avatar?: string;
}

const mockUsers: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@ringer.tel",
    role: "admin",
    status: "active",
    lastLogin: "2024-01-15 10:30 AM",
    avatar: "https://github.com/yusufhilmi.png",
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah@ringer.tel",
    role: "billing",
    status: "active",
    lastLogin: "2024-01-14 3:45 PM",
    avatar: "https://github.com/kdrnp.png",
  },
  {
    id: "3",
    name: "Mike Chen",
    email: "mike@ringer.tel",
    role: "system",
    status: "active",
    lastLogin: "2024-01-13 9:15 AM",
    avatar: "https://github.com/yahyabedirhan.png",
  },
  {
    id: "4",
    name: "Lisa Williams",
    email: "lisa@ringer.tel",
    role: "user",
    status: "pending",
    lastLogin: "Never",
  },
];

const userRoles = [
  {
    value: "admin",
    label: "Admin User",
    description: "Full access to all features and settings",
    icon: ShieldIcon,
    color: "bg-red-500",
  },
  {
    value: "billing",
    label: "Billing User",
    description: "Access to billing, invoices, and payment settings",
    icon: CreditCardIcon,
    color: "bg-[#FBAD18]",
  },
  {
    value: "system",
    label: "System Access",
    description: "Access to trunks, numbers, and technical settings",
    icon: SettingsIcon,
    color: "bg-[#58C5C7]",
  },
  {
    value: "user",
    label: "Standard User",
    description: "Basic access to view reports and dashboards",
    icon: UsersIcon,
    color: "bg-gray-500",
  },
];

export function SettingsUsers() {
  const { activeBan, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "",
    user_type: "customer_admin",
    name: "",
  });

  // Fetch users for the active BAN
  const fetchUsers = useCallback(async () => {
    if (!activeBan) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await userManagementService.listUsers(activeBan.customer_id);
      setUsers(data);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      if (error.response?.status !== 403) {
        toast.error('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  }, [activeBan]);

  // Fetch available user types
  const fetchUserTypes = useCallback(async () => {
    try {
      const types = await userTypeService.listUserTypes();
      setUserTypes(types);
    } catch (error: any) {
      console.error('Failed to load user types:', error);
      // Don't show error toast - this is not critical
    }
  }, []);

  // Load users on mount and when activeBan changes
  useEffect(() => {
    fetchUsers();
    fetchUserTypes();
  }, [fetchUsers, fetchUserTypes]);

  // Reload users when BAN switches
  useBanReload(fetchUsers);

  const handleInviteUser = async () => {
    if (!activeBan) {
      toast.error('No customer selected');
      return;
    }

    if (inviteForm.email && inviteForm.role && inviteForm.user_type) {
      try {
        await userManagementService.inviteUser(activeBan.customer_id, {
          email: inviteForm.email,
          user_type: inviteForm.user_type,
          role: inviteForm.role as 'USER' | 'ADMIN' | 'OWNER',
          message: `Welcome to ${activeBan.company_name}`,
        });

        toast.success('User invitation sent successfully');
        setIsInviteOpen(false);
        setInviteForm({ email: "", role: "", user_type: "customer_admin", name: "" });
        fetchUsers();
      } catch (error: any) {
        console.error('Failed to invite user:', error);
        if (error.response?.status === 403) {
          toast.error('Permission denied - you cannot invite users');
        } else {
          toast.error('Failed to send invitation');
        }
      }
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!activeBan) return;

    try {
      await userManagementService.updateUserRole(
        activeBan.customer_id,
        userId,
        newRole as 'USER' | 'ADMIN' | 'OWNER'
      );
      toast.success('User role updated');
      fetchUsers();
    } catch (error: any) {
      console.error('Failed to update role:', error);
      if (error.response?.status === 403) {
        toast.error('Permission denied');
      } else {
        toast.error('Failed to update user role');
      }
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!activeBan) return;
    if (!confirm('Are you sure you want to remove this user?')) return;

    try {
      await userManagementService.removeUser(activeBan.customer_id, userId);
      toast.success('User removed');
      fetchUsers();
    } catch (error: any) {
      console.error('Failed to remove user:', error);
      if (error.response?.status === 403) {
        toast.error('Permission denied');
      } else {
        toast.error('Failed to remove user');
      }
    }
  };

  // Show empty state if no BAN is selected
  if (!activeBan) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold">Select a Customer</h3>
            <p className="mt-2 text-gray-600">
              Choose a customer account from the dropdown above to manage users.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleInviteUserOld_DISABLED = () => {
    // This old function is disabled - backend integration is now used
    if (inviteForm.email && inviteForm.role && inviteForm.name) {
      const newUser: User = {
        id: Date.now().toString(),
        name: inviteForm.name,
        email: inviteForm.email,
        role: inviteForm.role,
        status: "pending",
        lastLogin: "Never",
      };
      setUsers([...users, newUser]);
      setInviteForm({ email: "", role: "", name: "" });
      setIsInviteOpen(false);
    }
  };

  const getRoleInfo = (roleValue: string) => {
    return userRoles.find((role) => role.value === roleValue) || userRoles[3];
  };

  const getStatusBadge = (status: User["status"]) => {
    const variants = {
      active: { variant: "default" as const, color: "bg-green-500" },
      pending: { variant: "secondary" as const, color: "bg-[#FBAD18]" },
      inactive: { variant: "outline" as const, color: "bg-gray-500" },
    };
    return variants[status];
  };

  const activeUsers = users.filter((user) => user.status === "active").length;
  const pendingUsers = users.filter((user) => user.status === "pending").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#231F20]">User Management</h1>
          <p className="text-gray-600">
            Manage team members, assign roles, and control access permissions
          </p>
        </div>

        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
              <PlusIcon className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation to a new team member and assign their role
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, name: e.target.value })
                  }
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  placeholder="user@company.com"
                />
              </div>
              <div>
                <Label htmlFor="role">User Role</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) =>
                    setInviteForm({ ...inviteForm, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {userRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center space-x-2">
                          <role.icon className="h-4 w-4" />

                          <span>{role.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleInviteUser}
                className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">Across all roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Invites
            </CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingUsers}</div>
            <p className="text-xs text-muted-foreground">Awaiting acceptance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
            <ShieldIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.role === "admin").length}
            </div>
            <p className="text-xs text-muted-foreground">Full access</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage user roles and permissions for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const roleInfo = getRoleInfo(user.role);
                  const statusInfo = getStatusBadge(user.status);

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            {user.avatar ? (
                              <AvatarImage src={user.avatar} />
                            ) : null}
                            <AvatarFallback className="bg-[#58C5C7] text-white">
                              {user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-2 h-2 rounded-full ${roleInfo.color}`}
                          ></div>
                          <span className="font-medium">{roleInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusInfo.variant}
                          className={
                            user.status === "active"
                              ? "bg-green-500 hover:bg-green-500/80"
                              : user.status === "pending"
                                ? "bg-[#FBAD18] hover:bg-[#FBAD18]/80 text-white"
                                : ""
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.lastLogin}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="ghost" size="sm">
                            <EditIcon className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MailIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>User Roles & Permissions</CardTitle>
                <CardDescription>
                  Available roles and their access levels
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings/roles')}
              >
                <ShieldIcon className="h-4 w-4 mr-2" />
                Manage Roles
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {userTypes.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <p className="text-sm">Loading user types...</p>
              </div>
            ) : (
              userTypes.slice(0, 4).map((userType) => {
                // Map to icon colors based on type name
                const iconColor = userType.has_wildcard_permission
                  ? 'bg-red-500'
                  : userType.type_name.includes('admin')
                  ? 'bg-orange-500'
                  : userType.type_name.includes('billing')
                  ? 'bg-yellow-500'
                  : userType.type_name.includes('developer')
                  ? 'bg-blue-500'
                  : 'bg-gray-500';

                return (
                  <div key={userType.id} className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${iconColor}`}>
                      <ShieldIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {userType.type_name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </div>
                      <div className="text-sm text-gray-500">
                        {userType.description || `${userType.permissions.length} permissions`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {userTypes.length > 4 && (
              <div className="text-center pt-2">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => navigate('/settings/roles')}
                >
                  View all {userTypes.length} roles →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>User security and access controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                Two-Factor Authentication
              </span>
              <Badge className="bg-green-500 hover:bg-green-500/80">
                Enabled
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Session Timeout</span>
              <span className="text-sm">8 hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Password Policy</span>
              <Badge variant="outline">Strong</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">IP Restrictions</span>
              <Badge variant="secondary">Optional</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
