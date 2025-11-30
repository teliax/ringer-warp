import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { userTypeService, UserType, PermissionMetadata } from '@/services/userTypeService';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  UsersIcon,
  AlertCircleIcon,
} from 'lucide-react';
import { EditPermissionsDialog } from '@/components/roles/EditPermissionsDialog';
import { ViewUsersDialog } from '@/components/roles/ViewUsersDialog';

export function SettingsRoles() {
  const { isSuperAdmin } = useAuth();
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [permissionsMetadata, setPermissionsMetadata] = useState<PermissionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserType, setSelectedUserType] = useState<UserType | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({ type_name: '', description: '' });
  const [formErrors, setFormErrors] = useState<{ type_name?: string }>({});

  // Fetch user types
  const fetchUserTypes = useCallback(async () => {
    setLoading(true);
    try {
      const types = await userTypeService.listUserTypes();
      setUserTypes(types);
    } catch (error: any) {
      console.error('Failed to load user types:', error);
      toast.error('Failed to load user types');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch permission metadata
  const fetchPermissionsMetadata = useCallback(async () => {
    try {
      const metadata = await userTypeService.getAvailablePermissions();
      setPermissionsMetadata(metadata);
    } catch (error: any) {
      console.error('Failed to load permissions metadata:', error);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchUserTypes();
    fetchPermissionsMetadata();
  }, [fetchUserTypes, fetchPermissionsMetadata]);

  // Create user type
  const handleCreate = async () => {
    // Validate type name
    if (!formData.type_name) {
      setFormErrors({ type_name: 'Type name is required' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.type_name)) {
      setFormErrors({ type_name: 'Only letters, numbers, and underscores allowed' });
      return;
    }

    try {
      await userTypeService.createUserType({
        type_name: formData.type_name,
        description: formData.description || undefined,
      });
      toast.success('User type created successfully');
      setCreateDialogOpen(false);
      setFormData({ type_name: '', description: '' });
      setFormErrors({});
      fetchUserTypes();
    } catch (error: any) {
      console.error('Failed to create user type:', error);
      if (error.response?.status === 409) {
        setFormErrors({ type_name: 'User type with this name already exists' });
      } else if (error.response?.status === 403) {
        toast.error('Permission denied');
      } else {
        toast.error('Failed to create user type');
      }
    }
  };

  // Update user type
  const handleUpdate = async () => {
    if (!selectedUserType) return;

    // Validate
    if (!formData.type_name) {
      setFormErrors({ type_name: 'Type name is required' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.type_name)) {
      setFormErrors({ type_name: 'Only letters, numbers, and underscores allowed' });
      return;
    }

    try {
      await userTypeService.updateUserType(selectedUserType.id, {
        type_name: formData.type_name,
        description: formData.description || undefined,
      });
      toast.success('User type updated successfully');
      setEditDialogOpen(false);
      setFormData({ type_name: '', description: '' });
      setFormErrors({});
      fetchUserTypes();
    } catch (error: any) {
      console.error('Failed to update user type:', error);
      if (error.response?.status === 409) {
        setFormErrors({ type_name: 'User type with this name already exists' });
      } else if (error.response?.status === 403) {
        toast.error('Permission denied');
      } else {
        toast.error('Failed to update user type');
      }
    }
  };

  // Delete user type
  const handleDelete = async () => {
    if (!selectedUserType) return;

    try {
      await userTypeService.deleteUserType(selectedUserType.id);
      toast.success('User type deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedUserType(null);
      fetchUserTypes();
    } catch (error: any) {
      console.error('Failed to delete user type:', error);
      if (error.response?.status === 409) {
        toast.error('Cannot delete user type with assigned users');
      } else if (error.response?.status === 403) {
        toast.error('Permission denied');
      } else {
        toast.error('Failed to delete user type');
      }
    }
  };

  // Open edit dialog
  const openEditDialog = (userType: UserType) => {
    setSelectedUserType(userType);
    setFormData({ type_name: userType.type_name, description: userType.description || '' });
    setFormErrors({});
    setEditDialogOpen(true);
  };

  // Open permissions dialog
  const openPermissionsDialog = (userType: UserType) => {
    setSelectedUserType(userType);
    setPermissionsDialogOpen(true);
  };

  // Open view users dialog
  const openUsersDialog = (userType: UserType) => {
    setSelectedUserType(userType);
    setUsersDialogOpen(true);
  };

  // Open delete confirmation
  const openDeleteDialog = (userType: UserType) => {
    setSelectedUserType(userType);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Roles & Permissions</h1>
          <p className="text-gray-600 mt-1">
            Manage user types and assign granular permissions
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add User Type
        </Button>
      </div>

      {/* User Types Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Types</CardTitle>
          <CardDescription>
            Define custom user types with specific permission sets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading user types...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Permissions</TableHead>
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userTypes.map((userType) => (
                  <TableRow key={userType.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <span>{userType.type_name}</span>
                        {userType.has_wildcard_permission && (
                          <Badge variant="destructive" className="text-xs">
                            Full Access
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {userType.description || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPermissionsDialog(userType)}
                      >
                        <ShieldIcon className="w-4 h-4 mr-1" />
                        {userType.permissions.length}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      {userType.user_count > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openUsersDialog(userType)}
                        >
                          <UsersIcon className="w-4 h-4 mr-1" />
                          {userType.user_count}
                        </Button>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(userType)}
                          disabled={userType.has_wildcard_permission}
                        >
                          <EditIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(userType)}
                          disabled={
                            userType.has_wildcard_permission || userType.user_count > 0
                          }
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Type Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User Type</DialogTitle>
            <DialogDescription>
              Define a new user type with a unique name and description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type_name">
                Type Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="type_name"
                placeholder="e.g., billing_manager, support_agent"
                value={formData.type_name}
                onChange={(e) => {
                  setFormData({ ...formData, type_name: e.target.value });
                  setFormErrors({});
                }}
                className={formErrors.type_name ? 'border-red-500' : ''}
              />
              {formErrors.type_name && (
                <p className="text-sm text-red-500">{formErrors.type_name}</p>
              )}
              <p className="text-xs text-gray-500">
                Only letters, numbers, and underscores allowed
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the purpose of this user type..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setFormData({ type_name: '', description: '' });
                setFormErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.type_name || !/^[a-zA-Z0-9_]+$/.test(formData.type_name)}
            >
              Create User Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Type Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Type</DialogTitle>
            <DialogDescription>
              Update the name and description for this user type
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_type_name">
                Type Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_type_name"
                value={formData.type_name}
                onChange={(e) => {
                  setFormData({ ...formData, type_name: e.target.value });
                  setFormErrors({});
                }}
                className={formErrors.type_name ? 'border-red-500' : ''}
              />
              {formErrors.type_name && (
                <p className="text-sm text-red-500">{formErrors.type_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setFormData({ type_name: '', description: '' });
                setFormErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.type_name || !/^[a-zA-Z0-9_]+$/.test(formData.type_name)}
            >
              Update User Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedUserType?.type_name}"?
            </DialogDescription>
          </DialogHeader>
          {selectedUserType && (
            <div className="space-y-4">
              {selectedUserType.user_count > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircleIcon className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-700">
                    This user type has {selectedUserType.user_count} assigned user(s) and cannot be
                    deleted. Please reassign or remove these users first.
                  </div>
                </div>
              )}
              {selectedUserType.has_wildcard_permission && (
                <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircleIcon className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-700">
                    This user type has wildcard permissions and cannot be deleted for security
                    reasons.
                  </div>
                </div>
              )}
              {!selectedUserType.user_count && !selectedUserType.has_wildcard_permission && (
                <p className="text-sm text-gray-600">
                  This action cannot be undone. All permissions associated with this user type will
                  be removed.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                selectedUserType?.user_count > 0 || selectedUserType?.has_wildcard_permission
              }
            >
              Delete User Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      {selectedUserType && (
        <EditPermissionsDialog
          userType={selectedUserType}
          open={permissionsDialogOpen}
          onOpenChange={setPermissionsDialogOpen}
          onSave={() => {
            fetchUserTypes();
            setPermissionsDialogOpen(false);
          }}
        />
      )}

      {/* View Users Dialog */}
      {selectedUserType && (
        <ViewUsersDialog
          userType={selectedUserType}
          open={usersDialogOpen}
          onOpenChange={setUsersDialogOpen}
        />
      )}
    </div>
  );
}
