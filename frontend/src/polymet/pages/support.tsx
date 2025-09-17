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
  LifeBuoyIcon,
  TicketIcon,
  PlusIcon,
  TrendingUpIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  UsersIcon,
  StarIcon,
} from "lucide-react";
import { SupportTicketList } from "@/polymet/components/support-ticket-list";
import { SupportNewTicket } from "@/polymet/components/support-new-ticket";
import { SupportTicketDetail } from "@/polymet/components/support-ticket-detail";
import {
  mockSupportTickets,
  mockSupportStats,
  mockSupportCategories,
  type SupportTicket,
} from "@/polymet/data/support-mock-data";

export function Support() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null
  );
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [tickets, setTickets] = useState(mockSupportTickets);

  const handleTicketSelect = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
  };

  const handleNewTicket = () => {
    setIsNewTicketOpen(true);
  };

  const handleTicketSubmit = (ticketData: any) => {
    // Simulate creating a new ticket
    const newTicket: SupportTicket = {
      id: `ticket-${Date.now()}`,
      ticketNumber: `SUP-2024-${String(tickets.length + 1).padStart(3, "0")}`,
      title: ticketData.title,
      description: ticketData.description,
      status: "open",
      priority: ticketData.priority,
      category: ticketData.category,
      createdBy: {
        id: "user-current",
        name: "Current User",
        email: "user@company.com",
        avatar: "https://github.com/yusufhilmi.png",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ticketData.tags,
      attachments: [], // In real app, would upload files
      conversation: [
        {
          id: `msg-${Date.now()}`,
          ticketId: `ticket-${Date.now()}`,
          author: {
            id: "user-current",
            name: "Current User",
            email: "user@company.com",
            role: "customer" as const,
            avatar: "https://github.com/yusufhilmi.png",
          },
          content: ticketData.description,
          timestamp: new Date().toISOString(),
          isInternal: false,
          type: "message" as const,
        },
      ],
    };

    setTickets((prev) => [newTicket, ...prev]);
    console.log("New ticket created:", newTicket);
  };

  const handleStatusChange = (ticketId: string, newStatus: string) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              status: newStatus as SupportTicket["status"],
              updatedAt: new Date().toISOString(),
            }
          : ticket
      )
    );

    if (selectedTicket?.id === ticketId) {
      setSelectedTicket((prev) =>
        prev ? { ...prev, status: newStatus as SupportTicket["status"] } : null
      );
    }
  };

  const handleReply = (
    ticketId: string,
    message: string,
    attachments?: File[]
  ) => {
    // In real app, would send to API and update ticket conversation
    console.log(`Reply to ticket ${ticketId}:`, message, attachments);
  };

  const getStatusStats = () => {
    const stats = tickets.reduce(
      (acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      open: stats.open || 0,
      pending: stats.pending || 0,
      resolved: stats.resolved || 0,
      closed: stats.closed || 0,
      total: tickets.length,
    };
  };

  const statusStats = getStatusStats();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <LifeBuoyIcon className="w-8 h-8 text-[#58C5C7]" />

          <div>
            <h1 className="text-3xl font-bold">Customer Support</h1>
            <p className="text-muted-foreground">
              Manage support tickets and help customers resolve their issues
            </p>
          </div>
        </div>
        <Button
          onClick={handleNewTicket}
          className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tickets">All Tickets</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tickets
                </CardTitle>
                <TicketIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statusStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  <TrendingUpIcon className="inline w-3 h-3 mr-1" />+
                  {mockSupportStats.ticketsThisMonth -
                    mockSupportStats.ticketsLastMonth}{" "}
                  from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Open Tickets
                </CardTitle>
                <AlertCircleIcon className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {statusStats.open}
                </div>
                <p className="text-xs text-muted-foreground">
                  Requires immediate attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <ClockIcon className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {statusStats.pending}
                </div>
                <p className="text-xs text-muted-foreground">
                  Awaiting customer response
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {statusStats.resolved}
                </div>
                <p className="text-xs text-muted-foreground">
                  Successfully resolved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Resolution
                </CardTitle>
                <ClockIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mockSupportStats.averageResolutionTime}
                </div>
                <p className="text-xs text-muted-foreground">
                  <TrendingUpIcon className="inline w-3 h-3 mr-1" />
                  15% faster than last month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Tickets and Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Tickets</CardTitle>
                <CardDescription>
                  Latest support requests requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tickets.slice(0, 5).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleTicketSelect(ticket)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium">
                            {ticket.ticketNumber}
                          </span>
                          <Badge
                            className={
                              ticket.status === "open"
                                ? "bg-red-100 text-red-800 hover:bg-red-100"
                                : ticket.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                  : ticket.status === "resolved"
                                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                                    : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                            }
                          >
                            {ticket.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {ticket.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ticket.createdBy.name} •{" "}
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {
                            mockSupportCategories.find(
                              (c) => c.value === ticket.category
                            )?.label
                          }
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Support Categories</CardTitle>
                <CardDescription>
                  Ticket distribution by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockSupportCategories.map((category) => (
                    <div
                      key={category.value}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-[#58C5C7] rounded-full"></div>
                        <span className="text-sm">{category.label}</span>
                      </div>
                      <Badge variant="outline">{category.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <StarIcon className="w-5 h-5 mr-2 text-yellow-500" />
                  Customer Satisfaction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {mockSupportStats.customerSatisfactionScore}/5.0
                </div>
                <p className="text-sm text-muted-foreground">
                  Based on {statusStats.resolved} resolved tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UsersIcon className="w-5 h-5 mr-2 text-[#58C5C7]" />
                  Active Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">3</div>
                <p className="text-sm text-muted-foreground">
                  Currently handling {statusStats.open + statusStats.pending}{" "}
                  tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUpIcon className="w-5 h-5 mr-2 text-green-500" />
                  This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {mockSupportStats.ticketsThisMonth}
                </div>
                <p className="text-sm text-muted-foreground">
                  +
                  {(
                    ((mockSupportStats.ticketsThisMonth -
                      mockSupportStats.ticketsLastMonth) /
                      mockSupportStats.ticketsLastMonth) *
                    100
                  ).toFixed(1)}
                  % from last month
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tickets">
          <SupportTicketList
            tickets={tickets}
            onTicketSelect={handleTicketSelect}
            onNewTicket={handleNewTicket}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resolution Time Trends</CardTitle>
                <CardDescription>
                  Average time to resolve tickets by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockSupportCategories.map((category) => (
                    <div key={category.value} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{category.label}</span>
                        <span>{Math.floor(Math.random() * 8 + 2)}h avg</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-[#58C5C7] h-2 rounded-full"
                          style={{ width: `${Math.random() * 60 + 20}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ticket Volume by Priority</CardTitle>
                <CardDescription>
                  Distribution of tickets by priority level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { priority: "urgent", count: 3, color: "bg-red-500" },
                    { priority: "high", count: 8, color: "bg-orange-500" },
                    { priority: "medium", count: 15, color: "bg-yellow-500" },
                    { priority: "low", count: 12, color: "bg-blue-500" },
                  ].map((item) => (
                    <div key={item.priority} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{item.priority}</span>
                        <span>{item.count} tickets</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`${item.color} h-2 rounded-full`}
                          style={{ width: `${(item.count / 38) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SupportNewTicket
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onSubmit={handleTicketSubmit}
      />

      {selectedTicket && (
        <SupportTicketDetail
          ticket={selectedTicket}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onStatusChange={handleStatusChange}
          onReply={handleReply}
        />
      )}
    </div>
  );
}
