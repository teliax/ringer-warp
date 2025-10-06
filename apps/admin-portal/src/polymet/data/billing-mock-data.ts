export interface BillingStatement {
  id: string;
  statementNumber: string;
  period: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: "paid" | "open" | "overdue" | "processing";
  paidDate?: string;
  paymentMethod?: string;
  netsuiteId?: string;
  downloadUrl: string;
  items: BillingLineItem[];
}

export interface BillingLineItem {
  id: string;
  description: string;
  category:
    | "voice"
    | "messaging"
    | "numbers"
    | "subscription"
    | "fees"
    | "taxes";
  quantity: number;
  rate: number;
  amount: number;
  period?: string;
  details?: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  date: string;
  amount: number;
  status: "completed" | "pending" | "failed" | "refunded";
  method: "credit_card" | "ach" | "google_pay" | "paypal" | "wire_transfer";
  statementIds: string[];
  transactionId?: string;
  failureReason?: string;
  refundAmount?: number;
  refundDate?: string;
}

export interface Subscription {
  id: string;
  name: string;
  description: string;
  category: "platform" | "numbers" | "messaging" | "voice" | "support";
  amount: number;
  billingCycle: "monthly" | "quarterly" | "annually";
  status: "active" | "paused" | "cancelled" | "pending";
  startDate: string;
  nextBillingDate: string;
  endDate?: string;
  quantity?: number;
  unitPrice?: number;
  features: string[];
}

export interface PaymentMethod {
  id: string;
  type: "credit_card" | "ach" | "google_pay" | "paypal";
  isDefault: boolean;
  status: "active" | "expired" | "disabled";
  createdDate: string;
  lastUsed?: string;
  // Credit Card specific
  cardLast4?: string;
  cardBrand?: "visa" | "mastercard" | "amex" | "discover";
  cardExpiry?: string;
  cardholderName?: string;
  // ACH specific
  bankName?: string;
  accountLast4?: string;
  accountType?: "checking" | "savings";
  routingNumber?: string;
  // Digital wallet specific
  email?: string;
  walletId?: string;
}

export interface BillingOverview {
  currentBalance: number;
  monthToDateSpending: number;
  lastMonthSpending: number;
  averageMonthlySpending: number;
  nextBillingDate: string;
  paymentMethodsCount: number;
  activeSubscriptionsCount: number;
  spendingTrend: "up" | "down" | "stable";
  spendingTrendPercentage: number;
}

export interface SpendingData {
  date: string;
  voice: number;
  messaging: number;
  numbers: number;
  subscriptions: number;
  total: number;
}

