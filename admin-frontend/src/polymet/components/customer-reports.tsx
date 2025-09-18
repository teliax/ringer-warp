import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DownloadIcon,
  FileTextIcon,
  BarChart3Icon,
  CalendarIcon,
  TrendingUpIcon,
  PhoneIcon,
  MessageSquareIcon,
  DollarSignIcon,
} from "lucide-react";
import { type CustomerAccount } from "@/polymet/data/admin-mock-data";

interface CustomerReportsProps {
  customer: CustomerAccount;
}

export function CustomerReports({ customer }: CustomerReportsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("last-30-days");
  const [reportType, setReportType] = useState("usage");

  // Mock report data
  const usageReports = [
    {
      id: "usage-001",
      name: "Call Detail Records",
      description: "Detailed call logs with duration, cost, and status",
      period: "Last 30 days",
      records: 2847,
      size: "2.4 MB",
      format: "CSV",
    },
    {
      id: "usage-002",
      name: "SMS Usage Report",
      description: "Message delivery statistics and costs",
      period: "Last 30 days",
      records: 1256,
      size: "890 KB",
      format: "PDF",
    },
    {
      id: "usage-003",
      name: "Trunk Utilization",
      description: "SIP trunk usage patterns and capacity analysis",
      period: "Last 30 days",
      records: 720,
      size: "1.1 MB",
      format: "Excel",
    },
  ];

  const billingReports = [
    {
      id: "billing-001",
      name: "Monthly Statement",
      description: "Detailed billing statement with line items",
      period: "January 2024",
      amount: "$2,847.50",
      status: "Paid",
      format: "PDF",
    },
    {
      id: "billing-002",
      name: "Usage Summary",
      description: "Cost breakdown by service type",
      period: "Last 30 days",
      amount: "$2,847.50",
      status: "Current",
      format: "Excel",
    },
    {
      id: "billing-003",
      name: "Payment History",
      description: "Transaction history and payment methods",
      period: "Last 12 months",
      amount: "$34,170.00",
      status: "Complete",
      format: "CSV",
    },
  ];

  const complianceReports = [
    {
      id: "compliance-001",
      name: "E911 Compliance",
      description: "Emergency services address verification",
      period: "Current",
      status: "Compliant",
      lastCheck: "2024-01-15",
      format: "PDF",
    },
    {
      id: "compliance-002",
      name: "TCPA Compliance",
      description: "Messaging consent and opt-out tracking",
      period: "Last 30 days",
      status: "Compliant",
      lastCheck: "2024-01-14",
      format: "Excel",
    },
    {
      id: "compliance-003",
      name: "Data Retention",
      description: "Call record retention and archival status",
      period: "Last 12 months",
      status: "Compliant",
      lastCheck: "2024-01-10",
      format: "CSV",
    },
  ];

  const handleExport = (reportId: string, format: string) => {
    console.log(`Exporting report ${reportId} in ${format} format`);
    // Simulate download
    alert(`Downloading report in ${format} format...`);
  };

  const generateCustomReport = () => {
    console.log("Generating custom report for period:", selectedPeriod);
    alert(
      "Custom report generation started. You'll receive an email when ready."
    );
  };

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3Icon className="w-5 h-5 mr-2" />
            Customer Reports & Analytics
          </CardTitle>
          <CardDescription>
            Generate and export detailed reports for {customer.companyName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />

              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last-7-days">Last 7 days</SelectItem>
                  <SelectItem value="last-30-days">Last 30 days</SelectItem>
                  <SelectItem value="last-90-days">Last 90 days</SelectItem>
                  <SelectItem value="last-12-months">Last 12 months</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateCustomReport}>
              <FileTextIcon className="w-4 h-4 mr-2" />
              Generate Custom Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">2,847</p>
              </div>
              <PhoneIcon className="w-8 h-8 text-blue-500" />
            </div>
            <div className="flex items-center mt-2">
              <TrendingUpIcon className="w-3 h-3 text-green-500 mr-1" />

              <span className="text-xs text-green-600">
                +12% vs last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages Sent</p>
                <p className="text-2xl font-bold">1,256</p>
              </div>
              <MessageSquareIcon className="w-8 h-8 text-purple-500" />
            </div>
            <div className="flex items-center mt-2">
              <TrendingUpIcon className="w-3 h-3 text-green-500 mr-1" />

              <span className="text-xs text-green-600">
                +22% vs last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">$2,847</p>
              </div>
              <DollarSignIcon className="w-8 h-8 text-green-500" />
            </div>
            <div className="flex items-center mt-2">
              <TrendingUpIcon className="w-3 h-3 text-green-500 mr-1" />

              <span className="text-xs text-green-600">+8% vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">98.2%</p>
              </div>
              <BarChart3Icon className="w-8 h-8 text-orange-500" />
            </div>
            <div className="flex items-center mt-2">
              <TrendingUpIcon className="w-3 h-3 text-green-500 mr-1" />

              <span className="text-xs text-green-600">
                +0.3% vs last period
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Categories */}
      <Tabs defaultValue="usage" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="usage">Usage Reports</TabsTrigger>
          <TabsTrigger value="billing">Billing Reports</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Usage & Activity Reports</CardTitle>
              <CardDescription>
                Detailed usage statistics and activity logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {report.description}
                        </TableCell>
                        <TableCell>{report.period}</TableCell>
                        <TableCell>{report.records.toLocaleString()}</TableCell>
                        <TableCell>{report.size}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleExport(report.id, report.format)
                            }
                          >
                            <DownloadIcon className="w-4 h-4 mr-2" />

                            {report.format}
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

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Financial Reports</CardTitle>
              <CardDescription>
                Statements, invoices, and payment history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {report.description}
                        </TableCell>
                        <TableCell>{report.period}</TableCell>
                        <TableCell className="font-mono">
                          {report.amount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              report.status === "Paid" ||
                              report.status === "Complete"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleExport(report.id, report.format)
                            }
                          >
                            <DownloadIcon className="w-4 h-4 mr-2" />

                            {report.format}
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

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance & Regulatory Reports</CardTitle>
              <CardDescription>
                Regulatory compliance status and audit trails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Check</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complianceReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {report.description}
                        </TableCell>
                        <TableCell>{report.period}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              report.status === "Compliant"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{report.lastCheck}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleExport(report.id, report.format)
                            }
                          >
                            <DownloadIcon className="w-4 h-4 mr-2" />

                            {report.format}
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
      </Tabs>
    </div>
  );
}
