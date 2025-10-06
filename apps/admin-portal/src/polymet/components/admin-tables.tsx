import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DownloadIcon,
  SearchIcon,
  FilterIcon,
  ArrowUpDownIcon,
  EyeIcon,
  UserIcon,
  PhoneIcon,
} from "lucide-react";
import {
  mockCallRecords,
  type CallRecord,
} from "@/polymet/data/telecom-mock-data";
import { mockCustomerAccounts } from "@/polymet/data/admin-mock-data";

interface AdminCdrTableProps {
  data?: CallRecord[];
  title?: string;
  showCustomerFilter?: boolean;
  onViewCustomer?: (customerId: string) => void;
}

export function AdminCdrTable({
  data = mockCallRecords,
  title = "Customer Call Detail Records",
  showCustomerFilter = true,
  onViewCustomer,
}: AdminCdrTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  // Enhanced filtering for admin view
  const filteredData = data.filter((record) => {
    const matchesSearch =
      record.from.includes(searchTerm) ||
      record.to.includes(searchTerm) ||
      record.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || record.status === statusFilter;
    const matchesDirection =
      directionFilter === "all" || record.direction === directionFilter;
    const matchesCustomer =
      customerFilter === "all" || record.customerId === customerFilter;

    return (
      matchesSearch && matchesStatus && matchesDirection && matchesCustomer
    );
  });

  const getStatusBadge = (status: CallRecord["status"]) => {
    const variants = {
      completed: "default",
      failed: "destructive",
      busy: "secondary",
      "no-answer": "outline",
    } as const;

    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getCustomerName = (customerId?: string) => {
    if (!customerId) return "Unknown";
    const customer = mockCustomerAccounts.find((c) => c.id === customerId);
    return customer?.companyName || customerId;
  };

  const handleExportCsv = () => {
    // Admin export includes customer information
    const csvData = filteredData.map((record) => ({
      timestamp: formatTimestamp(record.timestamp),
      customer: getCustomerName(record.customerId),
      from: record.from,
      to: record.to,
      duration: formatDuration(record.duration),
      status: record.status,
      direction: record.direction,
      cost: formatCost(record.cost),
    }));

    console.log("Exporting admin CDR data:", csvData);
    // Implementation would generate and download CSV
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <PhoneIcon className="w-5 h-5 text-[#58C5C7]" />

              <span>{title}</span>
            </CardTitle>
            <CardDescription>
              {filteredData.length} of {data.length} records across all
              customers
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <DownloadIcon className="w-4 h-4 mr-2" />
            Export Admin CSV
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              placeholder="Search by phone number, call ID, or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {showCustomerFilter && (
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {mockCustomerAccounts.slice(0, 5).map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="no-answer">No Answer</SelectItem>
            </SelectContent>
          </Select>

          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium"
                  >
                    Timestamp
                    <ArrowUpDownIcon className="w-4 h-4 ml-1" />
                  </Button>
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No call records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-sm">
                      {formatTimestamp(record.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />

                        <span className="font-medium">
                          {getCustomerName(record.customerId)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{record.from}</TableCell>
                    <TableCell className="font-mono">{record.to}</TableCell>
                    <TableCell>{formatDuration(record.duration)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {record.direction}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCost(record.cost)}
                    </TableCell>
                    <TableCell>
                      {record.customerId && onViewCustomer && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewCustomer(record.customerId!)}
                        >
                          <EyeIcon className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface AdminCustomerTableProps {
  customers?: typeof mockCustomerAccounts;
  onViewCustomer?: (customerId: string) => void;
  onEditCustomer?: (customerId: string) => void;
}

export function AdminCustomerTable({
  customers = mockCustomerAccounts,
  onViewCustomer,
  onEditCustomer,
}: AdminCustomerTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contactEmail.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || customer.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      suspended: "destructive",
      pending: "secondary",
      inactive: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <UserIcon className="w-5 h-5 text-[#58C5C7]" />

              <span>Customer Accounts</span>
            </CardTitle>
            <CardDescription>
              {filteredCustomers.length} of {customers.length} customer accounts
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <DownloadIcon className="w-4 h-4 mr-2" />
            Export Customers
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              placeholder="Search by company name, account number, or email..."
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Account Number</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Monthly Spend</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {customer.companyName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {customer.industry}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {customer.accountNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {customer.contactName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {customer.contactEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      ${customer.monthlySpend.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      ${customer.creditLimit.toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(customer.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {onViewCustomer && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewCustomer(customer.id)}
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                        )}
                        {onEditCustomer && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditCustomer(customer.id)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
