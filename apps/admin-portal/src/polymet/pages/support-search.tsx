import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SearchIcon,
  FilterIcon,
  TicketIcon,
  UserIcon,
  BookOpenIcon,
  ClockIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
} from "lucide-react";
import { mockSupportTickets } from "@/polymet/data/support-mock-data";
import { mockCustomerAccounts } from "@/polymet/data/admin-mock-data";

export function SupportSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("tickets");

  // Mock search results based on search term
  const searchResults = {
    tickets: mockSupportTickets
      .filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 10),
    customers: mockCustomerAccounts
      .filter(
        (customer) =>
          customer.companyName
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          customer.accountNumber
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          customer.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 10),
    knowledge: searchTerm
      ? [
          {
            id: "kb-1",
            title: "SIP Trunk Configuration Guide",
            category: "Technical Documentation",
            url: "https://support.ringer.tel/kb/sip-trunk-config",
            excerpt:
              "Complete guide for configuring SIP trunks with authentication and routing...",
          },
          {
            id: "kb-2",
            title: "Billing and Payment FAQ",
            category: "Billing",
            url: "https://support.ringer.tel/kb/billing-faq",
            excerpt:
              "Frequently asked questions about billing, payments, and account management...",
          },
          {
            id: "kb-3",
            title: "API Integration Best Practices",
            category: "Developer Resources",
            url: "https://support.ringer.tel/kb/api-integration",
            excerpt:
              "Best practices for integrating with our REST API and webhooks...",
          },
        ]
      : [],
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      open: "destructive",
      pending: "secondary",
      resolved: "default",
      closed: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-red-100 text-red-800",
      urgent: "bg-red-200 text-red-900",
    } as const;

    return (
      <Badge
        className={
          colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800"
        }
      >
        {priority}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center space-x-2">
          <SearchIcon className="w-8 h-8 text-[#58C5C7]" />

          <span>Support Search</span>
        </h1>
        <p className="text-muted-foreground">
          Search across tickets, customers, and knowledge base
        </p>
      </div>

      {/* Search Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SearchIcon className="w-5 h-5 text-[#58C5C7]" />

            <span>Search</span>
          </CardTitle>
          <CardDescription>
            Search across all support resources and customer data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              <Input
                placeholder="Search tickets, customers, or knowledge base..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Search Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="tickets">Tickets Only</SelectItem>
                <SelectItem value="customers">Customers Only</SelectItem>
                <SelectItem value="knowledge">Knowledge Base</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchTerm && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger
              value="tickets"
              className="flex items-center space-x-2"
            >
              <TicketIcon className="w-4 h-4" />

              <span>Tickets ({searchResults.tickets.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              className="flex items-center space-x-2"
            >
              <UserIcon className="w-4 h-4" />

              <span>Customers ({searchResults.customers.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="knowledge"
              className="flex items-center space-x-2"
            >
              <BookOpenIcon className="w-4 h-4" />

              <span>Knowledge Base ({searchResults.knowledge.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Support Tickets</CardTitle>
                <CardDescription>
                  {searchResults.tickets.length} tickets found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {searchResults.tickets.length === 0 ? (
                  <div className="text-center py-8">
                    <TicketIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />

                    <p className="text-muted-foreground">
                      No tickets found matching your search
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.tickets.map((ticket) => (
                          <TableRow key={ticket.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {ticket.ticketNumber}
                                </div>
                                <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                  {ticket.title}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{ticket.customerName}</TableCell>
                            <TableCell>
                              {getStatusBadge(ticket.status)}
                            </TableCell>
                            <TableCell>
                              {getPriorityBadge(ticket.priority)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(ticket.updatedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">
                                <ExternalLinkIcon className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Customers</CardTitle>
                <CardDescription>
                  {searchResults.customers.length} customers found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {searchResults.customers.length === 0 ? (
                  <div className="text-center py-8">
                    <UserIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />

                    <p className="text-muted-foreground">
                      No customers found matching your search
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Account Number</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Monthly Spend</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.customers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">
                              {customer.companyName}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {customer.accountNumber}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="text-sm">
                                  {customer.contactName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {customer.contactEmail}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  customer.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  customer.status === "active"
                                    ? "bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                                    : ""
                                }
                              >
                                {customer.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">
                              ${customer.monthlySpend.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">
                                View Customer
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Base</CardTitle>
                <CardDescription>
                  {searchResults.knowledge.length} articles found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {searchResults.knowledge.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpenIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />

                    <p className="text-muted-foreground">
                      No knowledge base articles found
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {searchResults.knowledge.map((article) => (
                      <Card key={article.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <BookOpenIcon className="w-4 h-4 text-[#58C5C7]" />

                                <h3 className="font-semibold">
                                  {article.title}
                                </h3>
                                <Badge variant="outline">
                                  {article.category}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                {article.excerpt}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(article.url, "_blank")}
                            >
                              <ExternalLinkIcon className="w-4 h-4 mr-2" />
                              View Article
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Empty State */}
      {!searchTerm && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <SearchIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />

              <h3 className="text-lg font-semibold mb-2">
                Search Support Resources
              </h3>
              <p className="text-muted-foreground mb-4">
                Enter a search term to find tickets, customers, or knowledge
                base articles
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div className="p-4 border rounded-lg">
                  <TicketIcon className="w-8 h-8 mx-auto text-[#58C5C7] mb-2" />

                  <h4 className="font-medium mb-1">Support Tickets</h4>
                  <p className="text-xs text-muted-foreground">
                    Search by ticket number, title, or description
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <UserIcon className="w-8 h-8 mx-auto text-[#58C5C7] mb-2" />

                  <h4 className="font-medium mb-1">Customers</h4>
                  <p className="text-xs text-muted-foreground">
                    Find customers by company name or account
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <BookOpenIcon className="w-8 h-8 mx-auto text-[#58C5C7] mb-2" />

                  <h4 className="font-medium mb-1">Knowledge Base</h4>
                  <p className="text-xs text-muted-foreground">
                    Search documentation and guides
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