// Mock Data
export const mockBillingStatements: BillingStatement[] = [
  {
    id: "stmt-001",
    statementNumber: "INV-2024-001",
    period: "March 2024",
    issueDate: "2024-04-01",
    dueDate: "2024-04-15",
    amount: 1247.83,
    status: "open",
    netsuiteId: "NS-INV-2024-001",
    downloadUrl: "/api/statements/stmt-001/download",
    items: [
      {
        id: "item-001",
        description: "SIP Trunk Monthly Fee",
        category: "subscription",
        quantity: 3,
        rate: 25.0,
        amount: 75.0,
        period: "March 2024",
        details: "3 active SIP trunks",
      },
      {
        id: "item-002",
        description: "DID Numbers Monthly Fee",
        category: "numbers",
        quantity: 8,
        rate: 2.5,
        amount: 20.0,
        period: "March 2024",
        details: "8 active DID numbers",
      },
      {
        id: "item-003",
        description: "Outbound Voice Minutes",
        category: "voice",
        quantity: 45678,
        rate: 0.015,
        amount: 685.17,
        period: "March 2024",
        details: "Usage-based billing",
      },
      {
        id: "item-004",
        description: "Inbound Voice Minutes",
        category: "voice",
        quantity: 23456,
        rate: 0.012,
        amount: 281.47,
        period: "March 2024",
        details: "Usage-based billing",
      },
      {
        id: "item-005",
        description: "SMS Messages Sent",
        category: "messaging",
        quantity: 12500,
        rate: 0.0075,
        amount: 93.75,
        period: "March 2024",
        details: "A2P 10DLC messaging",
      },
      {
        id: "item-006",
        description: "Platform Fee",
        category: "subscription",
        quantity: 1,
        rate: 50.0,
        amount: 50.0,
        period: "March 2024",
        details: "Monthly platform access",
      },
      {
        id: "item-007",
        description: "Regulatory Fees",
        category: "fees",
        quantity: 1,
        rate: 15.67,
        amount: 15.67,
        period: "March 2024",
        details: "FCC and state regulatory fees",
      },
      {
        id: "item-008",
        description: "Sales Tax",
        category: "taxes",
        quantity: 1,
        rate: 26.77,
        amount: 26.77,
        period: "March 2024",
        details: "State and local taxes",
      },
    ],
  },
  {
    id: "stmt-002",
    statementNumber: "INV-2024-002",
    period: "February 2024",
    issueDate: "2024-03-01",
    dueDate: "2024-03-15",
    amount: 987.45,
    status: "paid",
    paidDate: "2024-03-12",
    paymentMethod: "Credit Card ending in 4532",
    netsuiteId: "NS-INV-2024-002",
    downloadUrl: "/api/statements/stmt-002/download",
    items: [
      {
        id: "item-009",
        description: "SIP Trunk Monthly Fee",
        category: "subscription",
        quantity: 2,
        rate: 25.0,
        amount: 50.0,
        period: "February 2024",
      },
      {
        id: "item-010",
        description: "DID Numbers Monthly Fee",
        category: "numbers",
        quantity: 6,
        rate: 2.5,
        amount: 15.0,
        period: "February 2024",
      },
      {
        id: "item-011",
        description: "Outbound Voice Minutes",
        category: "voice",
        quantity: 38945,
        rate: 0.015,
        amount: 584.18,
        period: "February 2024",
      },
      {
        id: "item-012",
        description: "Inbound Voice Minutes",
        category: "voice",
        quantity: 19876,
        rate: 0.012,
        amount: 238.51,
        period: "February 2024",
      },
      {
        id: "item-013",
        description: "SMS Messages Sent",
        category: "messaging",
        quantity: 8750,
        rate: 0.0075,
        amount: 65.63,
        period: "February 2024",
      },
      {
        id: "item-014",
        description: "Platform Fee",
        category: "subscription",
        quantity: 1,
        rate: 50.0,
        amount: 50.0,
        period: "February 2024",
      },
    ],
  },
  {
    id: "stmt-003",
    statementNumber: "INV-2024-003",
    period: "January 2024",
    issueDate: "2024-02-01",
    dueDate: "2024-02-15",
    amount: 856.92,
    status: "paid",
    paidDate: "2024-02-10",
    paymentMethod: "ACH Transfer",
    netsuiteId: "NS-INV-2024-003",
    downloadUrl: "/api/statements/stmt-003/download",
    items: [
      {
        id: "item-015",
        description: "SIP Trunk Monthly Fee",
        category: "subscription",
        quantity: 2,
        rate: 25.0,
        amount: 50.0,
        period: "January 2024",
      },
      {
        id: "item-016",
        description: "DID Numbers Monthly Fee",
        category: "numbers",
        quantity: 5,
        rate: 2.5,
        amount: 12.5,
        period: "January 2024",
      },
      {
        id: "item-017",
        description: "Outbound Voice Minutes",
        category: "voice",
        quantity: 32156,
        rate: 0.015,
        amount: 482.34,
        period: "January 2024",
      },
      {
        id: "item-018",
        description: "Inbound Voice Minutes",
        category: "voice",
        quantity: 18234,
        rate: 0.012,
        amount: 218.81,
        period: "January 2024",
      },
      {
        id: "item-019",
        description: "SMS Messages Sent",
        category: "messaging",
        quantity: 6890,
        rate: 0.0075,
        amount: 51.68,
        period: "January 2024",
      },
      {
        id: "item-020",
        description: "Platform Fee",
        category: "subscription",
        quantity: 1,
        rate: 50.0,
        amount: 50.0,
        period: "January 2024",
      },
    ],
  },
];

