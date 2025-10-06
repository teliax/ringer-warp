export interface SupportTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category:
    | "technical"
    | "billing"
    | "account"
    | "feature-request"
    | "bug-report"
    | "general";
  createdBy: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  tags: string[];
  attachments: SupportAttachment[];
  conversation: SupportMessage[];
  estimatedResolutionTime?: string;
  actualResolutionTime?: string;
}

export interface SupportAttachment {
  id: string;
  filename: string;
  fileSize: number;
  fileType: string;
  uploadedBy: string;
  uploadedAt: string;
  downloadUrl: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  author: {
    id: string;
    name: string;
    email: string;
    role: "customer" | "support" | "admin";
    avatar?: string;
  };
  content: string;
  timestamp: string;
  isInternal: boolean;
  attachments?: SupportAttachment[];
  type: "message" | "status-change" | "assignment" | "resolution";
  metadata?: {
    oldStatus?: string;
    newStatus?: string;
    assignedTo?: string;
    resolvedBy?: string;
  };
}

export interface SupportStats {
  totalTickets: number;
  openTickets: number;
  pendingTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResolutionTime: string;
  customerSatisfactionScore: number;
  ticketsThisMonth: number;
  ticketsLastMonth: number;
}

export const mockSupportTickets: SupportTicket[] = [
  {
    id: "ticket-001",
    ticketNumber: "SUP-2024-001",
    title: "Unable to receive incoming calls on DID +1-555-0123",
    description:
      "We've been experiencing issues with incoming calls to our main number +1-555-0123. Calls are going straight to voicemail without ringing. This started yesterday around 3 PM EST.",
    status: "open",
    priority: "high",
    category: "technical",
    createdBy: {
      id: "user-001",
      name: "John Smith",
      email: "john.smith@acmecorp.com",
      avatar: "https://github.com/yusufhilmi.png",
    },
    assignedTo: {
      id: "support-001",
      name: "Sarah Johnson",
      email: "sarah.johnson@ringer.tel",
      avatar: "https://github.com/kdrnp.png",
    },
    createdAt: "2024-09-15T14:30:00Z",
    updatedAt: "2024-09-16T09:15:00Z",
    tags: ["did", "incoming-calls", "voicemail", "urgent"],
    attachments: [
      {
        id: "att-001",
        filename: "call_logs_screenshot.png",
        fileSize: 245760,
        fileType: "image/png",
        uploadedBy: "user-001",
        uploadedAt: "2024-09-15T14:35:00Z",
        downloadUrl: "/api/attachments/att-001",
      },
    ],

    conversation: [
      {
        id: "msg-001",
        ticketId: "ticket-001",
        author: {
          id: "user-001",
          name: "John Smith",
          email: "john.smith@acmecorp.com",
          role: "customer",
          avatar: "https://github.com/yusufhilmi.png",
        },
        content:
          "We've been experiencing issues with incoming calls to our main number +1-555-0123. Calls are going straight to voicemail without ringing. This started yesterday around 3 PM EST. I've attached a screenshot of our call logs.",
        timestamp: "2024-09-15T14:30:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-002",
        ticketId: "ticket-001",
        author: {
          id: "support-001",
          name: "Sarah Johnson",
          email: "sarah.johnson@ringer.tel",
          role: "support",
          avatar: "https://github.com/kdrnp.png",
        },
        content:
          "Thank you for reporting this issue, John. I've assigned this ticket to myself and will investigate immediately. Can you please confirm if outbound calls are working normally from this number?",
        timestamp: "2024-09-15T15:45:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-003",
        ticketId: "ticket-001",
        author: {
          id: "user-001",
          name: "John Smith",
          email: "john.smith@acmecorp.com",
          role: "customer",
          avatar: "https://github.com/yusufhilmi.png",
        },
        content:
          "Yes, outbound calls are working fine. It's only incoming calls that are affected.",
        timestamp: "2024-09-15T16:20:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-004",
        ticketId: "ticket-001",
        author: {
          id: "support-001",
          name: "Sarah Johnson",
          email: "sarah.johnson@ringer.tel",
          role: "support",
          avatar: "https://github.com/kdrnp.png",
        },
        content:
          "I've checked your trunk configuration and found a routing issue. Working on a fix now. ETA: 2 hours.",
        timestamp: "2024-09-16T09:15:00Z",
        isInternal: false,
        type: "message",
      },
    ],

    estimatedResolutionTime: "2024-09-16T12:00:00Z",
  },
  {
    id: "ticket-002",
    ticketNumber: "SUP-2024-002",
    title: "Billing discrepancy for September invoice",
    description:
      "I noticed a charge of $127.50 on my September invoice that doesn't match our usage. Can you please review and explain this charge?",
    status: "resolved",
    priority: "medium",
    category: "billing",
    createdBy: {
      id: "user-002",
      name: "Emily Davis",
      email: "emily.davis@techstartup.io",
      avatar: "https://github.com/yahyabedirhan.png",
    },
    assignedTo: {
      id: "support-002",
      name: "Mike Chen",
      email: "mike.chen@ringer.tel",
      avatar: "https://github.com/denizbuyuktas.png",
    },
    createdAt: "2024-09-10T10:20:00Z",
    updatedAt: "2024-09-12T16:30:00Z",
    resolvedAt: "2024-09-12T16:30:00Z",
    tags: ["billing", "invoice", "charges"],
    attachments: [
      {
        id: "att-002",
        filename: "september_invoice.pdf",
        fileSize: 89432,
        fileType: "application/pdf",
        uploadedBy: "user-002",
        uploadedAt: "2024-09-10T10:25:00Z",
        downloadUrl: "/api/attachments/att-002",
      },
    ],

    conversation: [
      {
        id: "msg-005",
        ticketId: "ticket-002",
        author: {
          id: "user-002",
          name: "Emily Davis",
          email: "emily.davis@techstartup.io",
          role: "customer",
          avatar: "https://github.com/yahyabedirhan.png",
        },
        content:
          "I noticed a charge of $127.50 on my September invoice that doesn't match our usage. Can you please review and explain this charge? I've attached the invoice for reference.",
        timestamp: "2024-09-10T10:20:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-006",
        ticketId: "ticket-002",
        author: {
          id: "support-002",
          name: "Mike Chen",
          email: "mike.chen@ringer.tel",
          role: "support",
          avatar: "https://github.com/denizbuyuktas.png",
        },
        content:
          "Hi Emily, I'll review your invoice and usage records. Let me investigate this charge and get back to you within 24 hours.",
        timestamp: "2024-09-10T11:15:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-007",
        ticketId: "ticket-002",
        author: {
          id: "support-002",
          name: "Mike Chen",
          email: "mike.chen@ringer.tel",
          role: "support",
          avatar: "https://github.com/denizbuyuktas.png",
        },
        content:
          "I've identified the charge - it's for international calls to the UK made on September 5th and 7th. The calls totaled 85 minutes at $1.50/minute. I can provide detailed CDRs if needed.",
        timestamp: "2024-09-12T14:20:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-008",
        ticketId: "ticket-002",
        author: {
          id: "user-002",
          name: "Emily Davis",
          email: "emily.davis@techstartup.io",
          role: "customer",
          avatar: "https://github.com/yahyabedirhan.png",
        },
        content:
          "That makes sense! I forgot about those calls to our London office. Thank you for the clarification.",
        timestamp: "2024-09-12T16:30:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-009",
        ticketId: "ticket-002",
        author: {
          id: "support-002",
          name: "Mike Chen",
          email: "mike.chen@ringer.tel",
          role: "support",
          avatar: "https://github.com/denizbuyuktas.png",
        },
        content:
          "Glad I could help clarify! Marking this ticket as resolved. Feel free to reach out if you have any other questions.",
        timestamp: "2024-09-12T16:30:00Z",
        isInternal: false,
        type: "resolution",
        metadata: {
          oldStatus: "open",
          newStatus: "resolved",
          resolvedBy: "support-002",
        },
      },
    ],

    estimatedResolutionTime: "2024-09-11T10:20:00Z",
    actualResolutionTime: "2024-09-12T16:30:00Z",
  },
  {
    id: "ticket-003",
    ticketNumber: "SUP-2024-003",
    title: "Request for API documentation and webhook setup",
    description:
      "We're integrating with your API and need comprehensive documentation for webhook events. Also need help setting up webhooks for call events.",
    status: "pending",
    priority: "medium",
    category: "technical",
    createdBy: {
      id: "user-003",
      name: "Alex Rodriguez",
      email: "alex.rodriguez@devcompany.com",
      avatar: "https://github.com/shoaibux1.png",
    },
    assignedTo: {
      id: "support-003",
      name: "Lisa Wang",
      email: "lisa.wang@ringer.tel",
      avatar: "https://github.com/polymet-ai.png",
    },
    createdAt: "2024-09-14T09:00:00Z",
    updatedAt: "2024-09-15T13:45:00Z",
    tags: ["api", "webhooks", "documentation", "integration"],
    attachments: [],
    conversation: [
      {
        id: "msg-010",
        ticketId: "ticket-003",
        author: {
          id: "user-003",
          name: "Alex Rodriguez",
          email: "alex.rodriguez@devcompany.com",
          role: "customer",
          avatar: "https://github.com/shoaibux1.png",
        },
        content:
          "We're integrating with your API and need comprehensive documentation for webhook events. Also need help setting up webhooks for call events like call_started, call_ended, call_failed.",
        timestamp: "2024-09-14T09:00:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-011",
        ticketId: "ticket-003",
        author: {
          id: "support-003",
          name: "Lisa Wang",
          email: "lisa.wang@ringer.tel",
          role: "support",
          avatar: "https://github.com/polymet-ai.png",
        },
        content:
          "Hi Alex! I'll send you our webhook documentation and can schedule a call to help with the setup. What's your preferred time zone for a technical consultation?",
        timestamp: "2024-09-14T10:30:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-012",
        ticketId: "ticket-003",
        author: {
          id: "user-003",
          name: "Alex Rodriguez",
          email: "alex.rodriguez@devcompany.com",
          role: "customer",
          avatar: "https://github.com/shoaibux1.png",
        },
        content:
          "EST would be perfect. I'm available Tuesday or Wednesday afternoon.",
        timestamp: "2024-09-15T13:45:00Z",
        isInternal: false,
        type: "message",
      },
    ],

    estimatedResolutionTime: "2024-09-17T17:00:00Z",
  },
  {
    id: "ticket-004",
    ticketNumber: "SUP-2024-004",
    title: "Feature request: Call recording with transcription",
    description:
      "Would like to request a feature for automatic call recording with AI-powered transcription for compliance purposes.",
    status: "open",
    priority: "low",
    category: "feature-request",
    createdBy: {
      id: "user-004",
      name: "Maria Garcia",
      email: "maria.garcia@legalfirm.com",
      avatar: "https://github.com/yusufhilmi.png",
    },
    createdAt: "2024-09-16T08:15:00Z",
    updatedAt: "2024-09-16T08:15:00Z",
    tags: ["feature-request", "call-recording", "transcription", "compliance"],
    attachments: [],
    conversation: [
      {
        id: "msg-013",
        ticketId: "ticket-004",
        author: {
          id: "user-004",
          name: "Maria Garcia",
          email: "maria.garcia@legalfirm.com",
          role: "customer",
          avatar: "https://github.com/yusufhilmi.png",
        },
        content:
          "Would like to request a feature for automatic call recording with AI-powered transcription for compliance purposes. This would be extremely valuable for our legal practice.",
        timestamp: "2024-09-16T08:15:00Z",
        isInternal: false,
        type: "message",
      },
    ],
  },
  {
    id: "ticket-005",
    ticketNumber: "SUP-2024-005",
    title: "SMS delivery failures to Verizon numbers",
    description:
      "We're experiencing SMS delivery failures specifically to Verizon wireless numbers. Messages show as sent but customers report not receiving them.",
    status: "open",
    priority: "urgent",
    category: "technical",
    createdBy: {
      id: "user-005",
      name: "David Kim",
      email: "david.kim@retailchain.com",
      avatar: "https://github.com/kdrnp.png",
    },
    assignedTo: {
      id: "support-001",
      name: "Sarah Johnson",
      email: "sarah.johnson@ringer.tel",
      avatar: "https://github.com/kdrnp.png",
    },
    createdAt: "2024-09-16T11:30:00Z",
    updatedAt: "2024-09-16T12:45:00Z",
    tags: ["sms", "delivery-failure", "verizon", "messaging"],
    attachments: [
      {
        id: "att-003",
        filename: "sms_delivery_report.csv",
        fileSize: 15680,
        fileType: "text/csv",
        uploadedBy: "user-005",
        uploadedAt: "2024-09-16T11:35:00Z",
        downloadUrl: "/api/attachments/att-003",
      },
    ],

    conversation: [
      {
        id: "msg-014",
        ticketId: "ticket-005",
        author: {
          id: "user-005",
          name: "David Kim",
          email: "david.kim@retailchain.com",
          role: "customer",
          avatar: "https://github.com/kdrnp.png",
        },
        content:
          "We're experiencing SMS delivery failures specifically to Verizon wireless numbers. Messages show as sent but customers report not receiving them. I've attached our delivery report from the past week.",
        timestamp: "2024-09-16T11:30:00Z",
        isInternal: false,
        type: "message",
      },
      {
        id: "msg-015",
        ticketId: "ticket-005",
        author: {
          id: "support-001",
          name: "Sarah Johnson",
          email: "sarah.johnson@ringer.tel",
          role: "support",
          avatar: "https://github.com/kdrnp.png",
        },
        content:
          "This is a high priority issue. I'm escalating to our carrier relations team immediately. We'll investigate the Verizon delivery path and provide an update within 2 hours.",
        timestamp: "2024-09-16T12:45:00Z",
        isInternal: false,
        type: "message",
      },
    ],

    estimatedResolutionTime: "2024-09-16T18:00:00Z",
  },
];

