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
import { Textarea } from "@/components/ui/textarea";
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
import {
  DollarSignIcon,
  SearchIcon,
  PlusIcon,
  CreditCardIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UserIcon,
  CalendarIcon,
} from "lucide-react";
import {
  mockCustomerAccounts,
  mockAccountingTransactions,
  type AccountingTransaction,
  type CustomerAccount,
} from "@/polymet/data/admin-mock-data";

export function Accounting() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [transactionType, setTransactionType] = useState<string>("credit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  const filteredTransactions = mockAccountingTransactions.filter(
    (transaction) => {
      const matchesSearch =
        transaction.customerName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        transaction.description
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        transaction.reference?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        typeFilter === "all" || transaction.type === typeFilter;

      return matchesSearch && matchesType;
    }
  );

  const getTransactionBadge = (type: AccountingTransaction["type"]) => {
    const variants = {
      credit: "default",
      debit: "destructive",
      adjustment: "secondary",
      payment: "default",
    } as const;

    const colors = {
      credit: "text-green-600",
      payment: "text-green-600",
      debit: "text-red-600",
      adjustment: "text-blue-600",
    };

    return {
      badge: (
        <Badge variant={variants[type]} className="capitalize">
          {type}
        </Badge>
      ),

      color: colors[type],
    };
  };

  // Calculate accounting statistics
  const totalCredits = mockAccountingTransactions
    .filter((t) => t.type === "credit" || t.type === "payment")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebits = mockAccountingTransactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalAdjustments = mockAccountingTransactions
    .filter((t) => t.type === "adjustment")
    .reduce((sum, t) => sum + t.amount, 0);

  const customersOverLimit = mockCustomerAccounts.filter(
    (c) => c.currentBalance >= c.warningThreshold
  ).length;

  const handleAddTransaction = () => {
    // In a real app, this would submit to an API
    console.log("Adding transaction:", {
      customerId: selectedCustomer,
      type: transactionType,
      amount: parseFloat(amount),
      description,
      reference,
    });

    // Reset form
    setSelectedCustomer("");
    setAmount("");
    setDescription("");
    setReference("");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounting Management</h1>
          <p className="text-muted-foreground">
            Manage customer credits, limits, and financial transactions
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Financial Transaction</DialogTitle>
              <DialogDescription>
                Create a new credit, debit, or adjustment for a customer
                account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer Account</Label>
                <Select
                  value={selectedCustomer}
                  onValueChange={setSelectedCustomer}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer account" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCustomerAccounts.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.companyName} ({customer.accountNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Transaction Type</Label>
                <Select
                  value={transactionType}
                  onValueChange={setTransactionType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit (Add funds)</SelectItem>
                    <SelectItem value="debit">
                      Debit (Charge account)
                    </SelectItem>
                    <SelectItem value="adjustment">
                      Adjustment (Correction)
                    </SelectItem>
                    <SelectItem value="payment">Payment (Received)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter transaction description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference (Optional)</Label>
                <Input
                  id="reference"
                  placeholder="Ticket ID, Invoice #, etc."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleAddTransaction}
                disabled={!selectedCustomer || !amount || !description}
              >
                Add Transaction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Accounting Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalCredits.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Credits & payments received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debits</CardTitle>
            <TrendingDownIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalDebits.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Charges & usage fees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adjustments</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Math.abs(totalAdjustments).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Account corrections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Over Limit</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {customersOverLimit}
            </div>
            <p className="text-xs text-muted-foreground">
              customers over warning threshold
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Credit Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Credit Management</CardTitle>
          <CardDescription>
            Monitor and manage customer credit limits and balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Account #</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Warning Threshold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCustomerAccounts.map((customer) => {
                  const isOverWarning =
                    customer.currentBalance >= customer.warningThreshold;
                  const isOverLimit =
                    customer.currentBalance >= customer.creditLimit;

                  return (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {customer.companyName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {customer.contactName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {customer.accountNumber}
                      </TableCell>
                      <TableCell
                        className={`font-mono ${isOverLimit ? "text-red-600" : isOverWarning ? "text-yellow-600" : ""}`}
                      >
                        ${customer.currentBalance.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono">
                        ${customer.creditLimit.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono">
                        ${customer.warningThreshold.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {isOverLimit ? (
                          <Badge variant="destructive">Over Limit</Badge>
                        ) : isOverWarning ? (
                          <Badge variant="secondary">Warning</Badge>
                        ) : (
                          <Badge variant="default">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <CreditCardIcon className="w-4 h-4 mr-2" />
                              Manage
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{customer.companyName}</DialogTitle>
                              <DialogDescription>
                                Manage credit limits and thresholds
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Current Balance</Label>
                                  <Input
                                    value={`$${customer.currentBalance.toFixed(2)}`}
                                    disabled
                                    className="font-mono"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Monthly Spend</Label>
                                  <Input
                                    value={`$${customer.monthlySpend.toFixed(2)}`}
                                    disabled
                                    className="font-mono"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Credit Limit</Label>
                                <Input
                                  type="number"
                                  defaultValue={customer.creditLimit}
                                  className="font-mono"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Warning Threshold</Label>
                                <Input
                                  type="number"
                                  defaultValue={customer.warningThreshold}
                                  className="font-mono"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button>Update Limits</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            View and search all financial transactions
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              <Input
                placeholder="Search transactions by customer, description, or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="credit">Credits</SelectItem>
                <SelectItem value="debit">Debits</SelectItem>
                <SelectItem value="adjustment">Adjustments</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {searchTerm || typeFilter !== "all"
                        ? "No transactions found matching your filters"
                        : "No transactions found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => {
                    const { badge, color } = getTransactionBadge(
                      transaction.type
                    );

                    return (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-sm">
                          {new Date(
                            transaction.createdDate
                          ).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {transaction.customerName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {transaction.customerId}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{badge}</TableCell>
                        <TableCell className="max-w-xs">
                          <div
                            className="truncate"
                            title={transaction.description}
                          >
                            {transaction.description}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {transaction.reference || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center">
                            <UserIcon className="w-3 h-3 mr-1 text-muted-foreground" />

                            {transaction.createdBy}
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-mono ${color}`}>
                          {transaction.type === "credit" ||
                          transaction.type === "payment"
                            ? "+"
                            : "-"}
                          ${transaction.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Accounting Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center">
            <CreditCardIcon className="w-4 h-4 mr-2" />
            Credit Management
          </h3>
          <div className="text-sm space-y-1">
            <div>✓ Set customer credit limits</div>
            <div>✓ Configure warning thresholds</div>
            <div>✓ Monitor account balances</div>
            <div>✓ Automated limit alerts</div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center">
            <DollarSignIcon className="w-4 h-4 mr-2" />
            Transaction Processing
          </h3>
          <div className="text-sm space-y-1">
            <div>✓ Manual credit adjustments</div>
            <div>✓ Payment processing</div>
            <div>✓ Account corrections</div>
            <div>✓ Audit trail maintenance</div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Financial Reporting
          </h3>
          <div className="text-sm space-y-1">
            <div>✓ Transaction history</div>
            <div>✓ Balance reconciliation</div>
            <div>✓ Credit utilization reports</div>
            <div>✓ Financial analytics</div>
          </div>
        </div>
      </div>
    </div>
  );
}
