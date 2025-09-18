import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSignIcon,
  CalendarIcon,
  TrendingUpIcon,
  CreditCardIcon,
} from "lucide-react";
import { BillingOverview } from "@/polymet/components/billing-overview";
import { BillingPayments } from "@/polymet/components/billing-payments";
import { BillingSubscriptions } from "@/polymet/components/billing-subscriptions";
import { BillingPaymentMethods } from "@/polymet/components/billing-payment-methods";
import { mockBillingOverview } from "@/polymet/data/billing-mock-data";

export function Billing() {
  const [activeTab, setActiveTab] = useState("overview");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">
            Manage your billing, payments, subscriptions, and payment methods.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Balance
            </CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockBillingOverview.currentBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Account credit available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockBillingOverview.monthToDateSpending)}
            </div>
            <p className="text-xs text-muted-foreground">Current month usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Payment</CardTitle>
            <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockBillingOverview.lastPaymentAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(mockBillingOverview.lastPaymentDate)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Apr 14, 2024</div>
            <p className="text-xs text-muted-foreground">
              Upcoming billing cycle
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="statements-payments">
            Statements & Payments
          </TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <BillingOverview />
        </TabsContent>

        <TabsContent value="statements-payments" className="space-y-4">
          <BillingPayments />
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <BillingSubscriptions />
        </TabsContent>

        <TabsContent value="payment-methods" className="space-y-4">
          <BillingPaymentMethods />
        </TabsContent>
      </Tabs>
    </div>
  );
}
