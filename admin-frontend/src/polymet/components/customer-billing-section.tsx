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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileTextIcon } from "lucide-react";
import { type CustomerAccount } from "@/polymet/data/admin-mock-data";
import { mockBillingStatements } from "@/polymet/data/billing-mock-data";

interface CustomerBillingSectionProps {
  customer: CustomerAccount;
}

export function CustomerBillingSection({
  customer,
}: CustomerBillingSectionProps) {
  // Mock billing data for this customer
  const customerBilling = mockBillingStatements.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Billing Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg text-center">
          <div className="text-2xl font-bold">
            ${customer.currentBalance.toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground">Current Balance</p>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <div className="text-2xl font-bold">
            ${customer.monthlySpend.toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground">Monthly Spend</p>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <div className="text-2xl font-bold">
            ${customer.creditLimit.toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground">Credit Limit</p>
        </div>
      </div>

      {/* Billing Statements */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Statements</CardTitle>
          <CardDescription>
            Customer billing statements and payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statement Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerBilling.map((statement) => (
                  <TableRow key={statement.id}>
                    <TableCell>
                      {new Date(statement.statementDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      ${statement.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          statement.status === "paid"
                            ? "default"
                            : statement.status === "overdue"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {statement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(statement.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <FileTextIcon className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>
            Configured payment methods and billing preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-6 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">
                  VISA
                </div>
                <div>
                  <div className="font-medium">**** **** **** 4242</div>
                  <div className="text-sm text-muted-foreground">
                    Expires 12/2025
                  </div>
                </div>
              </div>
              <Badge variant="default">Default</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-6 bg-gray-600 rounded text-white text-xs flex items-center justify-center font-bold">
                  ACH
                </div>
                <div>
                  <div className="font-medium">Bank Account ****1234</div>
                  <div className="text-sm text-muted-foreground">
                    Wells Fargo Business
                  </div>
                </div>
              </div>
              <Badge variant="outline">Backup</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Alerts & Notifications</CardTitle>
          <CardDescription>
            Account alerts and billing notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
              <div>
                <div className="font-medium text-green-900">
                  Payment Received
                </div>
                <div className="text-sm text-green-700">
                  $2,500.00 payment processed successfully on Jan 15, 2024
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">Completed</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
              <div>
                <div className="font-medium text-blue-900">
                  Auto-pay Enabled
                </div>
                <div className="text-sm text-blue-700">
                  Automatic payments are active for this account
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div>
                <div className="font-medium text-yellow-900">
                  Credit Utilization
                </div>
                <div className="text-sm text-yellow-700">
                  Currently using 57% of available credit limit
                </div>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">Monitor</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
