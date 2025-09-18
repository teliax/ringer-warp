export interface CallRecord {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  duration: number;
  status: "completed" | "failed" | "busy" | "no-answer";
  cost: number;
  trunkId: string;
  direction: "inbound" | "outbound";
}

export interface CdrRecord {
  id: string;
  start_stamp: string;
  progress_stamp?: string;
  answer_stamp?: string;
  end_stamp: string;
  account: string;
  cpn: string; // Calling Party Number
  cpn_ocn?: string; // Calling Party OCN
  cpn_lrn?: string; // Calling Party LRN
  cpn_ror?: string; // Calling Party ROR
  cpn_lata?: string; // Calling Party LATA
  cpn_locality?: string; // Calling Party Locality
  dni: string; // Dialed Number Identification
  dni_ocn?: string; // Dialed Number OCN
  dni_lrn?: string; // Dialed Number LRN
  dni_ror?: string; // Dialed Number ROR
  dni_lata?: string; // Dialed Number LATA
  dni_locality?: string; // Dialed Number Locality
  raw_seconds: number;
  billed_seconds: number;
  rate: number;
  cost: number;
  direction: "inbound" | "outbound";
  zone: string;
  cic?: string; // Carrier Identification Code
  normalized: string;
  billed: boolean;
  disposition: "ANSWERED" | "NO_ANSWER" | "BUSY" | "FAILED" | "CONGESTION";
  status: "completed" | "failed" | "busy" | "no-answer" | "congestion";
  term_code?: string;
  cnam?: string; // Caller Name
  callid: string;
  orig_ip: string;
  term_ip?: string;
}

export interface SipTrunk {
  id: string;
  name: string;
  status: "active" | "inactive" | "maintenance";
  ipAddress: string;
  port: number;
  whitelistedIps: string[];
  codecs: string[];
  maxConcurrentCalls: number;
  currentCalls: number;
  createdAt: string;
  lastActivity: string;
}

export interface DidNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  city: string;
  state: string;
  country: string;
  numberType: "local" | "tollfree";
  status: "active" | "inactive" | "porting";
  monthlyRate: number;
  setupFee: number;
  messagingEnabled: boolean;
  e911Enabled: boolean;
  assignedTrunk?: string;
  portingDate?: string;
  purchaseDate: string;
  cnam?: string;
  monthlyCallCount?: number;
  monthlyMessageCount?: number;
  lastActivity?: string;
}

export interface Invoice {
  id: string;
  period: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  dueDate: string;
  items: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
}

export interface UsageMetrics {
  totalCalls: number;
  totalMinutes: number;
  totalCost: number;
  successRate: number;
  averageCallDuration: number;
  peakConcurrentCalls: number;
  dailyStats: {
    date: string;
    calls: number;
    minutes: number;
    cost: number;
  }[];
}

export interface A2PBrand {
  id: string;
  name: string;
  entityType: "PRIVATE_PROFIT" | "PUBLIC_PROFIT" | "NON_PROFIT" | "GOVERNMENT";
  vertical: string;
  website: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  registrationDate: string;
  approvalDate?: string;
  ein?: string;
  stockSymbol?: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  contactInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    title: string;
  };
  brandScore?: number;
  trustScore?: number;
}

export interface A2PCampaign {
  id: string;
  brandId: string;
  name: string;
  description: string;
  useCase: "MARKETING" | "MIXED" | "LOW_VOLUME" | "STANDARD" | "SPECIAL";
  messageFlow: string;
  helpMessage?: string;
  optInKeywords: string[];
  optOutKeywords: string[];
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  registrationDate: string;
  approvalDate?: string;
  monthlyMessageVolume: number;
  dailyMessageVolume: number;
  assignedNumbers: string[];
  messagesSent: number;
  messagesDelivered: number;
  optOuts: number;
  violations: number;
}

