import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeftIcon,
  SendIcon,
  PaperclipIcon,
  DownloadIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  EditIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  MessageSquareIcon,
  SettingsIcon,
} from "lucide-react";
import {
  mockSupportTickets,
  mockSupportCategories,
  type SupportTicket,
  type SupportMessage,
} from "@/polymet/data/support-mock-data";

interface SupportTicketDetailProps {
  ticket?: SupportTicket;
  isOpen?: boolean;
  onClose?: () => void;
  onStatusChange?: (ticketId: string, newStatus: string) => void;
  onReply?: (ticketId: string, message: string, attachments?: File[]) => void;
}

export function SupportTicketDetail({
  ticket = mockSupportTickets[0],
  isOpen = false,
  onClose,
  onStatusChange,
  onReply,
}: SupportTicketDetailProps) {
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);

  const getStatusBadge = (status: SupportTicket["status"]) => {
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
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return formatDate(dateString);
  };

  const handleStatusChange = (newStatus: string) => {
    onStatusChange?.(ticket.id, newStatus);
  };

  const handleReply = async () => {
    if (!replyMessage.trim()) return;

    setIsReplying(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      onReply?.(ticket.id, replyMessage, replyAttachments);
      setReplyMessage("");
      setReplyAttachments([]);
    } finally {
      setIsReplying(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setReplyAttachments((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setReplyAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getMessageTypeIcon = (type: SupportMessage["type"]) => {
    switch (type) {
      case "status-change":
        return <SettingsIcon className="w-4 h-4" />;

      case "assignment":
        return <UserIcon className="w-4 h-4" />;

      case "resolution":
        return <CheckCircleIcon className="w-4 h-4" />;

      default:
        return <MessageSquareIcon className="w-4 h-4" />;
    }
  };

  const getMessageTypeColor = (type: SupportMessage["type"]) => {
    switch (type) {
      case "status-change":
        return "text-blue-600";
      case "assignment":
        return "text-purple-600";
      case "resolution":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeftIcon className="w-4 h-4" />
              </Button>
              <div>
                <DialogTitle className="text-xl">
                  {ticket.ticketNumber}
                </DialogTitle>
                <DialogDescription className="text-base">
                  {ticket.title}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge(ticket.status)}
              {getPriorityBadge(ticket.priority)}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Ticket Info */}
            <Card className="flex-shrink-0 mb-4">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Customer
                    </Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={ticket.createdBy.avatar} />

                        <AvatarFallback>
                          {ticket.createdBy.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {ticket.createdBy.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {ticket.createdBy.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Assignee
                    </Label>
                    <div className="mt-1">
                      {ticket.assignedTo ? (
                        <div className="flex items-center space-x-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={ticket.assignedTo.avatar} />

                            <AvatarFallback>
                              {ticket.assignedTo.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {ticket.assignedTo.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {ticket.assignedTo.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Unassigned</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Created
                    </Label>
                    <div className="mt-1">
                      <div className="font-medium">
                        {formatDate(ticket.createdAt)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getTimeAgo(ticket.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {ticket.tags.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium text-muted-foreground">
                      Tags
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {ticket.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conversation */}
            <Card className="flex-1 overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center">
                  <MessageSquareIcon className="w-5 h-5 mr-2" />
                  Conversation ({ticket.conversation.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-4">
                {ticket.conversation.map((message) => (
                  <div key={message.id} className="space-y-2">
                    <div className="flex items-start space-x-3">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={message.author.avatar} />

                        <AvatarFallback>
                          {message.author.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium">
                            {message.author.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {message.author.role}
                          </Badge>
                          <div
                            className={`flex items-center space-x-1 ${getMessageTypeColor(message.type)}`}
                          >
                            {getMessageTypeIcon(message.type)}
                            <span className="text-xs">
                              {message.type.replace("-", " ")}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {getTimeAgo(message.timestamp)}
                          </span>
                        </div>

                        {message.type === "status-change" &&
                        message.metadata ? (
                          <div className="text-sm bg-muted p-3 rounded-lg">
                            Status changed from{" "}
                            <Badge variant="outline">
                              {message.metadata.oldStatus}
                            </Badge>{" "}
                            to{" "}
                            <Badge variant="outline">
                              {message.metadata.newStatus}
                            </Badge>
                          </div>
                        ) : message.type === "resolution" ? (
                          <div className="text-sm bg-green-50 border border-green-200 p-3 rounded-lg">
                            <div className="flex items-center space-x-2 text-green-800 mb-2">
                              <CheckCircleIcon className="w-4 h-4" />

                              <span className="font-medium">
                                Ticket Resolved
                              </span>
                            </div>
                            <div>{message.content}</div>
                          </div>
                        ) : (
                          <div className="text-sm bg-background border rounded-lg p-3">
                            <div className="whitespace-pre-wrap">
                              {message.content}
                            </div>
                          </div>
                        )}

                        {message.attachments &&
                          message.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {message.attachments.map((attachment) => (
                                <div
                                  key={attachment.id}
                                  className="flex items-center space-x-2 text-sm bg-muted p-2 rounded"
                                >
                                  <PaperclipIcon className="w-4 h-4" />

                                  <span>{attachment.filename}</span>
                                  <span className="text-muted-foreground">
                                    ({formatFileSize(attachment.fileSize)})
                                  </span>
                                  <Button variant="ghost" size="sm">
                                    <DownloadIcon className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                    <Separator />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Reply Section */}
            {ticket.status !== "closed" && (
              <Card className="flex-shrink-0 mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">Reply</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={4}
                  />

                  {replyAttachments.length > 0 && (
                    <div className="space-y-2">
                      <Label>Attachments ({replyAttachments.length})</Label>
                      <div className="space-y-2">
                        {replyAttachments.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-muted rounded"
                          >
                            <div className="flex items-center space-x-2">
                              <PaperclipIcon className="w-4 h-4" />

                              <span className="text-sm">{file.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAttachment(index)}
                            >
                              <XCircleIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id="reply-file-upload"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          document.getElementById("reply-file-upload")?.click()
                        }
                      >
                        <PaperclipIcon className="w-4 h-4 mr-2" />
                        Attach Files
                      </Button>
                    </div>

                    <Button
                      onClick={handleReply}
                      disabled={!replyMessage.trim() || isReplying}
                      className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                    >
                      {isReplying ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <SendIcon className="w-4 h-4 mr-2" />
                          Send Reply
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-80 pl-6 space-y-4 flex-shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Select
                    value={ticket.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Category</Label>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {mockSupportCategories.find(
                        (c) => c.value === ticket.category
                      )?.label || ticket.category}
                    </Badge>
                  </div>
                </div>

                {ticket.estimatedResolutionTime && (
                  <div>
                    <Label className="text-sm font-medium">
                      Estimated Resolution
                    </Label>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatDate(ticket.estimatedResolutionTime)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {ticket.attachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Attachments ({ticket.attachments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ticket.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <PaperclipIcon className="w-4 h-4 flex-shrink-0" />

                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {attachment.filename}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.fileSize)}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <DownloadIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
