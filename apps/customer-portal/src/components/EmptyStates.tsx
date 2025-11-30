import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  UserIcon,
  BuildingIcon,
  InboxIcon,
  AlertCircleIcon,
} from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-16 text-center">
        {icon && <div className="mx-auto mb-4">{icon}</div>}
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
        {action && (
          <Button className="mt-6" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface NoBanSelectedProps {
  entity: string;
}

export function NoBanSelected({ entity }: NoBanSelectedProps) {
  const { customerAccess } = useAuth();

  if (customerAccess.length === 0) {
    return (
      <EmptyState
        icon={<UserIcon className="h-12 w-12 text-gray-400" />}
        title="No Customer Access"
        description="You don't have access to any customer accounts yet. Contact your administrator to be granted access."
      />
    );
  }

  return (
    <EmptyState
      icon={<BuildingIcon className="h-12 w-12 text-gray-400" />}
      title="Select a Customer"
      description={`Choose a customer account from the dropdown above to view ${entity}.`}
    />
  );
}

interface NoDataYetProps {
  entity: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function NoDataYet({ entity, actionLabel, onAction }: NoDataYetProps) {
  return (
    <EmptyState
      icon={<InboxIcon className="h-12 w-12 text-gray-400" />}
      title={`No ${entity} Yet`}
      description={`Get started by creating your first ${entity.toLowerCase()}.`}
      action={
        actionLabel && onAction
          ? {
              label: actionLabel,
              onClick: onAction,
            }
          : undefined
      }
    />
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  retry,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon={<AlertCircleIcon className="h-12 w-12 text-red-400" />}
      title={title}
      description={message}
      action={
        retry
          ? {
              label: 'Try Again',
              onClick: retry,
            }
          : undefined
      }
    />
  );
}