export interface MessagingNumber {
  id: string;
  phoneNumber: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  campaignId?: string;
  brandId?: string;
  assignedDate?: string;
  messagesSent: number;
  messagesReceived: number;
  lastActivity?: string;
}

export interface TeliqueLogRecord {
  id: string;
  timestamp: string;
  clientIp: string;
  domain: string;
  customerRule: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  statusCode: number;
  responseSize: number;
  userAgent: string;
  latencySeconds: number;
  serviceType: "lrn" | "cic" | "dno" | "cnam" | "stir_shaken" | "lsms" | "lerg";
  isSuspicious: boolean;
  backendService: string;
  cost?: number;
}

export interface TeliqueUsageMetrics {
  totalQueries: number;
  totalCost: number;
  averageLatency: number;
  successRate: number;
  dailyStats: {
    date: string;
    queries: number;
    cost: number;
    averageLatency: number;
    errorRate: number;
  }[];
  serviceBreakdown: {
    serviceType: string;
    queries: number;
    cost: number;
    averageLatency: number;
  }[];
}

// Mock data
export const mockCallRecords: CallRecord[] = [
  {
    id: "cdr-001",
    timestamp: "2024-01-15T10:30:00Z",
    from: "+1234567890",
    to: "+0987654321",
    duration: 180,
    status: "completed",
    cost: 0.025,
    trunkId: "trunk-001",
    direction: "outbound",
  },
  {
    id: "cdr-002",
    timestamp: "2024-01-15T10:25:00Z",
    from: "+1555123456",
    to: "+1234567890",
    duration: 0,
    status: "failed",
    cost: 0.01,
    trunkId: "trunk-002",
    direction: "inbound",
  },
  {
    id: "cdr-003",
    timestamp: "2024-01-15T10:20:00Z",
    from: "+1234567890",
    to: "+1999888777",
    duration: 420,
    status: "completed",
    cost: 0.058,
    trunkId: "trunk-001",
    direction: "outbound",
  },
];

