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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DownloadIcon,
  SearchIcon,
  FilterIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertTriangleIcon,
  XCircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  mockBillingStatements,
  mockPayments,
  type BillingStatement,
  type Payment,
} from "@/polymet/data/billing-mock-data";

interface BillingPaymentsProps {
  statements?: BillingStatement[];
  payments?: Payment[];
}

export function BillingPayments({
  statements = mockBillingStatements,
  payments = mockPayments,
}: BillingPaymentsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const getStatusBadge = (
    status: BillingStatement["status"] | Payment["status"]
  ) => {
    const variants = {
      paid: {
        variant: "default" as const,
        icon: CheckCircleIcon,
        color: "text-green-600",
      },
      completed: {
        variant: "default" as const,
        icon: CheckCircleIcon,
        color: "text-green-600",
      },
      open: {
        variant: "secondary" as const,
        icon: ClockIcon,
        color: "text-blue-600",
      },
      pending: {
        variant: "secondary" as const,
        icon: ClockIcon,
        color: "text-blue-600",
      },
      overdue: {
        variant: "destructive" as const,
        icon: AlertTriangleIcon,
        color: "text-red-600",
      },
      failed: {
        variant: "destructive" as const,
        icon: XCircleIcon,
        color: "text-red-600",
      },
      processing: {
        variant: "outline" as const,
        icon: RefreshCwIcon,
        color: "text-yellow-600",
      },
      refunded: {
        variant: "outline" as const,
        icon: RefreshCwIcon,
        color: "text-purple-600",
      },
    };

    const config = variants[status as keyof typeof variants];
    if (!config) return <Badge variant="outline">{status}</Badge>;

    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="w-3 h-3" />

        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const getPaymentMethodBadge = (method: Payment["method"]) => {
    const methodLabels = {
      credit_card: "Credit Card",
      ach: "ACH Transfer",
      google_pay: "Google Pay",
      paypal: "PayPal",
      wire_transfer: "Wire Transfer",
    };

    return (
      <Badge variant="outline" className="capitalize">
        {methodLabels[method] || method}
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

  const filteredStatements = statements.filter((statement) => {
    const matchesSearch =
      statement.statementNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      statement.period.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || statement.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.transactionId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || payment.status === statusFilter;
    const matchesMethod =
      methodFilter === "all" || payment.method === methodFilter;
    return matchesSearch && matchesStatus && matchesMethod;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments & Statements</CardTitle>
        <CardDescription>
          View your billing statements and payment history
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="statements" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="statements">Statements</TabsTrigger>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
          </TabsList>

          {/* Statements Tab */}
          <TabsContent value="statements" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                <Input
                  placeholder="Search statements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statement</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>NetSuite</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStatements.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No statements found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStatements.map((statement) => (
                      <TableRow key={statement.id}>
                        <TableCell className="font-medium">
                          {statement.statementNumber}
                        </TableCell>
                        <TableCell>{statement.period}</TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(statement.amount)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(statement.status)}
                        </TableCell>
                        <TableCell>{formatDate(statement.dueDate)}</TableCell>
                        <TableCell>
                          {statement.netsuiteId ? (
                            <div className="flex items-center space-x-1">
                              <Badge variant="outline" className="text-xs">
                                {statement.netsuiteId}
                              </Badge>
                              <ExternalLinkIcon className="w-3 h-3 text-muted-foreground" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="ghost" size="sm">
                              <DownloadIcon className="w-4 h-4" />
                            </Button>
                            {statement.status === "open" && (
                              <Button size="sm">Pay Now</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                <Input
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="ach">ACH Transfer</SelectItem>
                  <SelectItem value="google_pay">Google Pay</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No payments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {payment.paymentNumber}
                        </TableCell>
                        <TableCell>{formatDate(payment.date)}</TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(payment.amount)}
                          {payment.refundAmount && (
                            <div className="text-xs text-muted-foreground">
                              Refunded: {formatCurrency(payment.refundAmount)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getPaymentMethodBadge(payment.method)}
                        </TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {payment.transactionId || "-"}
                          {payment.failureReason && (
                            <div className="text-xs text-red-600 mt-1">
                              {payment.failureReason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
