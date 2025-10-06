import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreHorizontalIcon,
  PlayIcon,
  PauseIcon,
  XIcon,
  EditIcon,
  CalendarIcon,
  DollarSignIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  AlertTriangleIcon,
} from "lucide-react";
import {
  mockSubscriptions,
  type Subscription,
} from "@/polymet/data/billing-mock-data";

interface BillingSubscriptionsProps {
  subscriptions?: Subscription[];
}

export function BillingSubscriptions({
  subscriptions = mockSubscriptions,
}: BillingSubscriptionsProps) {
  const [selectedSubscription, setSelectedSubscription] =
    useState<Subscription | null>(null);
  const [actionType, setActionType] = useState<
    "pause" | "cancel" | "resume" | null
  >(null);
  const [showDialog, setShowDialog] = useState(false);

  const getStatusBadge = (status: Subscription["status"]) => {
    const variants = {
      active: {
        variant: "default" as const,
        icon: CheckCircleIcon,
        color: "text-green-600",
      },
      paused: {
        variant: "secondary" as const,
        icon: PauseIcon,
        color: "text-yellow-600",
      },
      cancelled: {
        variant: "destructive" as const,
        icon: XCircleIcon,
        color: "text-red-600",
      },
      pending: {
        variant: "outline" as const,
        icon: ClockIcon,
        color: "text-blue-600",
      },
    };

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="w-3 h-3" />

        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const getCategoryBadge = (category: Subscription["category"]) => {
    const categoryColors = {
      platform: "bg-blue-100 text-blue-800",
      voice: "bg-green-100 text-green-800",
      messaging: "bg-purple-100 text-purple-800",
      numbers: "bg-orange-100 text-orange-800",
      support: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge
        variant="outline"
        className={`${categoryColors[category]} border-0`}
      >
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getBillingCycleLabel = (cycle: Subscription["billingCycle"]) => {
    const labels = {
      monthly: "Monthly",
      quarterly: "Quarterly",
      annually: "Annually",
    };
    return labels[cycle];
  };

  const handleAction = (
    subscription: Subscription,
    action: "pause" | "cancel" | "resume"
  ) => {
    setSelectedSubscription(subscription);
    setActionType(action);
    setShowDialog(true);
  };

  const confirmAction = () => {
    if (selectedSubscription && actionType) {
      console.log(`${actionType} subscription:`, selectedSubscription.id);
      // Here you would make the API call to perform the action
    }
    setShowDialog(false);
    setSelectedSubscription(null);
    setActionType(null);
  };

  const getActionDialogContent = () => {
    if (!selectedSubscription || !actionType)
      return { title: "", description: "" };

    const actions = {
      pause: {
        title: "Pause Subscription",
        description: `Are you sure you want to pause "${selectedSubscription.name}"? You can resume it at any time, and you won't be charged during the pause period.`,
      },
      cancel: {
        title: "Cancel Subscription",
        description: `Are you sure you want to cancel "${selectedSubscription.name}"? This action cannot be undone, and you'll lose access to all features immediately.`,
      },
      resume: {
        title: "Resume Subscription",
        description: `Are you sure you want to resume "${selectedSubscription.name}"? Billing will restart from the next billing cycle.`,
      },
    };

    return actions[actionType];
  };

  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status === "active"
  );
  const pausedSubscriptions = subscriptions.filter(
    (sub) => sub.status === "paused"
  );
  const cancelledSubscriptions = subscriptions.filter(
    (sub) => sub.status === "cancelled"
  );

  const totalMonthlyAmount = activeSubscriptions.reduce((sum, sub) => {
    const monthlyAmount =
      sub.billingCycle === "monthly"
        ? sub.amount
        : sub.billingCycle === "quarterly"
          ? sub.amount / 3
          : sub.amount / 12;
    return sum + monthlyAmount;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Subscriptions
            </CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeSubscriptions.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalMonthlyAmount)}/month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paused</CardTitle>
            <PauseIcon className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pausedSubscriptions.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Can be resumed anytime
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircleIcon className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cancelledSubscriptions.length}
            </div>
            <p className="text-xs text-muted-foreground">No longer active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Total</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalMonthlyAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated monthly cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions List */}
      <Card>
        <CardHeader>
          <CardTitle>Manage Subscriptions</CardTitle>
          <CardDescription>
            View and manage your recurring charges and subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-semibold">{subscription.name}</h3>
                    {getStatusBadge(subscription.status)}
                    {getCategoryBadge(subscription.category)}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {subscription.description}
                  </p>

                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-1">
                      <DollarSignIcon className="w-4 h-4 text-muted-foreground" />

                      <span className="font-medium">
                        {formatCurrency(subscription.amount)}
                      </span>
                      <span className="text-muted-foreground">
                        / {subscription.billingCycle.replace("ly", "")}
                      </span>
                      {subscription.quantity && subscription.quantity > 1 && (
                        <span className="text-muted-foreground">
                          ({subscription.quantity} ×{" "}
                          {formatCurrency(subscription.unitPrice || 0)})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <CalendarIcon className="w-4 h-4 text-muted-foreground" />

                      <span className="text-muted-foreground">
                        Next billing: {formatDate(subscription.nextBillingDate)}
                      </span>
                    </div>
                  </div>

                  {subscription.features &&
                    subscription.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {subscription.features
                          .slice(0, 3)
                          .map((feature, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-xs"
                            >
                              {feature}
                            </Badge>
                          ))}
                        {subscription.features.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{subscription.features.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontalIcon className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <EditIcon className="w-4 h-4 mr-2" />
                        Edit Subscription
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {subscription.status === "active" && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleAction(subscription, "pause")}
                          >
                            <PauseIcon className="w-4 h-4 mr-2" />
                            Pause Subscription
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAction(subscription, "cancel")}
                            className="text-red-600"
                          >
                            <XIcon className="w-4 h-4 mr-2" />
                            Cancel Subscription
                          </DropdownMenuItem>
                        </>
                      )}

                      {subscription.status === "paused" && (
                        <DropdownMenuItem
                          onClick={() => handleAction(subscription, "resume")}
                        >
                          <PlayIcon className="w-4 h-4 mr-2" />
                          Resume Subscription
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {getActionDialogContent().title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getActionDialogContent().description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={
                actionType === "cancel" ? "bg-red-600 hover:bg-red-700" : ""
              }
            >
              {actionType === "cancel"
                ? "Cancel Subscription"
                : actionType === "pause"
                  ? "Pause Subscription"
                  : "Resume Subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
