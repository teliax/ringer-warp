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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  PlusIcon,
  CreditCardIcon,
  BanknoteIcon,
  SmartphoneIcon,
  MoreHorizontalIcon,
  StarIcon,
  TrashIcon,
  EditIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
} from "lucide-react";
import {
  mockPaymentMethods,
  type PaymentMethod,
} from "@/polymet/data/billing-mock-data";

interface BillingPaymentMethodsProps {
  paymentMethods?: PaymentMethod[];
}

export function BillingPaymentMethods({
  paymentMethods = mockPaymentMethods,
}: BillingPaymentMethodsProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newMethodType, setNewMethodType] =
    useState<PaymentMethod["type"]>("credit_card");

  const getMethodIcon = (type: PaymentMethod["type"]) => {
    const icons = {
      credit_card: CreditCardIcon,
      ach: BanknoteIcon,
      google_pay: SmartphoneIcon,
      paypal: SmartphoneIcon,
    };
    return icons[type];
  };

  const getMethodLabel = (method: PaymentMethod) => {
    switch (method.type) {
      case "credit_card":
        return `${method.cardBrand?.toUpperCase()} ending in ${method.cardLast4}`;
      case "ach":
        return `${method.bankName} ending in ${method.accountLast4}`;
      case "google_pay":
        return `Google Pay (${method.email})`;
      case "paypal":
        return `PayPal (${method.email})`;
      default:
        return "Unknown method";
    }
  };

  const getStatusBadge = (status: PaymentMethod["status"]) => {
    const variants = {
      active: {
        variant: "default" as const,
        icon: CheckCircleIcon,
        color: "text-green-600",
      },
      expired: {
        variant: "destructive" as const,
        icon: AlertTriangleIcon,
        color: "text-red-600",
      },
      disabled: {
        variant: "secondary" as const,
        icon: XCircleIcon,
        color: "text-gray-600",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSetDefault = (methodId: string) => {
    console.log("Set as default:", methodId);
    // Here you would make the API call to set the default payment method
  };

  const handleDelete = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (selectedMethod) {
      console.log("Delete payment method:", selectedMethod.id);
      // Here you would make the API call to delete the payment method
    }
    setShowDeleteDialog(false);
    setSelectedMethod(null);
  };

  const handleAddMethod = () => {
    console.log("Add new payment method:", newMethodType);
    // Here you would handle adding the new payment method
    setShowAddDialog(false);
  };

  const activeMethodsCount = paymentMethods.filter(
    (m) => m.status === "active"
  ).length;
  const defaultMethod = paymentMethods.find((m) => m.isDefault);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Methods
            </CardTitle>
            <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMethodsCount}</div>
            <p className="text-xs text-muted-foreground">
              Payment methods available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Default Method
            </CardTitle>
            <StarIcon className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {defaultMethod ? getMethodLabel(defaultMethod) : "None set"}
            </div>
            <p className="text-xs text-muted-foreground">
              Used for automatic payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Add Method</CardTitle>
            <PlusIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Payment Method
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Payment Method</DialogTitle>
                  <DialogDescription>
                    Choose a payment method to add to your account.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="method-type">Payment Method Type</Label>
                    <Select
                      value={newMethodType}
                      onValueChange={(value: PaymentMethod["type"]) =>
                        setNewMethodType(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="ach">Bank Account (ACH)</SelectItem>
                        <SelectItem value="google_pay">Google Pay</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newMethodType === "credit_card" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="card-number">Card Number</Label>
                          <Input
                            id="card-number"
                            placeholder="1234 5678 9012 3456"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="card-expiry">Expiry</Label>
                          <Input id="card-expiry" placeholder="MM/YY" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="card-cvc">CVC</Label>
                          <Input id="card-cvc" placeholder="123" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="card-name">Cardholder Name</Label>
                          <Input id="card-name" placeholder="John Smith" />
                        </div>
                      </div>
                    </div>
                  )}

                  {newMethodType === "ach" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="bank-name">Bank Name</Label>
                        <Input id="bank-name" placeholder="Chase Bank" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="routing-number">Routing Number</Label>
                          <Input id="routing-number" placeholder="021000021" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="account-number">Account Number</Label>
                          <Input id="account-number" placeholder="1234567890" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="account-type">Account Type</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="checking">Checking</SelectItem>
                            <SelectItem value="savings">Savings</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {(newMethodType === "google_pay" ||
                    newMethodType === "paypal") && (
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddMethod}>Add Method</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods List */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>
            Manage your payment methods for automatic billing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paymentMethods.map((method) => {
              const Icon = getMethodIcon(method.type);

              return (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-muted rounded-lg">
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          {getMethodLabel(method)}
                        </span>
                        {method.isDefault && (
                          <Badge
                            variant="secondary"
                            className="flex items-center space-x-1"
                          >
                            <StarIcon className="w-3 h-3" />

                            <span>Default</span>
                          </Badge>
                        )}
                        {getStatusBadge(method.status)}
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>Added {formatDate(method.createdDate)}</span>
                        {method.lastUsed && (
                          <span>Last used {formatDate(method.lastUsed)}</span>
                        )}
                        {method.cardExpiry && (
                          <span>Expires {method.cardExpiry}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!method.isDefault && method.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        Set as Default
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontalIcon className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <EditIcon className="w-4 h-4 mr-2" />
                          Edit Method
                        </DropdownMenuItem>

                        {!method.isDefault && (
                          <>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => handleDelete(method)}
                              className="text-red-600"
                            >
                              <TrashIcon className="w-4 h-4 mr-2" />
                              Delete Method
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment method? This action
              cannot be undone.
              {selectedMethod && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>{getMethodLabel(selectedMethod)}</strong>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Method
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
