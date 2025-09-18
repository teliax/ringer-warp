import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  SearchIcon,
  FilterIcon,
  PlusIcon,
  ExternalLinkIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  PaperclipIcon,
} from "lucide-react";
import {
  mockSupportTickets,
  mockSupportCategories,
  type SupportTicket,
} from "@/polymet/data/support-mock-data";

interface SupportTicketListProps {
  tickets?: SupportTicket[];
  onTicketSelect?: (ticket: SupportTicket) => void;
  onNewTicket?: () => void;
}

export function SupportTicketList({
  tickets = mockSupportTickets,
  onTicketSelect,
  onNewTicket,
}: SupportTicketListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.createdBy.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        ticket.createdBy.email
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || ticket.priority === priorityFilter;
      const matchesCategory =
        categoryFilter === "all" || ticket.category === categoryFilter;
      const matchesAssignee =
        assigneeFilter === "all" ||
        (assigneeFilter === "unassigned" && !ticket.assignedTo) ||
        (ticket.assignedTo && ticket.assignedTo.id === assigneeFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory &&
        matchesAssignee
      );
    });
  }, [
    tickets,
    searchQuery,
    statusFilter,
    priorityFilter,
    categoryFilter,
    assigneeFilter,
  ]);

  const getStatusBadge = (status: SupportTicket["status"]) => {
    const variants = {
      open: "destructive",
      pending: "secondary",
      resolved: "default",
      closed: "outline",
    } as const;

    const colors = {
      open: "bg-red-100 text-red-800 hover:bg-red-100",
      pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
      resolved: "bg-green-100 text-green-800 hover:bg-green-100",
      closed: "bg-gray-100 text-gray-800 hover:bg-gray-100",
    };

    return (
      <Badge className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: SupportTicket["priority"]) => {
    const colors = {
      low: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      medium: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
      high: "bg-orange-100 text-orange-800 hover:bg-orange-100",
      urgent: "bg-red-100 text-red-800 hover:bg-red-100",
    };

    return (
      <Badge className={colors[priority]}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return formatDate(dateString);
  };

  const uniqueAssignees = useMemo(() => {
    const assignees = new Map();
    tickets.forEach((ticket) => {
      if (ticket.assignedTo) {
        assignees.set(ticket.assignedTo.id, ticket.assignedTo);
      }
    });
    return Array.from(assignees.values());
  }, [tickets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Support Tickets</h2>
          <p className="text-muted-foreground">
            Manage and track customer support requests
          </p>
        </div>
        <Button
          onClick={onNewTicket}
          className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FilterIcon className="w-5 h-5 mr-2" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />

                <Input
                  placeholder="Search tickets, numbers, or customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
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

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {mockSupportCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {uniqueAssignees.map((assignee) => (
                  <SelectItem key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {filteredTickets.length} of {tickets.length} tickets
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setPriorityFilter("all");
                setCategoryFilter("all");
                setAssigneeFilter("all");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets ({filteredTickets.length})</CardTitle>
          <CardDescription>
            Click on any ticket to view details and conversation history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onTicketSelect?.(ticket)}
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">
                            {ticket.ticketNumber}
                          </span>
                          {ticket.attachments.length > 0 && (
                            <PaperclipIcon className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {ticket.title}
                        </div>
                        {ticket.tags.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <TagIcon className="w-3 h-3 text-muted-foreground" />

                            <div className="flex space-x-1">
                              {ticket.tags.slice(0, 2).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {ticket.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{ticket.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {mockSupportCategories.find(
                          (c) => c.value === ticket.category
                        )?.label || ticket.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={ticket.createdBy.avatar} />

                          <AvatarFallback className="text-xs">
                            {ticket.createdBy.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">
                            {ticket.createdBy.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {ticket.createdBy.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {ticket.assignedTo ? (
                        <div className="flex items-center space-x-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={ticket.assignedTo.avatar} />

                            <AvatarFallback className="text-xs">
                              {ticket.assignedTo.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {ticket.assignedTo.name}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <UserIcon className="w-4 h-4" />

                          <span className="text-sm">Unassigned</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <ClockIcon className="w-3 h-3" />

                        <span>{getTimeAgo(ticket.updatedAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTicketSelect?.(ticket);
                        }}
                      >
                        <ExternalLinkIcon className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredTickets.length === 0 && (
            <div className="text-center py-12">
              <div className="text-muted-foreground">
                No tickets found matching your filters
              </div>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                  setCategoryFilter("all");
                  setAssigneeFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