export const mockPayments: Payment[] = [
  {
    id: "pay-001",
    paymentNumber: "PAY-2024-001",
    date: "2024-03-12T14:30:00Z",
    amount: 987.45,
    status: "completed",
    method: "credit_card",
    statementIds: ["stmt-002"],
    transactionId: "txn_1234567890abcdef",
  },
  {
    id: "pay-002",
    paymentNumber: "PAY-2024-002",
    date: "2024-02-10T09:15:00Z",
    amount: 856.92,
    status: "completed",
    method: "ach",
    statementIds: ["stmt-003"],
    transactionId: "ach_9876543210fedcba",
  },
  {
    id: "pay-003",
    paymentNumber: "PAY-2024-003",
    date: "2024-01-15T16:45:00Z",
    amount: 734.28,
    status: "completed",
    method: "google_pay",
    statementIds: ["stmt-004"],
    transactionId: "gpy_abcdef1234567890",
  },
  {
    id: "pay-004",
    paymentNumber: "PAY-2024-004",
    date: "2024-03-20T11:22:00Z",
    amount: 125.0,
    status: "failed",
    method: "credit_card",
    statementIds: ["stmt-001"],
    transactionId: "txn_failed123456",
    failureReason: "Insufficient funds",
  },
  {
    id: "pay-005",
    paymentNumber: "PAY-2024-005",
    date: "2024-02-28T13:10:00Z",
    amount: 50.0,
    status: "refunded",
    method: "paypal",
    statementIds: [],
    transactionId: "pp_refund789012",
    refundAmount: 50.0,
    refundDate: "2024-03-05T10:00:00Z",
  },
];

export const mockSubscriptions: Subscription[] = [
  {
    id: "sub-001",
    name: "Platform Access",
    description: "Monthly access to the Ringer telecommunications platform",
    category: "platform",
    amount: 50.0,
    billingCycle: "monthly",
    status: "active",
    startDate: "2024-01-01",
    nextBillingDate: "2024-04-01",
    features: [
      "Dashboard access",
      "API access",
      "Basic support",
      "Usage analytics",
    ],
  },
  {
    id: "sub-002",
    name: "SIP Trunk Service",
    description: "Monthly fee for SIP trunk connectivity",
    category: "voice",
    amount: 75.0,
    billingCycle: "monthly",
    status: "active",
    startDate: "2024-01-15",
    nextBillingDate: "2024-04-15",
    quantity: 3,
    unitPrice: 25.0,
    features: [
      "Up to 100 concurrent calls per trunk",
      "99.9% uptime SLA",
      "24/7 monitoring",
      "Failover support",
    ],
  },
  {
    id: "sub-003",
    name: "DID Number Pool",
    description: "Monthly fees for DID number inventory",
    category: "numbers",
    amount: 20.0,
    billingCycle: "monthly",
    status: "active",
    startDate: "2024-01-01",
    nextBillingDate: "2024-04-01",
    quantity: 8,
    unitPrice: 2.5,
    features: [
      "Local and toll-free numbers",
      "E911 service included",
      "Number porting support",
      "CNAM management",
    ],
  },
  {
    id: "sub-004",
    name: "A2P Messaging Platform",
    description: "Access to A2P 10DLC messaging services",
    category: "messaging",
    amount: 25.0,
    billingCycle: "monthly",
    status: "active",
    startDate: "2024-02-01",
    nextBillingDate: "2024-04-01",
    features: [
      "Brand registration",
      "Campaign management",
      "Compliance monitoring",
      "Delivery reports",
    ],
  },
  {
    id: "sub-005",
    name: "Premium Support",
    description: "Enhanced support with priority response times",
    category: "support",
    amount: 100.0,
    billingCycle: "monthly",
    status: "paused",
    startDate: "2024-01-01",
    nextBillingDate: "2024-05-01",
    features: [
      "Priority support queue",
      "Dedicated account manager",
      "Phone support",
      "Custom integrations",
    ],
  },
  {
    id: "sub-006",
    name: "Enterprise Analytics",
    description: "Advanced analytics and reporting tools",
    category: "platform",
    amount: 200.0,
    billingCycle: "quarterly",
    status: "cancelled",
    startDate: "2024-01-01",
    endDate: "2024-03-31",
    nextBillingDate: "2024-07-01",
    features: [
      "Custom dashboards",
      "Advanced reporting",
      "Data export tools",
      "API analytics",
    ],
  },
];

