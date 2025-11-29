import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeftIcon,
  BuildingIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  CreditCardIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  HashIcon,
  MessageSquareIcon,
  EditIcon,
  PlusIcon,
  SearchIcon,
  FilterIcon,
  DownloadIcon,
  TrendingUpIcon,
  UsersIcon,
  DollarSignIcon,
  BarChart3Icon,
  Loader2Icon,
} from "lucide-react";
import {
  mockAccountingTransactions,
  type CustomerAccount,
} from "@/polymet/data/admin-mock-data";
import {
  mockSipTrunks,
  mockDidNumbers,
  mockCallRecords,
} from "@/polymet/data/telecom-mock-data";
import {
  mockBillingStatements,
  mockPayments,
} from "@/polymet/data/billing-mock-data";
import { Input } from "@/components/ui/input";

// Import API hooks and adapter
import { useCustomers, useCustomer } from "@/hooks/useCustomers";
import { apiCustomerToPolymetAccount } from "@/lib/customer-adapter";

// Import the new modular components
import { CustomerAnalyticsSection } from "@/polymet/components/customer-analytics-section";
import { CustomerCRMSection } from "@/polymet/components/customer-crm-section";
import { CustomerBillingSection } from "@/polymet/components/customer-billing-section";
import { CustomerReports } from "@/polymet/components/customer-reports";
import { CustomerEditForm } from "@/polymet/components/customer-edit-form";
import { CustomerTrunkSection } from "@/polymet/components/customer-trunk-section";