export const mockSupportStats: SupportStats = {
  totalTickets: 147,
  openTickets: 23,
  pendingTickets: 8,
  resolvedTickets: 89,
  closedTickets: 27,
  averageResolutionTime: "4.2 hours",
  customerSatisfactionScore: 4.7,
  ticketsThisMonth: 31,
  ticketsLastMonth: 28,
};

export const mockSupportCategories = [
  { value: "technical", label: "Technical Support", count: 45 },
  { value: "billing", label: "Billing & Payments", count: 28 },
  { value: "account", label: "Account Management", count: 19 },
  { value: "feature-request", label: "Feature Requests", count: 15 },
  { value: "bug-report", label: "Bug Reports", count: 12 },
  { value: "general", label: "General Inquiry", count: 28 },
];

export const mockSupportAgents = [
  {
    id: "support-001",
    name: "Sarah Johnson",
    email: "sarah.johnson@ringer.tel",
    avatar: "https://github.com/kdrnp.png",
    role: "Senior Support Engineer",
    activeTickets: 8,
    resolvedTickets: 156,
  },
  {
    id: "support-002",
    name: "Mike Chen",
    email: "mike.chen@ringer.tel",
    avatar: "https://github.com/denizbuyuktas.png",
    role: "Billing Specialist",
    activeTickets: 5,
    resolvedTickets: 203,
  },
  {
    id: "support-003",
    name: "Lisa Wang",
    email: "lisa.wang@ringer.tel",
    avatar: "https://github.com/polymet-ai.png",
    role: "Technical Integration Specialist",
    activeTickets: 12,
    resolvedTickets: 89,
  },
];