export const mockPaymentMethods: PaymentMethod[] = [
  {
    id: "pm-001",
    type: "credit_card",
    isDefault: true,
    status: "active",
    createdDate: "2024-01-15",
    lastUsed: "2024-03-12",
    cardLast4: "4532",
    cardBrand: "visa",
    cardExpiry: "12/26",
    cardholderName: "John Smith",
  },
  {
    id: "pm-002",
    type: "ach",
    isDefault: false,
    status: "active",
    createdDate: "2024-02-01",
    lastUsed: "2024-02-10",
    bankName: "Chase Bank",
    accountLast4: "7890",
    accountType: "checking",
    routingNumber: "021000021",
  },
  {
    id: "pm-003",
    type: "google_pay",
    isDefault: false,
    status: "active",
    createdDate: "2024-01-20",
    lastUsed: "2024-01-15",
    email: "john.smith@company.com",
    walletId: "gpy_wallet_123456",
  },
  {
    id: "pm-004",
    type: "paypal",
    isDefault: false,
    status: "active",
    createdDate: "2024-02-15",
    lastUsed: "2024-02-28",
    email: "john.smith@company.com",
    walletId: "pp_wallet_789012",
  },
  {
    id: "pm-005",
    type: "credit_card",
    isDefault: false,
    status: "expired",
    createdDate: "2023-06-01",
    lastUsed: "2023-12-15",
    cardLast4: "1234",
    cardBrand: "mastercard",
    cardExpiry: "12/23",
    cardholderName: "John Smith",
  },
];

export const mockBillingOverview: BillingOverview = {
  currentBalance: 1247.83,
  monthToDateSpending: 892.45,
  lastMonthSpending: 987.45,
  averageMonthlySpending: 924.73,
  nextBillingDate: "2024-04-15",
  paymentMethodsCount: 4,
  activeSubscriptionsCount: 4,
  spendingTrend: "down",
  spendingTrendPercentage: 9.6,
};

export const mockSpendingData: SpendingData[] = [
  {
    date: "2024-01-01",
    voice: 701.15,
    messaging: 51.68,
    numbers: 12.5,
    subscriptions: 100.0,
    total: 865.33,
  },
  {
    date: "2024-02-01",
    voice: 822.69,
    messaging: 65.63,
    numbers: 15.0,
    subscriptions: 125.0,
    total: 1028.32,
  },
  {
    date: "2024-03-01",
    voice: 966.64,
    messaging: 93.75,
    numbers: 20.0,
    subscriptions: 150.0,
    total: 1230.39,
  },
  {
    date: "2024-04-01",
    voice: 845.23,
    messaging: 78.9,
    numbers: 20.0,
    subscriptions: 150.0,
    total: 1094.13,
  },
  {
    date: "2024-05-01",
    voice: 756.89,
    messaging: 82.45,
    numbers: 22.5,
    subscriptions: 150.0,
    total: 1011.84,
  },
  {
    date: "2024-06-01",
    voice: 923.45,
    messaging: 95.67,
    numbers: 22.5,
    subscriptions: 150.0,
    total: 1191.62,
  },
];
