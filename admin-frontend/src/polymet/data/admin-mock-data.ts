// Customer Account Types
export interface CustomerAccount {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  contactEmail: string; // Alias for email for search component compatibility
  phone: string;
  contactPhone: string; // Alias for phone for search component compatibility
  accountNumber: string;
  status: "active" | "suspended" | "inactive";
  tier: "enterprise" | "business" | "standard" | "basic";
  createdDate: string;
  lastActivity: string;
  monthlySpend: number;
  creditLimit: number;
  currentBalance: number;
  balance: number; // Alias for currentBalance for search component compatibility
  warningThreshold: number;
  products: {
    trunks: number;
    numbers: number;
    messaging: boolean;
    telecomData: boolean;
  };
  productsList: string[]; // Array of product names for search component compatibility
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface Vendor {
  id: string;
  name: string;
  type: "voice" | "messaging" | "data" | "other";
  status: "active" | "inactive" | "pending";
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  services: string[];
  contractStart: string;
  contractEnd: string;
  monthlyVolume: number;
  ratePerMinute?: number;
  ratePerMessage?: number;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface AccountingTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: "credit" | "debit" | "adjustment" | "payment";
  amount: number;
  description: string;
  createdBy: string;
  createdDate: string;
  reference?: string;
}

export interface ERPProduct {
  id: string;
  sku: string;
  name: string;
  category:
    | "Voice Services"
    | "Messaging"
    | "Data Services"
    | "Hardware"
    | "Professional Services";
  description: string;
  price: number;
  inventory: number;
  unit: string;
  status: "active" | "inactive" | "discontinued" | "pending";
  createdDate: string;
  updatedDate: string;
}

export interface AdminStats {
  totalCustomers: number;
  activeCustomers: number;
  totalRevenue: number;
  monthlyGrowth: number;
  totalVendors: number;
  activeVendors: number;
  totalProducts: number;
  pendingTickets: number;
}

// Mock Customer Accounts
export const mockCustomerAccounts: CustomerAccount[] = [
  {
    id: "cust-001",
    companyName: "Acme Communications",
    contactName: "John Smith",
    email: "john.smith@acme.com",
    contactEmail: "john.smith@acme.com",
    phone: "+1-555-0123",
    contactPhone: "+1-555-0123",
    accountNumber: "AC-644288714",
    status: "active",
    tier: "enterprise",
    createdDate: "2023-01-15",
    lastActivity: "2024-01-15T10:30:00Z",
    monthlySpend: 2847.5,
    creditLimit: 5000,
    currentBalance: 1250.75,
    balance: 1250.75,
    warningThreshold: 4000,
    products: {
      trunks: 5,
      numbers: 25,
      messaging: true,
      telecomData: true,
    },
    productsList: ["SIP Trunks", "DID Numbers", "SMS Gateway", "Telecom Data"],
    address: {
      street: "123 Business Ave",
      city: "New York",
      state: "NY",
      zip: "10001",
      country: "USA",
    },
  },
  {
    id: "cust-002",
    companyName: "TechStart Solutions",
    contactName: "Sarah Johnson",
    email: "sarah@techstart.io",
    contactEmail: "sarah@techstart.io",
    phone: "+1-555-0456",
    contactPhone: "+1-555-0456",
    accountNumber: "TS-987654321",
    status: "active",
    tier: "business",
    createdDate: "2023-03-22",
    lastActivity: "2024-01-14T15:45:00Z",
    monthlySpend: 1456.25,
    creditLimit: 3000,
    currentBalance: 567.8,
    balance: 567.8,
    warningThreshold: 2500,
    products: {
      trunks: 2,
      numbers: 12,
      messaging: true,
      telecomData: false,
    },
    productsList: ["SIP Trunks", "DID Numbers", "SMS Gateway"],
    address: {
      street: "456 Tech Blvd",
      city: "San Francisco",
      state: "CA",
      zip: "94105",
      country: "USA",
    },
  },
  {
    id: "cust-003",
    companyName: "Global Enterprises",
    contactName: "Michael Chen",
    email: "m.chen@globalent.com",
    contactEmail: "m.chen@globalent.com",
    phone: "+1-555-0789",
    contactPhone: "+1-555-0789",
    accountNumber: "GE-123456789",
    status: "suspended",
    tier: "enterprise",
    createdDate: "2022-11-08",
    lastActivity: "2024-01-10T09:15:00Z",
    monthlySpend: 5234.8,
    creditLimit: 10000,
    currentBalance: 8750.25,
    balance: 8750.25,
    warningThreshold: 8000,
    products: {
      trunks: 12,
      numbers: 150,
      messaging: true,
      telecomData: true,
    },
    productsList: [
      "SIP Trunks",
      "DID Numbers",
      "SMS Gateway",
      "Telecom Data",
      "Premium Support",
    ],

    address: {
      street: "789 Enterprise Way",
      city: "Chicago",
      state: "IL",
      zip: "60601",
      country: "USA",
    },
  },
  {
    id: "cust-004",
    companyName: "StartupCorp",
    contactName: "Emily Davis",
    email: "emily@startupcorp.com",
    contactEmail: "emily@startupcorp.com",
    phone: "+1-555-0321",
    contactPhone: "+1-555-0321",
    accountNumber: "SC-456789123",
    status: "active",
    tier: "standard",
    createdDate: "2023-08-15",
    lastActivity: "2024-01-16T08:20:00Z",
    monthlySpend: 892.3,
    creditLimit: 2000,
    currentBalance: 234.5,
    balance: 234.5,
    warningThreshold: 1600,
    products: {
      trunks: 1,
      numbers: 8,
      messaging: false,
      telecomData: false,
    },
    productsList: ["SIP Trunks", "DID Numbers"],
    address: {
      street: "321 Startup St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "USA",
    },
  },
  {
    id: "cust-005",
    companyName: "MegaCorp Industries",
    contactName: "Robert Wilson",
    email: "r.wilson@megacorp.com",
    contactEmail: "r.wilson@megacorp.com",
    phone: "+1-555-0654",
    contactPhone: "+1-555-0654",
    accountNumber: "MC-789123456",
    status: "inactive",
    tier: "basic",
    createdDate: "2022-05-10",
    lastActivity: "2023-12-20T14:30:00Z",
    monthlySpend: 0,
    creditLimit: 1000,
    currentBalance: -150.0,
    balance: -150.0,
    warningThreshold: 800,
    products: {
      trunks: 0,
      numbers: 3,
      messaging: false,
      telecomData: false,
    },
    productsList: ["DID Numbers"],
    address: {
      street: "789 Corporate Blvd",
      city: "Miami",
      state: "FL",
      zip: "33101",
      country: "USA",
    },
  },
];

// Mock Vendors
export const mockVendors: Vendor[] = [
  {
    id: "vendor-001",
    name: "VoiceStream Partners",
    type: "voice",
    status: "active",
    contactName: "Robert Wilson",
    contactEmail: "robert@voicestream.com",
    contactPhone: "+1-800-555-0001",
    services: ["SIP Trunking", "DID Numbers", "International Routing"],
    contractStart: "2023-01-01",
    contractEnd: "2025-12-31",
    monthlyVolume: 1500000,
    ratePerMinute: 0.0085,
    address: {
      street: "100 Telecom Plaza",
      city: "Atlanta",
      state: "GA",
      zip: "30309",
      country: "USA",
    },
  },
  {
    id: "vendor-002",
    name: "MessageFlow Inc",
    type: "messaging",
    status: "active",
    contactName: "Lisa Rodriguez",
    contactEmail: "lisa@messageflow.com",
    contactPhone: "+1-800-555-0002",
    services: ["SMS Gateway", "MMS Delivery", "A2P Messaging"],
    contractStart: "2023-06-15",
    contractEnd: "2024-06-14",
    monthlyVolume: 2500000,
    ratePerMessage: 0.0075,
    address: {
      street: "200 Message Blvd",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "USA",
    },
  },
  {
    id: "vendor-003",
    name: "DataLink Systems",
    type: "data",
    status: "pending",
    contactName: "David Park",
    contactEmail: "david@datalink.net",
    contactPhone: "+1-800-555-0003",
    services: ["CDR Processing", "Analytics Platform", "Data Warehousing"],
    contractStart: "2024-02-01",
    contractEnd: "2026-01-31",
    monthlyVolume: 0,
    address: {
      street: "300 Data Center Dr",
      city: "Seattle",
      state: "WA",
      zip: "98101",
      country: "USA",
    },
  },
];

// Mock Accounting Transactions
export const mockAccountingTransactions: AccountingTransaction[] = [
  {
    id: "txn-001",
    customerId: "cust-001",
    customerName: "Acme Communications",
    type: "credit",
    amount: 500.0,
    description: "Manual credit adjustment - service outage compensation",
    createdBy: "admin@ringer.tel",
    createdDate: "2024-01-15T14:30:00Z",
    reference: "TICKET-12345",
  },
  {
    id: "txn-002",
    customerId: "cust-002",
    customerName: "TechStart Solutions",
    type: "debit",
    amount: 1456.25,
    description: "Monthly usage charges - December 2023",
    createdBy: "system",
    createdDate: "2024-01-01T00:00:00Z",
    reference: "INV-202312-002",
  },
  {
    id: "txn-003",
    customerId: "cust-003",
    customerName: "Global Enterprises",
    type: "payment",
    amount: 2500.0,
    description: "Payment received - Check #4567",
    createdBy: "billing@ringer.tel",
    createdDate: "2024-01-10T16:45:00Z",
    reference: "CHK-4567",
  },
];

// Mock ERP Products
export const mockERPProducts: ERPProduct[] = [
  {
    id: "prod-001",
    sku: "TRUNK-BASIC",
    name: "Basic SIP Trunk",
    category: "Voice Services",
    description:
      "Standard SIP trunk with basic features and unlimited concurrent calls",
    price: 15.0,
    inventory: 150,
    unit: "per month",
    status: "active",
    createdDate: "2023-01-01",
    updatedDate: "2023-06-15",
  },
  {
    id: "prod-002",
    sku: "TRUNK-PREMIUM",
    name: "Premium SIP Trunk",
    category: "Voice Services",
    description:
      "Advanced SIP trunk with priority routing and enhanced features",
    price: 25.0,
    inventory: 75,
    unit: "per month",
    status: "active",
    createdDate: "2023-01-01",
    updatedDate: "2023-06-15",
  },
  {
    id: "prod-003",
    sku: "DID-LOCAL",
    name: "Local DID Number",
    category: "Voice Services",
    description: "Local phone number with E911 support and caller ID",
    price: 2.5,
    inventory: 500,
    unit: "per month",
    status: "active",
    createdDate: "2023-01-01",
    updatedDate: "2023-08-20",
  },
  {
    id: "prod-004",
    sku: "DID-TOLLFREE",
    name: "Toll-Free Number",
    category: "Voice Services",
    description: "Toll-free number with nationwide coverage",
    price: 5.0,
    inventory: 200,
    unit: "per month",
    status: "active",
    createdDate: "2023-02-01",
    updatedDate: "2023-08-20",
  },
  {
    id: "prod-005",
    sku: "SMS-GATEWAY",
    name: "SMS Gateway Access",
    category: "Messaging",
    description: "High-volume SMS messaging platform with delivery reports",
    price: 0.008,
    inventory: 10000000,
    unit: "per message",
    status: "active",
    createdDate: "2023-03-15",
    updatedDate: "2023-11-10",
  },
  {
    id: "prod-006",
    sku: "MMS-GATEWAY",
    name: "MMS Gateway Access",
    category: "Messaging",
    description: "Multimedia messaging service with image and video support",
    price: 0.025,
    inventory: 5000000,
    unit: "per message",
    status: "active",
    createdDate: "2023-04-01",
    updatedDate: "2023-11-10",
  },
  {
    id: "prod-007",
    sku: "VOICE-MINUTES",
    name: "Voice Minutes Package",
    category: "Voice Services",
    description: "Prepaid voice minutes for outbound calling",
    price: 0.012,
    inventory: 50000000,
    unit: "per minute",
    status: "active",
    createdDate: "2023-01-15",
    updatedDate: "2023-09-05",
  },
  {
    id: "prod-008",
    sku: "CDR-ANALYTICS",
    name: "CDR Analytics Platform",
    category: "Data Services",
    description: "Advanced call detail record analytics and reporting",
    price: 99.0,
    inventory: 25,
    unit: "per month",
    status: "active",
    createdDate: "2023-05-01",
    updatedDate: "2023-10-15",
  },
  {
    id: "prod-009",
    sku: "API-ACCESS",
    name: "API Access License",
    category: "Data Services",
    description: "Full API access for custom integrations and automation",
    price: 149.0,
    inventory: 50,
    unit: "per month",
    status: "active",
    createdDate: "2023-06-01",
    updatedDate: "2023-11-20",
  },
  {
    id: "prod-010",
    sku: "SIP-PHONE",
    name: "IP Desk Phone",
    category: "Hardware",
    description: "Professional VoIP desk phone with HD audio",
    price: 125.0,
    inventory: 8,
    unit: "each",
    status: "active",
    createdDate: "2023-07-01",
    updatedDate: "2023-12-01",
  },
  {
    id: "prod-011",
    sku: "GATEWAY-DEVICE",
    name: "SIP Gateway Device",
    category: "Hardware",
    description: "Enterprise SIP gateway for legacy PBX integration",
    price: 450.0,
    inventory: 12,
    unit: "each",
    status: "active",
    createdDate: "2023-08-01",
    updatedDate: "2023-12-15",
  },
  {
    id: "prod-012",
    sku: "SETUP-SERVICE",
    name: "Professional Setup Service",
    category: "Professional Services",
    description: "Expert setup and configuration service",
    price: 200.0,
    inventory: 100,
    unit: "per service",
    status: "active",
    createdDate: "2023-01-01",
    updatedDate: "2023-11-30",
  },
  {
    id: "prod-013",
    sku: "SUPPORT-PREMIUM",
    name: "Premium Support Plan",
    category: "Professional Services",
    description: "24/7 premium support with dedicated account manager",
    price: 299.0,
    inventory: 30,
    unit: "per month",
    status: "active",
    createdDate: "2023-02-01",
    updatedDate: "2023-12-01",
  },
  {
    id: "prod-014",
    sku: "LEGACY-TRUNK",
    name: "Legacy SIP Trunk",
    category: "Voice Services",
    description: "Deprecated trunk service - migration recommended",
    price: 10.0,
    inventory: 5,
    unit: "per month",
    status: "discontinued",
    createdDate: "2022-01-01",
    updatedDate: "2023-06-01",
  },
  {
    id: "prod-015",
    sku: "BETA-FEATURE",
    name: "Beta Voice Enhancement",
    category: "Voice Services",
    description: "New voice enhancement feature in beta testing",
    price: 5.0,
    inventory: 20,
    unit: "per month",
    status: "pending",
    createdDate: "2024-01-01",
    updatedDate: "2024-01-15",
  },
];

// Mock Admin Statistics
export const mockAdminStats: AdminStats = {
  totalCustomers: 5,
  activeCustomers: 3,
  totalRevenue: 2847650.75,
  monthlyGrowth: 12.5,
  totalVendors: 15,
  activeVendors: 12,
  totalProducts: 45,
  pendingTickets: 23,
};

// Revenue data for charts
export const mockRevenueData = [
  { month: "Jul", revenue: 245000, customers: 1050 },
  { month: "Aug", revenue: 267000, customers: 1089 },
  { month: "Sep", revenue: 289000, customers: 1134 },
  { month: "Oct", revenue: 312000, customers: 1178 },
  { month: "Nov", revenue: 298000, customers: 1201 },
  { month: "Dec", revenue: 334000, customers: 1247 },
];

// Customer growth data
export const mockCustomerGrowthData = [
  { month: "Jul", new: 45, churned: 12, net: 33 },
  { month: "Aug", new: 52, churned: 13, net: 39 },
  { month: "Sep", new: 58, churned: 13, net: 45 },
  { month: "Oct", new: 61, churned: 17, net: 44 },
  { month: "Nov", new: 48, churned: 25, net: 23 },
  { month: "Dec", new: 67, churned: 21, net: 46 },
];