export function CustomerOverview() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch customer list (when no customerId)
  const { data: customersData, isLoading: isLoadingList } = useCustomers(
    currentPage,
    20,
    searchQuery,
    undefined,
    { enabled: !customerId }
  );

  // Fetch individual customer (when customerId provided)
  const { data: customer, isLoading: isLoadingCustomer, refetch: refetchCustomer } = useCustomer(
    customerId || "",
    { enabled: !!customerId }
  );

  useEffect(() => {
    if (customer) {
      setSelectedCustomer(customer);
    }
  }, [customer]);

  // Customer Search Interface
  const CustomerSearchInterface = () => {
    const customers = customersData?.items || [];
    const pagination = customersData?.pagination;

    if (isLoadingList) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2Icon className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Management</h1>
            <p className="text-muted-foreground">
              Search, manage, and analyze customer accounts
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <FilterIcon className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button variant="outline">
              <DownloadIcon className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => navigate("/customers/new")}>
              <PlusIcon className="w-4 h-4 mr-2" />
              New Customer
            </Button>
          </div>
        </div>

        {/* Customer Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Customers
              </CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pagination?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all tiers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Accounts
              </CardTitle>
              <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {customers.filter((c) => c.status === "ACTIVE").length}
              </div>
              <p className="text-xs text-muted-foreground">
                {pagination?.total ?
                  Math.round((customers.filter((c) => c.status === "ACTIVE").length / pagination.total) * 100)
                  : 0}% active rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Balance
              </CardTitle>
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                $
                {customers
                  .reduce((sum, c) => sum + c.current_balance, 0)
                  .toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <p className="text-xs text-muted-foreground">
                Current balance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Account Value
              </CardTitle>
              <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                $
                {customers.length > 0 ? Math.round(
                  customers.reduce(
                    (sum, c) => sum + c.current_balance,
                    0
                  ) / customers.length
                ).toLocaleString() : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Per customer
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Customer List */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Directory</CardTitle>
            <CardDescription>
              Search and manage customer accounts
            </CardDescription>
            <div className="flex items-center space-x-2 mt-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />

                <input
                  type="text"
                  placeholder="Search customers by name, account, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>BAN</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((cust) => (
                    <TableRow
                      key={cust.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/customer/${cust.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {cust.company_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {cust.contact?.email || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {cust.contact?.name || "-"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {cust.contact?.phone || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {cust.ban}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {cust.customer_type.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            cust.status === "ACTIVE"
                              ? "default"
                              : cust.status === "SUSPENDED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {cust.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        ${cust.current_balance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customer/${cust.id}`);
                          }}
                        >
                          <EditIcon className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Show loading for individual customer
  if (customerId && isLoadingCustomer) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2Icon className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return <CustomerSearchInterface />;
  }

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    const variants = {
      active: "default",
      suspended: "destructive",
      inactive: "secondary",
      trial: "secondary",
      closed: "secondary",
    } as const;

    return <Badge variant={variants[statusLower as keyof typeof variants] || "secondary"}>{status}</Badge>;
  };

  // Mock data for sections not yet implemented via API
  const customerTrunks = mockSipTrunks.slice(0, 2); // TODO: Replace with API
  const customerNumbers = mockDidNumbers.slice(0, 5); // TODO: Replace with API
  const customerCalls = mockCallRecords.slice(0, 20); // TODO: Replace with API
  const customerBilling = mockBillingStatements.slice(0, 3); // TODO: Replace with API
  const customerPayments = mockPayments.slice(0, 5); // TODO: Replace with API
  const customerTransactions = mockAccountingTransactions.filter(
    (t) => t.customerId === customer.id
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/customers">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{customer.company_name}</h1>
            <p className="text-muted-foreground">
              BAN: {customer.ban}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(customer.status)}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditForm(true)}
          >
            <EditIcon className="w-4 h-4 mr-2" />
            Edit Account
          </Button>
        </div>
      </div>

      {/* Customer Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${customer.current_balance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Prepaid: ${customer.prepaid_balance.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Limit</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${customer.credit_limit?.toLocaleString() || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Payment Terms: NET{customer.payment_terms}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SIP Trunks</CardTitle>
            <PhoneIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Phone Numbers</CardTitle>
            <HashIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              0
            </div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Details and Products */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="trunks">Trunks</TabsTrigger>
          <TabsTrigger value="numbers">Numbers</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="calls">Call Data</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          <div className="p-8 text-center text-muted-foreground">
            <BarChart3Icon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Analytics section coming soon - will show usage metrics, trends, and reports</p>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BuildingIcon className="w-5 h-5 mr-2" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <MailIcon className="w-4 h-4 text-muted-foreground" />

                  <div>
                    <p className="font-medium">{customer.contact?.name || "N/A"}</p>
                    <p className="text-sm text-muted-foreground">
                      {customer.contact?.email || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <PhoneIcon className="w-4 h-4 text-muted-foreground" />

                  <p>{customer.contact?.phone || "N/A"}</p>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPinIcon className="w-4 h-4 text-muted-foreground mt-1" />

                  <div>
                    <p>{customer.address?.line1 || "N/A"}</p>
                    <p>
                      {customer.address?.city}, {customer.address?.state}{" "}
                      {customer.address?.zip}
                    </p>
                    <p>{customer.address?.country}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Details */}
            <Card>
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer Type:</span>
                  <Badge variant="outline" className="capitalize">
                    {customer.customer_type.toLowerCase()}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created Date:</span>
                  <span>
                    {new Date(customer.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>
                    {new Date(customer.updated_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  {getStatusBadge(customer.status)}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing Cycle:</span>
                  <span className="capitalize">{customer.billing_cycle.toLowerCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Enabled Services:</span>
                  <div className="flex flex-wrap gap-1">
                    {customer.services?.voice?.enabled && (
                      <Badge variant="outline" className="text-xs">
                        Voice
                      </Badge>
                    )}
                    {customer.services?.messaging?.enabled && (
                      <Badge variant="outline" className="text-xs">
                        Messaging
                      </Badge>
                    )}
                    {customer.services?.telecom_data?.enabled && (
                      <Badge variant="outline" className="text-xs">
                        Data
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Account Transactions</CardTitle>
              <CardDescription>
                Latest financial transactions for this account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      customerTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {new Date(
                              transaction.createdDate
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                transaction.type === "credit" ||
                                transaction.type === "payment"
                                  ? "default"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {transaction.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell className="text-sm">
                            {transaction.createdBy}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono ${
                              transaction.type === "credit" ||
                              transaction.type === "payment"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {transaction.type === "credit" ||
                            transaction.type === "payment"
                              ? "+"
                              : "-"}
                            ${transaction.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trunks">
          <Card>
            <CardHeader>
              <CardTitle>SIP Trunks</CardTitle>
              <CardDescription>Customer trunk configurations (coming soon)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <PhoneIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Trunk management will be available soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Phone Numbers</CardTitle>
                <CardDescription>
                  Manage customer's DID and toll-free numbers
                </CardDescription>
              </div>
              <Button size="sm">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Number
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Monthly Rate</TableHead>
                      <TableHead>E911 Address</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerNumbers.map((number) => (
                      <TableRow key={number.id}>
                        <TableCell className="font-mono">
                          {number.number}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {number.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              number.status === "active"
                                ? "default"
                                : number.status === "porting"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {number.status}
                          </Badge>
                        </TableCell>
                        <TableCell>${number.monthlyRate}</TableCell>
                        <TableCell className="text-sm">
                          {number.e911Address ? (
                            <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangleIcon className="w-4 h-4 text-yellow-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <EditIcon className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messaging">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquareIcon className="w-5 h-5 mr-2" />
                Messaging Services
              </CardTitle>
              <CardDescription>
                SMS, MMS, and messaging campaign management
              </CardDescription>
            </CardHeader>
            <CardContent>
              {customer.services?.messaging?.enabled ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">SMS Gateway Access</h4>
                      <p className="text-sm text-muted-foreground">
                        High-volume SMS messaging platform
                      </p>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg text-center">
                      <div className="text-2xl font-bold">12,450</div>
                      <p className="text-sm text-muted-foreground">
                        Messages this month
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <div className="text-2xl font-bold">98.5%</div>
                      <p className="text-sm text-muted-foreground">
                        Delivery rate
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <div className="text-2xl font-bold">$0.0075</div>
                      <p className="text-sm text-muted-foreground">
                        Rate per message
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquareIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />

                  <h4 className="font-medium mb-2">No Messaging Services</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    This customer doesn't have messaging services enabled.
                  </p>
                  <Button>Enable Messaging</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <label className="text-sm text-muted-foreground">Current Balance</label>
                    <p className="text-2xl font-bold">${customer.current_balance.toFixed(2)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <label className="text-sm text-muted-foreground">Prepaid Balance</label>
                    <p className="text-2xl font-bold">${customer.prepaid_balance.toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <label className="text-sm text-muted-foreground">Credit Limit</label>
                    <p className="text-2xl font-bold">${customer.credit_limit?.toLocaleString() || "N/A"}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <label className="text-sm text-muted-foreground">Payment Terms</label>
                    <p className="text-2xl font-bold">NET{customer.payment_terms}</p>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <label className="text-sm text-muted-foreground">Billing Cycle</label>
                  <p className="text-lg font-semibold capitalize">{customer.billing_cycle.toLowerCase()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>Call Detail Records</CardTitle>
              <CardDescription>
                Recent call activity and usage patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerCalls.slice(0, 10).map((call) => (
                      <TableRow key={call.id}>
                        <TableCell className="font-mono text-sm">
                          {new Date(call.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono">{call.from}</TableCell>
                        <TableCell className="font-mono">{call.to}</TableCell>
                        <TableCell>
                          {call.duration > 0
                            ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
                            : "0s"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              call.status === "completed"
                                ? "default"
                                : call.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {call.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${call.cost.toFixed(3)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crm" className="space-y-6">
          <div className="p-8 text-center text-muted-foreground">
            <BuildingIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>CRM integration section - will show HubSpot sync status and timeline</p>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="p-8 text-center text-muted-foreground">
            <DownloadIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Reports section - will generate customer usage and billing reports</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Form Modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="my-8">
            <CustomerEditForm
              customer={customer}
              isOpen={showEditForm}
              onSave={() => {
                setShowEditForm(false);
                refetchCustomer();
              }}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