// Generate comprehensive CDR mock data
const generateCdrRecords = (): CdrRecord[] => {
  const records: CdrRecord[] = [];
  const accounts = ["ACC001", "ACC002", "ACC003", "ACC004", "ACC005"];
  const zones = ["US-EAST", "US-WEST", "US-CENTRAL", "INTL-CA", "INTL-UK"];
  const dispositions: CdrRecord["disposition"][] = [
    "ANSWERED",
    "NO_ANSWER",
    "BUSY",
    "FAILED",
    "CONGESTION",
  ];

  const statuses: CdrRecord["status"][] = [
    "completed",
    "failed",
    "busy",
    "no-answer",
    "congestion",
  ];

  const directions: CdrRecord["direction"][] = ["inbound", "outbound"];
  const origIps = [
    "192.168.1.100",
    "192.168.1.101",
    "192.168.1.102",
    "203.0.113.1",
    "203.0.113.2",
  ];

  const termIps = [
    "198.51.100.1",
    "198.51.100.2",
    "203.0.113.10",
    "203.0.113.11",
  ];

  for (let i = 1; i <= 50; i++) {
    const startTime = new Date(
      Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
    );
    const answerTime = new Date(startTime.getTime() + Math.random() * 30000); // 0-30 seconds
    const endTime = new Date(answerTime.getTime() + Math.random() * 600000); // 0-10 minutes
    const rawSeconds = Math.floor(
      (endTime.getTime() - answerTime.getTime()) / 1000
    );
    const billedSeconds = Math.ceil(rawSeconds / 6) * 6; // 6-second billing increments
    const rate = 0.01 + Math.random() * 0.05; // $0.01 - $0.06 per minute
    const cost = (billedSeconds / 60) * rate;
    const disposition =
      dispositions[Math.floor(Math.random() * dispositions.length)];
    const status = statuses[dispositions.indexOf(disposition)];
    const direction = directions[Math.floor(Math.random() * directions.length)];

    const cpnArea = Math.floor(Math.random() * 900) + 100;
    const cpnExchange = Math.floor(Math.random() * 900) + 100;
    const cpnNumber = Math.floor(Math.random() * 9000) + 1000;
    const cpn = `+1${cpnArea}${cpnExchange}${cpnNumber}`;

    const dniArea = Math.floor(Math.random() * 900) + 100;
    const dniExchange = Math.floor(Math.random() * 900) + 100;
    const dniNumber = Math.floor(Math.random() * 9000) + 1000;
    const dni = `+1${dniArea}${dniExchange}${dniNumber}`;

    records.push({
      id: `cdr-${String(i).padStart(6, "0")}`,
      start_stamp: startTime.toISOString(),
      progress_stamp: new Date(startTime.getTime() + 1000).toISOString(),
      answer_stamp:
        disposition === "ANSWERED" ? answerTime.toISOString() : undefined,
      end_stamp: endTime.toISOString(),
      account: accounts[Math.floor(Math.random() * accounts.length)],
      cpn,
      cpn_ocn: `OCN${Math.floor(Math.random() * 9000) + 1000}`,
      cpn_lrn: `+1${cpnArea}${Math.floor(Math.random() * 900) + 100}0000`,
      cpn_ror: Math.random() > 0.5 ? "1" : "0",
      cpn_lata: `${Math.floor(Math.random() * 900) + 100}`,
      cpn_locality: [
        "New York",
        "Los Angeles",
        "Chicago",
        "Houston",
        "Phoenix",
      ][Math.floor(Math.random() * 5)],
      dni,
      dni_ocn: `OCN${Math.floor(Math.random() * 9000) + 1000}`,
      dni_lrn: `+1${dniArea}${Math.floor(Math.random() * 900) + 100}0000`,
      dni_ror: Math.random() > 0.5 ? "1" : "0",
      dni_lata: `${Math.floor(Math.random() * 900) + 100}`,
      dni_locality: ["San Francisco", "Miami", "Seattle", "Denver", "Atlanta"][
        Math.floor(Math.random() * 5)
      ],

      raw_seconds: rawSeconds,
      billed_seconds: billedSeconds,
      rate: parseFloat(rate.toFixed(4)),
      cost: parseFloat(cost.toFixed(4)),
      direction,
      zone: zones[Math.floor(Math.random() * zones.length)],
      cic: `CIC${Math.floor(Math.random() * 9000) + 1000}`,
      normalized: dni.replace(/\+1/, ""),
      billed: Math.random() > 0.1, // 90% billed
      disposition,
      status,
      term_code:
        disposition === "FAILED"
          ? `ERR${Math.floor(Math.random() * 900) + 100}`
          : undefined,
      cnam:
        Math.random() > 0.3
          ? [
              "WIRELESS CALLER",
              "BUSINESS LINE",
              "RESIDENTIAL",
              "TOLL FREE",
              "UNKNOWN",
            ][Math.floor(Math.random() * 5)]
          : undefined,
      callid: `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orig_ip: origIps[Math.floor(Math.random() * origIps.length)],
      term_ip:
        Math.random() > 0.2
          ? termIps[Math.floor(Math.random() * termIps.length)]
          : undefined,
    });
  }

  return records.sort(
    (a, b) =>
      new Date(b.start_stamp).getTime() - new Date(a.start_stamp).getTime()
  );
};

export const mockCdrRecords: CdrRecord[] = generateCdrRecords();

export const mockSipTrunks: SipTrunk[] = [
  {
    id: "trunk-001",
    name: "Primary SIP Trunk",
    status: "active",
    ipAddress: "192.168.1.100",
    port: 5060,
    whitelistedIps: ["203.0.113.1", "203.0.113.2"],
    codecs: ["G.711", "G.729", "G.722"],
    maxConcurrentCalls: 100,
    currentCalls: 23,
    createdAt: "2024-01-01T00:00:00Z",
    lastActivity: "2024-01-15T10:30:00Z",
  },
  {
    id: "trunk-002",
    name: "Backup SIP Trunk",
    status: "active",
    ipAddress: "192.168.1.101",
    port: 5060,
    whitelistedIps: ["203.0.113.3"],
    codecs: ["G.711", "G.729"],
    maxConcurrentCalls: 50,
    currentCalls: 5,
    createdAt: "2024-01-01T00:00:00Z",
    lastActivity: "2024-01-15T09:45:00Z",
  },
  {
    id: "trunk-003",
    name: "West Coast Trunk",
    status: "active",
    ipAddress: "192.168.1.102",
    port: 5060,
    whitelistedIps: ["203.0.113.4", "203.0.113.5"],
    codecs: ["G.711", "G.729"],
    maxConcurrentCalls: 75,
    currentCalls: 12,
    createdAt: "2024-02-01T00:00:00Z",
    lastActivity: "2024-03-15T16:45:00Z",
  },
];

export const mockDidNumbers: DidNumber[] = [
  {
    id: "did-001",
    phoneNumber: "+12125551234",
    friendlyName: "Main Office Line",
    city: "New York",
    state: "NY",
    country: "US",
    numberType: "local",
    status: "active",
    monthlyRate: 1.5,
    setupFee: 0.5,
    messagingEnabled: true,
    e911Enabled: true,
    assignedTrunk: "trunk-001",
    purchaseDate: "2024-01-15",
    cnam: "Ringer Inc",
    monthlyCallCount: 1234,
    monthlyMessageCount: 567,
    lastActivity: "2024-03-15T10:30:00Z",
  },
  {
    id: "did-002",
    phoneNumber: "+18005551234",
    friendlyName: "Customer Support",
    city: "Nationwide",
    state: "US",
    country: "US",
    numberType: "tollfree",
    status: "active",
    monthlyRate: 2.0,
    setupFee: 1.0,
    messagingEnabled: false,
    e911Enabled: false,
    assignedTrunk: "trunk-002",
    purchaseDate: "2024-02-01",
    cnam: "Ringer Support",
    monthlyCallCount: 2456,
    monthlyMessageCount: 0,
    lastActivity: "2024-03-15T14:22:00Z",
  },
  {
    id: "did-003",
    phoneNumber: "+13105559876",
    city: "Los Angeles",
    state: "CA",
    country: "US",
    numberType: "local",
    status: "porting",
    monthlyRate: 1.5,
    setupFee: 0.5,
    messagingEnabled: true,
    e911Enabled: true,
    portingDate: "2024-03-15",
    purchaseDate: "2024-03-01",
    cnam: "Ringer LA",
    monthlyCallCount: 0,
    monthlyMessageCount: 0,
  },
  {
    id: "did-004",
    phoneNumber: "+14155552468",
    friendlyName: "Sales Team",
    city: "San Francisco",
    state: "CA",
    country: "US",
    numberType: "local",
    status: "active",
    monthlyRate: 1.5,
    setupFee: 0.5,
    messagingEnabled: true,
    e911Enabled: true,
    assignedTrunk: "trunk-001",
    purchaseDate: "2024-01-20",
    cnam: "Ringer Sales",
    monthlyCallCount: 890,
    monthlyMessageCount: 234,
    lastActivity: "2024-03-15T09:15:00Z",
  },
  {
    id: "did-005",
    phoneNumber: "+18885551357",
    friendlyName: "Technical Support",
    city: "Nationwide",
    state: "US",
    country: "US",
    numberType: "tollfree",
    status: "active",
    monthlyRate: 2.0,
    setupFee: 1.0,
    messagingEnabled: true,
    e911Enabled: false,
    assignedTrunk: "trunk-001",
    purchaseDate: "2024-02-10",
    cnam: "Ringer Tech",
    monthlyCallCount: 1567,
    monthlyMessageCount: 89,
    lastActivity: "2024-03-15T16:45:00Z",
  },
  {
    id: "did-006",
    phoneNumber: "+17135553691",
    city: "Houston",
    state: "TX",
    country: "US",
    numberType: "local",
    status: "inactive",
    monthlyRate: 1.5,
    setupFee: 0.5,
    messagingEnabled: false,
    e911Enabled: true,
    purchaseDate: "2024-02-25",
    cnam: "Ringer Houston",
    monthlyCallCount: 0,
    monthlyMessageCount: 0,
    lastActivity: "2024-02-28T12:00:00Z",
  },
  {
    id: "did-007",
    phoneNumber: "+13055554820",
    friendlyName: "Miami Office",
    city: "Miami",
    state: "FL",
    country: "US",
    numberType: "local",
    status: "active",
    monthlyRate: 1.5,
    setupFee: 0.5,
    messagingEnabled: true,
    e911Enabled: true,
    assignedTrunk: "trunk-002",
    purchaseDate: "2024-03-01",
    cnam: "Ringer Miami",
    monthlyCallCount: 456,
    monthlyMessageCount: 123,
    lastActivity: "2024-03-15T11:30:00Z",
  },
  {
    id: "did-008",
    phoneNumber: "+18775559264",
    city: "Nationwide",
    state: "US",
    country: "US",
    numberType: "tollfree",
    status: "active",
    monthlyRate: 2.0,
    setupFee: 1.0,
    messagingEnabled: false,
    e911Enabled: false,
    assignedTrunk: "trunk-001",
    purchaseDate: "2024-01-30",
    cnam: "Ringer Corp",
    monthlyCallCount: 678,
    monthlyMessageCount: 0,
    lastActivity: "2024-03-15T13:20:00Z",
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: "inv-001",
    period: "January 2024",
    amount: 245.67,
    status: "paid",
    dueDate: "2024-02-01",
    items: [
      { description: "DID Numbers (3)", quantity: 3, rate: 2.5, amount: 7.5 },
      {
        description: "Outbound Minutes",
        quantity: 1250,
        rate: 0.015,
        amount: 18.75,
      },
      {
        description: "Inbound Minutes",
        quantity: 890,
        rate: 0.012,
        amount: 10.68,
      },
      {
        description: "SIP Trunk Monthly",
        quantity: 2,
        rate: 25.0,
        amount: 50.0,
      },
    ],
  },
  {
    id: "inv-002",
    period: "December 2023",
    amount: 198.43,
    status: "paid",
    dueDate: "2024-01-01",
    items: [
      { description: "DID Numbers (2)", quantity: 2, rate: 2.5, amount: 5.0 },
      {
        description: "Outbound Minutes",
        quantity: 980,
        rate: 0.015,
        amount: 14.7,
      },
      {
        description: "SIP Trunk Monthly",
        quantity: 1,
        rate: 25.0,
        amount: 25.0,
      },
    ],
  },
];

export const mockUsageMetrics: UsageMetrics = {
  totalCalls: 12345,
  totalMinutes: 45678,
  totalCost: 2847.5,
  successRate: 99.2,
  averageCallDuration: 180,
  peakConcurrentCalls: 89,
  dailyStats: [
    { date: "2024-01-08", calls: 89, minutes: 1340, cost: 20.1 },
    { date: "2024-01-09", calls: 156, minutes: 2280, cost: 34.2 },
    { date: "2024-01-10", calls: 134, minutes: 1950, cost: 29.25 },
    { date: "2024-01-11", calls: 178, minutes: 2670, cost: 40.05 },
    { date: "2024-01-12", calls: 145, minutes: 2180, cost: 32.7 },
    { date: "2024-01-13", calls: 98, minutes: 1450, cost: 21.75 },
    { date: "2024-01-14", calls: 112, minutes: 1680, cost: 25.2 },
  ],
};

export const mockUser = {
  id: "user-001",
  name: "John Smith",
  email: "john.smith@company.com",
  role: "admin",
  company: "TechCorp Communications",
  avatar: "https://github.com/yusufhilmi.png",
};

export const mockA2PBrands: A2PBrand[] = [
  {
    id: "brand-001",
    name: "TechCorp Communications",
    entityType: "PRIVATE_PROFIT",
    vertical: "TECHNOLOGY",
    website: "https://techcorp.com",
    status: "APPROVED",
    registrationDate: "2024-01-15T00:00:00Z",
    approvalDate: "2024-01-20T00:00:00Z",
    ein: "12-3456789",
    address: {
      street: "123 Tech Street",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
    },
    contactInfo: {
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@techcorp.com",
      phone: "+14155551234",
      title: "CTO",
    },
    brandScore: 85,
    trustScore: 92,
  },
  {
    id: "brand-002",
    name: "Ringer Support Services",
    entityType: "PRIVATE_PROFIT",
    vertical: "CUSTOMER_SERVICE",
    website: "https://ringer.com/support",
    status: "PENDING",
    registrationDate: "2024-03-01T00:00:00Z",
    address: {
      street: "456 Support Ave",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
    },
    contactInfo: {
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.johnson@ringer.com",
      phone: "+15125559876",
      title: "Support Director",
    },
  },
];

export const mockA2PCampaigns: A2PCampaign[] = [
  {
    id: "campaign-001",
    brandId: "brand-001",
    name: "Customer Notifications",
    description:
      "Automated notifications for account updates, service alerts, and important communications",
    useCase: "MIXED",
    messageFlow:
      "Customer receives notifications about account status, service updates, billing reminders, and can reply for support",
    helpMessage: "Reply HELP for assistance or STOP to opt out",
    optInKeywords: ["START", "YES", "SUBSCRIBE"],
    optOutKeywords: ["STOP", "UNSUBSCRIBE", "QUIT"],
    status: "APPROVED",
    registrationDate: "2024-01-20T00:00:00Z",
    approvalDate: "2024-01-25T00:00:00Z",
    monthlyMessageVolume: 10000,
    dailyMessageVolume: 500,
    assignedNumbers: ["+14155551234", "+13055554820"],
    messagesSent: 8543,
    messagesDelivered: 8421,
    optOuts: 23,
    violations: 0,
  },
  {
    id: "campaign-002",
    brandId: "brand-001",
    name: "Marketing Promotions",
    description:
      "Promotional messages for new features, special offers, and product updates",
    useCase: "MARKETING",
    messageFlow:
      "Customers receive promotional content about new services and special offers with clear opt-out instructions",
    helpMessage: "Reply HELP for more info or STOP to unsubscribe",
    optInKeywords: ["JOIN", "PROMO", "OFFERS"],
    optOutKeywords: ["STOP", "UNSUBSCRIBE", "NO"],
    status: "PENDING",
    registrationDate: "2024-03-05T00:00:00Z",
    monthlyMessageVolume: 25000,
    dailyMessageVolume: 1000,
    assignedNumbers: [],
    messagesSent: 0,
    messagesDelivered: 0,
    optOuts: 0,
    violations: 0,
  },
  {
    id: "campaign-003",
    brandId: "brand-002",
    name: "Support Tickets",
    description:
      "Two-way messaging for customer support ticket updates and resolution",
    useCase: "STANDARD",
    messageFlow:
      "Customers receive support ticket updates and can reply with additional information",
    helpMessage: "Reply with your ticket number for status or STOP to opt out",
    optInKeywords: ["SUPPORT", "HELP", "TICKET"],
    optOutKeywords: ["STOP", "END"],
    status: "PENDING",
    registrationDate: "2024-03-01T00:00:00Z",
    monthlyMessageVolume: 5000,
    dailyMessageVolume: 200,
    assignedNumbers: [],
    messagesSent: 0,
    messagesDelivered: 0,
    optOuts: 0,
    violations: 0,
  },
];

export const mockMessagingNumbers: MessagingNumber[] = [
  {
    id: "msg-001",
    phoneNumber: "+14155551234",
    status: "ACTIVE",
    campaignId: "campaign-001",
    brandId: "brand-001",
    assignedDate: "2024-01-25T00:00:00Z",
    messagesSent: 4521,
    messagesReceived: 234,
    lastActivity: "2024-03-15T14:30:00Z",
  },
  {
    id: "msg-002",
    phoneNumber: "+13055554820",
    status: "ACTIVE",
    campaignId: "campaign-001",
    brandId: "brand-001",
    assignedDate: "2024-02-01T00:00:00Z",
    messagesSent: 4022,
    messagesReceived: 187,
    lastActivity: "2024-03-15T16:45:00Z",
  },
  {
    id: "msg-003",
    phoneNumber: "+18885551357",
    status: "INACTIVE",
    messagesSent: 0,
    messagesReceived: 0,
  },
  {
    id: "msg-004",
    phoneNumber: "+12125551234",
    status: "PENDING",
    messagesSent: 0,
    messagesReceived: 0,
  },
];

export const mockTeliqueLogRecords: TeliqueLogRecord[] = [
  {
    id: "log-001",
    timestamp: "2025-09-16T14:52:03Z",
    clientIp: "8.20.212.93",
    domain: "api-dev.ringer.tel",
    customerRule: "1004",
    method: "GET",
    url: "https://api-dev.ringer.tel/v1/telique/dno/4805718483",
    statusCode: 200,
    responseSize: 342,
    userAgent: "aahc",
    latencySeconds: 0.020758,
    serviceType: "dno",
    isSuspicious: false,
    backendService: "lrn-api-backend",
    cost: 0.003,
  },
  {
    id: "log-002",
    timestamp: "2025-09-16T14:51:45Z",
    clientIp: "203.0.113.45",
    domain: "api.ringer.tel",
    customerRule: "1004",
    method: "GET",
    url: "https://api.ringer.tel/v1/telique/lrn/2125551234",
    statusCode: 200,
    responseSize: 289,
    userAgent: "TelecomApp/1.0",
    latencySeconds: 0.015432,
    serviceType: "lrn",
    isSuspicious: false,
    backendService: "lrn-api-backend",
    cost: 0.002,
  },
  {
    id: "log-003",
    timestamp: "2025-09-16T14:50:12Z",
    clientIp: "192.168.1.100",
    domain: "api.ringer.tel",
    customerRule: "1004",
    method: "GET",
    url: "https://api.ringer.tel/v1/telique/cnam/3105559876",
    statusCode: 200,
    responseSize: 156,
    userAgent: "curl/7.68.0",
    latencySeconds: 0.032145,
    serviceType: "cnam",
    isSuspicious: false,
    backendService: "cnam-api-backend",
    cost: 0.001,
  },
  {
    id: "log-004",
    timestamp: "2025-09-16T14:49:33Z",
    clientIp: "10.0.0.25",
    domain: "api-dev.ringer.tel",
    customerRule: "1004",
    method: "POST",
    url: "https://api-dev.ringer.tel/v1/telique/stir-shaken/verify",
    statusCode: 200,
    responseSize: 445,
    userAgent: "PostmanRuntime/7.29.0",
    latencySeconds: 0.087654,
    serviceType: "stir_shaken",
    isSuspicious: false,
    backendService: "stir-shaken-backend",
    cost: 0.005,
  },
  {
    id: "log-005",
    timestamp: "2025-09-16T14:48:21Z",
    clientIp: "172.16.0.10",
    domain: "api.ringer.tel",
    customerRule: "1004",
    method: "GET",
    url: "https://api.ringer.tel/v1/telique/cic/4155551234",
    statusCode: 404,
    responseSize: 89,
    userAgent: "Python-urllib/3.9",
    latencySeconds: 0.012345,
    serviceType: "cic",
    isSuspicious: false,
    backendService: "cic-api-backend",
    cost: 0.001,
  },
  {
    id: "log-006",
    timestamp: "2025-09-16T14:47:55Z",
    clientIp: "198.51.100.15",
    domain: "api.ringer.tel",
    customerRule: "1004",
    method: "GET",
    url: "https://api.ringer.tel/v1/telique/lsms/8005551234",
    statusCode: 200,
    responseSize: 234,
    userAgent: "Go-http-client/1.1",
    latencySeconds: 0.025678,
    serviceType: "lsms",
    isSuspicious: false,
    backendService: "lsms-api-backend",
    cost: 0.002,
  },
  {
    id: "log-007",
    timestamp: "2025-09-16T14:46:42Z",
    clientIp: "203.0.113.99",
    domain: "api-dev.ringer.tel",
    customerRule: "1004",
    method: "GET",
    url: "https://api-dev.ringer.tel/v1/telique/lerg/npa/212",
    statusCode: 200,
    responseSize: 1024,
    userAgent: "Mozilla/5.0 (compatible; TelecomBot/1.0)",
    latencySeconds: 0.045123,
    serviceType: "lerg",
    isSuspicious: false,
    backendService: "lerg-api-backend",
    cost: 0.004,
  },
  {
    id: "log-008",
    timestamp: "2025-09-16T14:45:18Z",
    clientIp: "192.0.2.50",
    domain: "api.ringer.tel",
    customerRule: "1004",
    method: "GET",
    url: "https://api.ringer.tel/v1/telique/dno/5551234567",
    statusCode: 429,
    responseSize: 67,
    userAgent: "BadBot/1.0",
    latencySeconds: 0.001234,
    serviceType: "dno",
    isSuspicious: true,
    backendService: "rate-limiter",
    cost: 0.0,
  },
];

export const mockTeliqueUsageMetrics: TeliqueUsageMetrics = {
  totalQueries: 45678,
  totalCost: 89.45,
  averageLatency: 0.028,
  successRate: 98.7,
  dailyStats: [
    {
      date: "2025-09-10",
      queries: 1234,
      cost: 2.45,
      averageLatency: 0.025,
      errorRate: 1.2,
    },
    {
      date: "2025-09-11",
      queries: 1567,
      cost: 3.12,
      averageLatency: 0.032,
      errorRate: 0.8,
    },
    {
      date: "2025-09-12",
      queries: 1890,
      cost: 3.78,
      averageLatency: 0.029,
      errorRate: 1.5,
    },
    {
      date: "2025-09-13",
      queries: 2134,
      cost: 4.27,
      averageLatency: 0.031,
      errorRate: 0.9,
    },
    {
      date: "2025-09-14",
      queries: 1876,
      cost: 3.75,
      averageLatency: 0.026,
      errorRate: 1.1,
    },
    {
      date: "2025-09-15",
      queries: 2045,
      cost: 4.09,
      averageLatency: 0.033,
      errorRate: 1.3,
    },
    {
      date: "2025-09-16",
      queries: 1789,
      cost: 3.58,
      averageLatency: 0.027,
      errorRate: 0.7,
    },
  ],

  serviceBreakdown: [
    {
      serviceType: "LRN",
      queries: 15234,
      cost: 30.47,
      averageLatency: 0.024,
    },
    {
      serviceType: "DNO",
      queries: 12456,
      cost: 24.91,
      averageLatency: 0.031,
    },
    {
      serviceType: "CNAM",
      queries: 8765,
      cost: 17.53,
      averageLatency: 0.028,
    },
    {
      serviceType: "CIC",
      queries: 4321,
      cost: 8.64,
      averageLatency: 0.025,
    },
    {
      serviceType: "STIR/SHAKEN",
      queries: 2890,
      cost: 5.78,
      averageLatency: 0.045,
    },
    {
      serviceType: "LSMS",
      queries: 1567,
      cost: 3.13,
      averageLatency: 0.022,
    },
    {
      serviceType: "LERG",
      queries: 445,
      cost: 0.89,
      averageLatency: 0.038,
    },
  ],
};
