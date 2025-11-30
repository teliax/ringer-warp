import { useState, useEffect, useMemo } from 'react';
import { userTypeService, UserType, PermissionMetadata } from '@/services/userTypeService';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertCircleIcon } from 'lucide-react';

interface EditPermissionsDialogProps {
  userType: UserType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EditPermissionsDialog({
  userType,
  open,
  onOpenChange,
  onSave,
}: EditPermissionsDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionsMetadata, setPermissionsMetadata] = useState<PermissionMetadata[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load permissions and metadata when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, userType.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metadata, permissions] = await Promise.all([
        userTypeService.getAvailablePermissions(),
        userTypeService.getPermissions(userType.id),
      ]);

      setPermissionsMetadata(metadata);
      setSelectedPermissions(permissions);

      // Set initial category
      if (metadata.length > 0 && !activeCategory) {
        const firstCategory = metadata[0].category || 'other';
        setActiveCategory(firstCategory);
      }
    } catch (error: any) {
      console.error('Failed to load permissions:', error);
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by category
  const groupedPermissions = useMemo(() => {
    const grouped: Record<string, PermissionMetadata[]> = {};
    permissionsMetadata.forEach((p) => {
      const cat = p.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    // Sort each category's permissions by display_order
    Object.keys(grouped).forEach((cat) => {
      grouped[cat].sort((a, b) => a.display_order - b.display_order);
    });

    return grouped;
  }, [permissionsMetadata]);

  // Categories with counts
  const categories = useMemo(() => {
    return Object.keys(groupedPermissions)
      .sort()
      .map((category) => ({
        id: category,
        name: formatCategoryName(category),
        count: groupedPermissions[category].length,
        selectedCount: groupedPermissions[category].filter((p) =>
          selectedPermissions.includes(p.resource_path)
        ).length,
      }));
  }, [groupedPermissions, selectedPermissions]);

  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleTogglePermission = (resourcePath: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(resourcePath)
        ? prev.filter((p) => p !== resourcePath)
        : [...prev, resourcePath]
    );
  };

  const handleSelectAll = () => {
    const categoryPermissions = groupedPermissions[activeCategory] || [];
    const nonDeprecatedPaths = categoryPermissions
      .filter((p) => !p.is_deprecated)
      .map((p) => p.resource_path);

    setSelectedPermissions((prev) => {
      const newSet = new Set([...prev, ...nonDeprecatedPaths]);
      return Array.from(newSet);
    });
  };

  const handleClearSelection = () => {
    const categoryPermissions = groupedPermissions[activeCategory] || [];
    const categoryPaths = new Set(categoryPermissions.map((p) => p.resource_path));

    setSelectedPermissions((prev) => prev.filter((p) => !categoryPaths.has(p)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await userTypeService.updatePermissions(userType.id, selectedPermissions);
      toast.success('Permissions updated successfully');
      onSave();
    } catch (error: any) {
      console.error('Failed to update permissions:', error);
      if (error.response?.status === 403) {
        toast.error('Permission denied');
      } else {
        toast.error('Failed to update permissions');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1600px] h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Manage Permissions - {userType.type_name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading permissions...</p>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Left sidebar - Categories */}
            <div className="w-56 border-r bg-gray-50 p-4">
              <ScrollArea className="h-full">
                <div className="space-y-1">
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={activeCategory === category.id ? 'secondary' : 'ghost'}
                      className="w-full justify-between h-auto py-2"
                      onClick={() => setActiveCategory(category.id)}
                    >
                      <span className="text-sm">{category.name}</span>
                      <Badge variant={activeCategory === category.id ? 'default' : 'outline'}>
                        {category.selectedCount}/{category.count}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Right content - Permissions */}
            <div className="flex-1 flex flex-col">
              <div className="p-6 pb-4 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">
                    {formatCategoryName(activeCategory)}
                  </h3>
                  <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClearSelection}>
                      Clear
                    </Button>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-2">
                  {(groupedPermissions[activeCategory] || []).map((permission) => (
                    <PermissionItem
                      key={permission.resource_path}
                      permission={permission}
                      selected={selectedPermissions.includes(permission.resource_path)}
                      onToggle={() => handleTogglePermission(permission.resource_path)}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="p-6 border-t bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {selectedPermissions.length} permission(s) selected
                  </div>
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Permissions'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PermissionItemProps {
  permission: PermissionMetadata;
  selected: boolean;
  onToggle: () => void;
}

function PermissionItem({ permission, selected, onToggle }: PermissionItemProps) {
  return (
    <div
      className={cn(
        'p-4 border rounded-lg cursor-pointer transition-colors',
        selected && 'bg-blue-50 border-blue-300',
        !selected && 'hover:border-gray-400 hover:bg-gray-50',
        permission.is_deprecated && 'opacity-60 cursor-not-allowed'
      )}
      onClick={permission.is_deprecated ? undefined : onToggle}
    >
      <div className="flex items-start space-x-3">
        <Checkbox
          checked={selected}
          disabled={permission.is_deprecated}
          className="mt-1"
          onCheckedChange={permission.is_deprecated ? undefined : onToggle}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="font-medium">
              {permission.display_name || permission.resource_path}
            </span>
            {permission.requires_wildcard && (
              <Badge variant="destructive" className="text-xs">
                Sensitive
              </Badge>
            )}
            {permission.is_deprecated && (
              <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                Deprecated
              </Badge>
            )}
          </div>
          {permission.description && (
            <p className="text-sm text-gray-600 mt-1">{permission.description}</p>
          )}
          <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
            {permission.resource_path}
          </code>
        </div>
      </div>
    </div>
  );
}
