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
import {
  UsersIcon,
  DollarSignIcon,
  TrendingUpIcon,
  SearchIcon,
  BuildingIcon,
  EyeIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  BarChart3Icon,
  Loader2,
} from "lucide-react";
import {
  mockCustomerAccounts,
  mockAdminStats,
  type CustomerAccount,
} from "@/polymet/data/admin-mock-data";
import { Link } from "react-router-dom";
import { AdminAnalytics } from "@/polymet/components/admin-analytics";
import {
  AdminRevenueChart,
  AdminCustomerGrowthChart,
} from "@/polymet/components/admin-charts";
import { AdminCustomerTable } from "@/polymet/components/admin-tables";
import { useDashboardStats, useCurrentUser } from "@/hooks/useDashboard";

export function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Fetch real dashboard stats from API
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: currentUser } = useCurrentUser();

  const filteredCustomers = mockCustomerAccounts.filter(
    (customer) =>
      customer.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: CustomerAccount["status"]) => {
    const variants = {
      active: "default",
      suspended: "destructive",
      inactive: "secondary",
    } as const;

    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview and customer account management
        </p>
      </div>

      {/* Admin Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Customers
            </CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockAdminStats.totalCustomers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />
              {mockAdminStats.activeCustomers} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(mockAdminStats.totalRevenue / 1000000).toFixed(1)}M
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUpIcon className="inline w-3 h-3 mr-1" />+
              {mockAdminStats.monthlyGrowth}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Vendors
            </CardTitle>
            <BuildingIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockAdminStats.activeVendors}
            </div>
            <p className="text-xs text-muted-foreground">
              of {mockAdminStats.totalVendors} total vendors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Support Tickets
            </CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockAdminStats.pendingTickets}
            </div>
            <p className="text-xs text-muted-foreground">pending resolution</p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Analytics Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3Icon className="w-5 h-5 text-[#58C5C7]" />

            <span>Business Intelligence</span>
          </CardTitle>
          <CardDescription>
            Comprehensive analytics and system insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminAnalytics timeRange="30d" showAlerts={true} />
        </CardContent>
      </Card>

      {/* Revenue and Growth Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminRevenueChart />

        <AdminCustomerGrowthChart />
      </div>

      {/* Customer Management */}
      <AdminCustomerTable
        onViewCustomer={(customerId) => {
          // Navigation handled by Link component in the table
          console.log("Viewing customer:", customerId);
        }}
        onEditCustomer={(customerId) => {
          console.log("Editing customer:", customerId);
          // Future: Open customer edit modal or navigate to edit page
        }}
      />

      {/* Platform Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">Platform Health</h3>
          <div className="text-sm space-y-1">
            <div className="flex items-center">
              <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
              API Gateway: Operational
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
              Database: Healthy
            </div>
            <div className="flex items-center">
              <AlertTriangleIcon className="w-4 h-4 text-yellow-500 mr-2" />
              CDR Processing: Delayed
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">Admin Features</h3>
          <div className="text-sm space-y-1">
            <div>✓ Customer account management</div>
            <div>✓ Real-time analytics dashboard</div>
            <div>✓ Vendor relationship tracking</div>
            <div>✓ Financial oversight tools</div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">Quick Actions</h3>
          <div className="text-sm space-y-1">
            <div>• Search customer accounts</div>
            <div>• View customer product details</div>
            <div>• Monitor platform performance</div>
            <div>• Access support tools</div>
          </div>
        </div>
      </div>
    </div>
  );
}
