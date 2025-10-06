// SIP Trunk Configuration Types
export interface TrunkBasicInfo {
  id: string;
  type: "customer" | "vendor";
  // REAL-WORLD PATTERNS: Most customers use bidirectional, vendors often separated
  direction:
    | "bidirectional"
    | "inbound_only"
    | "outbound_only"
    | "from_carrier"
    | "to_carrier";
  // TRUNK GROUP MANAGEMENT: Multiple trunks per customer/vendor
  purpose:
    | "primary"
    | "backup"
    | "geographic"
    | "campaign"
    | "quality_tier"
    | "failover"
    | "test";
  location?: string; // Geographic location (HQ, Branch, DR site)
  // Customer fields
  ban?: string; // Billing Account Number (customer only)
  customerId?: string; // Customer ID (customer trunks only)
  // Vendor fields
  providerId?: string; // Provider ID (vendor only)
  vendorId?: string; // Vendor ID (vendor trunks only)
  regions?: string[]; // Supported regions for vendor specialization
  qualityTier?: "premium" | "standard" | "grey" | "test"; // Vendor quality tiers
  // Basic info
  name: string;
  description?: string;
  status: "active" | "suspended" | "testing";
  machineId: string; // Routing Partition
  accountCode?: string; // For billing correlation
  providerType?: "LRN" | "OCNLATA" | "DNIS" | "TOLLFREE" | "INTERNATIONAL"; // vendor only
}

export interface TrunkAuthentication {
  type: "ip_acl" | "sip_digest" | "both" | "none";
  ipWhitelist: Array<{
    ip: string;
    subnet?: string;
    label: string;
  }>;
  credentials?: {
    username: string;
    password: string;
    realm?: string;
  };
  techPrefix?: string; // Optional prefix to strip
}

export interface TrunkConnection {
  dialstrings: string[]; // Multiple SIP URIs for load balancing
  transport: "UDP" | "TCP" | "TLS";
  port?: number;
  authentication?: {
    username: string;
    password: string;
  };
}

export interface TrunkRouting {
  partitions: Array<{
    machineId: string;
    priority: number;
    timeSchedule?: {
      businessHours?: string;
      afterHours?: string;
      weekend?: string;
    };
  }>;
  supportedZones: Array<
    | "INTERSTATE"
    | "INTRASTATE"
    | "LOCAL"
    | "INTERNATIONAL"
    | "ZONE1"
    | "TOLLFREE"
  >;

  jurisdictionPolicy: {
    behavior: "INTRASTATE" | "INTERSTATE" | "POI" | "MIXED";
    poiState?: string;
    aniClassification: "DOM" | "DOMTF" | "INTL" | "ANY";
    aniPrefix?: string;
    normalizeAni: boolean;
  };
}

export interface TrunkRates {
  zones: {
    [zone: string]: {
      rate: number; // per minute - CUSTOMER: Revenue rate | VENDOR: Cost rate
      effectiveDate: string;
      minimumDuration: number; // seconds
      increment: number; // seconds
      maxAcceptableRate?: number; // for LCR (vendor only)
    };
  };
  rateLimiting: {
    enabled: boolean;
    maxRate?: number;
  };
  // MARGIN ANALYSIS (Customer trunks only)
  marginAnalysis?: {
    [zone: string]: {
      vendorCost: number; // What you pay vendor for this zone
      customerRate: number; // What you charge customer
      marginPerMinute: number; // Profit per minute
      marginPercent: number; // Profit margin percentage
    };
  };
}

export interface TrunkOverrides {
  static: {
    domOverride?: number;
    intlOverride?: number;
    cicOverride?: number;
  };
  dynamic: Array<{
    id: string;
    type: "NPANxx" | "OCN_LATA" | "Prefix" | "CIC";
    matchPattern: string;
    overrideRate: number;
    priority: number;
    maxOverride?: number;
    effectiveDate: string;
    expirationDate?: string;
  }>;
}

export interface TrunkExclusions {
  providers: Array<{
    providerId: string;
    reason: "Quality" | "Cost" | "Business" | "Temporary";
    effectiveStart: string;
    effectiveEnd?: string;
  }>;
  destinations: {
    blockedPrefixes: string[];
    blockedCountries: string[];
    blockPremium: boolean; // 900, 976, etc.
  };
}

export interface TrunkFeatures {
  media: {
    codecs: Array<"PCMU" | "PCMA" | "G729" | "G722" | "OPUS">;
    transcoding: boolean;
    dtmfMode: "RFC2833" | "SIP_INFO" | "Inband";
    faxSupport: "T38" | "G711_Passthrough" | "None";
    rtpProxy: "Always" | "Never" | "NAT_Only";
  };
  calls: {
    maxConcurrentCalls: number;
    callsPerSecondLimit: number;
    sessionTimers: boolean;
    sessionTimeout: number; // seconds
  };
}

export interface TrunkMonitoring {
  qualityThresholds: {
    minAsr: number; // percentage
    minAcd: number; // minutes
    maxPdd: number; // milliseconds
  };
  homer: {
    captureSip: boolean;
    captureRtpHeaders: boolean;
    hepNodeId?: number;
  };
}

export interface TrunkDipIntegration {
  lrn: {
    enabled: boolean;
    provider: "Telique" | "Custom";
    customUrl?: string;
    cacheDuration: number; // hours
    fallbackOnFailure: boolean;
  };
  cic: {
    enabled: boolean;
    providerUrl?: string;
    dipTimeout: number; // milliseconds
    defaultCic?: string;
  };
}

export interface SipTrunk {
  basic: TrunkBasicInfo;
  authentication: TrunkAuthentication;
  connection?: TrunkConnection; // vendor only
  routing: TrunkRouting;
  rates: TrunkRates;
  overrides: TrunkOverrides;
  exclusions: TrunkExclusions;
  features: TrunkFeatures;
  monitoring: TrunkMonitoring;
  dipIntegration: TrunkDipIntegration;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;

  // Statistics
  stats?: {
    activeCalls: number;
    todayMinutes: number;
    monthlyMinutes: number;
    asr: number; // percentage
    acd: number; // minutes
    pdd: number; // milliseconds
  };
}

// Mock Partitions/Machines
export const mockPartitions = [
  {
    id: "machine-01",
    name: "Primary East",
    location: "US-East",
    status: "active",
  },
  {
    id: "machine-02",
    name: "Primary West",
    location: "US-West",
    status: "active",
  },
  {
    id: "machine-03",
    name: "Backup Central",
    location: "US-Central",
    status: "standby",
  },
  {
    id: "machine-04",
    name: "International",
    location: "EU-West",
    status: "active",
  },
  { id: "machine-05", name: "Testing", location: "US-East", status: "testing" },
];

// Mock Customer Trunk Groups - Real-world multiple trunk patterns
export const mockCustomerTrunks: SipTrunk[] = [
  // ACME COMMUNICATIONS - Multiple trunk groups (HQ + Branches + DR)
  {
    basic: {
      id: "cust-trunk-001",
      type: "customer",
      direction: "bidirectional", // REAL-WORLD: Most customers use bidirectional
      purpose: "primary", // Primary trunk for main office
      location: "New York HQ",
      ban: "BAN-12345678",
      customerId: "cust-001",
      name: "Acme HQ - Main Office",
      description: "Primary bidirectional trunk for Acme Corp headquarters",
      status: "active",
      machineId: "machine-01",
      accountCode: "ACME001",
    },
    authentication: {
      type: "both",
      ipWhitelist: [
        { ip: "192.168.1.100", subnet: "24", label: "Acme PBX Primary" },
        { ip: "192.168.1.101", subnet: "24", label: "Acme PBX Backup" },
      ],

      credentials: {
        username: "acme_trunk_01",
        password: "secure_password_123",
        realm: "sip.ringer.tel",
      },
    },
    routing: {
      partitions: [
        { machineId: "machine-01", priority: 1 },
        { machineId: "machine-02", priority: 2 },
      ],

      supportedZones: ["INTERSTATE", "INTRASTATE", "LOCAL", "TOLLFREE"],
      jurisdictionPolicy: {
        behavior: "MIXED",
        aniClassification: "DOM",
        normalizeAni: true,
      },
    },
    rates: {
      zones: {
        // CUSTOMER INBOUND RATES (Revenue - what you charge customers for their outbound calls)
        INTERSTATE: {
          rate: 0.0095, // $0.0095/min - Customer outbound calling revenue
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        INTRASTATE: {
          rate: 0.0085, // $0.0085/min - Customer outbound calling revenue
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        LOCAL: {
          rate: 0.0075, // $0.0075/min - Customer outbound calling revenue
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        TOLLFREE: {
          rate: 0.012, // $0.0120/min - Customer toll-free origination (if charged)
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
      },
      rateLimiting: { enabled: true, maxRate: 0.15 },
      // MARGIN ANALYSIS - Profit calculation per zone
      marginAnalysis: {
        INTERSTATE: {
          vendorCost: 0.0045, // What you pay AT&T/Verizon
          customerRate: 0.0095, // What you charge customer
          marginPerMinute: 0.005, // $0.005/min profit
          marginPercent: 52.6, // 52.6% margin
        },
        INTRASTATE: {
          vendorCost: 0.004,
          customerRate: 0.0085,
          marginPerMinute: 0.0045,
          marginPercent: 52.9,
        },
        LOCAL: {
          vendorCost: 0.0035,
          customerRate: 0.0075,
          marginPerMinute: 0.004,
          marginPercent: 53.3,
        },
        TOLLFREE: {
          vendorCost: 0.008,
          customerRate: 0.012,
          marginPerMinute: 0.004,
          marginPercent: 33.3,
        },
      },
    },
    overrides: {
      static: {
        domOverride: 0.008,
      },
      dynamic: [
        {
          id: "override-001",
          type: "NPANxx",
          matchPattern: "212555",
          overrideRate: 0.012,
          priority: 10,
          effectiveDate: "2024-01-01",
        },
      ],
    },
    exclusions: {
      providers: [],
      destinations: {
        blockedPrefixes: ["900", "976"],
        blockedCountries: [],
        blockPremium: true,
      },
    },
    features: {
      media: {
        codecs: ["PCMU", "PCMA", "G729"],
        transcoding: true,
        dtmfMode: "RFC2833",
        faxSupport: "T38",
        rtpProxy: "NAT_Only",
      },
      calls: {
        maxConcurrentCalls: 100,
        callsPerSecondLimit: 10,
        sessionTimers: true,
        sessionTimeout: 1800,
      },
    },
    monitoring: {
      qualityThresholds: {
        minAsr: 95.0,
        minAcd: 2.5,
        maxPdd: 3000,
      },
      homer: {
        captureSip: true,
        captureRtpHeaders: false,
        hepNodeId: 101,
      },
    },
    dipIntegration: {
      lrn: {
        enabled: true,
        provider: "Telique",
        cacheDuration: 24,
        fallbackOnFailure: true,
      },
      cic: {
        enabled: true,
        dipTimeout: 5000,
        defaultCic: "0288",
      },
    },
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-09-15T14:22:00Z",
    createdBy: "admin@ringer.tel",
    lastModifiedBy: "admin@ringer.tel",
    stats: {
      activeCalls: 23,
      todayMinutes: 1247,
      monthlyMinutes: 45230,
      asr: 96.2,
      acd: 3.1,
      pdd: 2100,
    },
  },
  {
    basic: {
      id: "cust-trunk-002",
      type: "customer",
      direction: "bidirectional",
      purpose: "geographic", // Geographic distribution - LA Branch
      location: "Los Angeles Branch",
      ban: "BAN-12345678", // Same customer, different location
      customerId: "cust-001", // Same customer as trunk-001
      name: "Acme LA Branch",
      description: "West Coast branch office bidirectional trunk",
      status: "active",
      machineId: "machine-02",
      accountCode: "ACME002",
    },
    authentication: {
      type: "ip_acl",
      ipWhitelist: [
        { ip: "192.168.2.100", subnet: "24", label: "Acme LA Office" },
      ],
    },
    routing: {
      partitions: [{ machineId: "machine-02", priority: 1 }],
      supportedZones: ["INTERSTATE", "INTRASTATE", "LOCAL"],
      jurisdictionPolicy: {
        behavior: "MIXED",
        aniClassification: "DOM",
        normalizeAni: true,
      },
    },
    rates: {
      zones: {
        INTERSTATE: {
          rate: 0.0095,
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        INTRASTATE: {
          rate: 0.0085,
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        LOCAL: {
          rate: 0.0075,
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
      },
      rateLimiting: { enabled: true, maxRate: 0.15 },
    },
    overrides: { static: {}, dynamic: [] },
    exclusions: {
      providers: [],
      destinations: {
        blockedPrefixes: ["900"],
        blockedCountries: [],
        blockPremium: true,
      },
    },
    features: {
      media: {
        codecs: ["PCMU", "PCMA", "G729"],
        transcoding: true,
        dtmfMode: "RFC2833",
        faxSupport: "T38",
        rtpProxy: "NAT_Only",
      },
      calls: {
        maxConcurrentCalls: 200,
        callsPerSecondLimit: 15,
        sessionTimers: true,
        sessionTimeout: 1800,
      },
    },
    monitoring: {
      qualityThresholds: { minAsr: 95.0, minAcd: 2.5, maxPdd: 3000 },
      homer: { captureSip: true, captureRtpHeaders: false },
    },
    dipIntegration: {
      lrn: {
        enabled: true,
        provider: "Telique",
        cacheDuration: 24,
        fallbackOnFailure: true,
      },
      cic: { enabled: false, dipTimeout: 5000 },
    },
    createdAt: "2024-01-20T09:00:00Z",
    updatedAt: "2024-09-15T11:30:00Z",
    createdBy: "admin@ringer.tel",
    lastModifiedBy: "admin@ringer.tel",
    stats: {
      activeCalls: 15,
      todayMinutes: 892,
      monthlyMinutes: 23456,
      asr: 97.1,
      acd: 3.2,
      pdd: 2200,
    },
  },
  {
    basic: {
      id: "cust-trunk-003",
      type: "customer",
      direction: "bidirectional",
      purpose: "backup", // Disaster recovery trunk
      location: "Miami DR Site",
      ban: "BAN-12345678", // Same customer
      customerId: "cust-001", // Same customer as trunk-001 & 002
      name: "Acme Disaster Recovery",
      description: "Backup trunk for disaster recovery scenarios",
      status: "active",
      machineId: "machine-03",
      accountCode: "ACME003",
    },
    authentication: {
      type: "both",
      ipWhitelist: [{ ip: "10.0.0.100", subnet: "24", label: "Acme DR Site" }],

      credentials: {
        username: "acme_dr_trunk",
        password: "dr_secure_backup_456",
        realm: "sip.ringer.tel",
      },
    },
    routing: {
      partitions: [{ machineId: "machine-03", priority: 1 }],
      supportedZones: ["INTERSTATE", "INTRASTATE", "LOCAL"],
      jurisdictionPolicy: {
        behavior: "MIXED",
        aniClassification: "DOM",
        normalizeAni: true,
      },
    },
    rates: {
      zones: {
        INTERSTATE: {
          rate: 0.0095,
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        INTRASTATE: {
          rate: 0.0085,
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        LOCAL: {
          rate: 0.0075,
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
      },
      rateLimiting: { enabled: true, maxRate: 0.15 },
    },
    overrides: { static: {}, dynamic: [] },
    exclusions: {
      providers: [],
      destinations: {
        blockedPrefixes: ["900"],
        blockedCountries: [],
        blockPremium: true,
      },
    },
    features: {
      media: {
        codecs: ["PCMU", "PCMA"],
        transcoding: false,
        dtmfMode: "RFC2833",
        faxSupport: "None",
        rtpProxy: "Never",
      },
      calls: {
        maxConcurrentCalls: 500, // Higher capacity for DR
        callsPerSecondLimit: 25,
        sessionTimers: true,
        sessionTimeout: 1800,
      },
    },
    monitoring: {
      qualityThresholds: { minAsr: 90.0, minAcd: 2.0, maxPdd: 4000 },
      homer: { captureSip: false, captureRtpHeaders: false },
    },
    dipIntegration: {
      lrn: {
        enabled: true,
        provider: "Telique",
        cacheDuration: 24,
        fallbackOnFailure: true,
      },
      cic: { enabled: false, dipTimeout: 5000 },
    },
    createdAt: "2024-01-25T14:00:00Z",
    updatedAt: "2024-09-10T08:15:00Z",
    createdBy: "admin@ringer.tel",
    lastModifiedBy: "admin@ringer.tel",
    stats: {
      activeCalls: 0,
      todayMinutes: 0,
      monthlyMinutes: 156,
      asr: 0,
      acd: 0,
      pdd: 0,
    }, // Standby
  },
  // TECHSTART SOLUTIONS - Different customer with multiple purposes
  {
    basic: {
      id: "cust-trunk-004",
      type: "customer",
      direction: "bidirectional",
      purpose: "primary",
      location: "Austin HQ",
      ban: "BAN-87654321",
      customerId: "cust-002",
      name: "TechStart Main Office",
      description: "Primary bidirectional trunk for TechStart Solutions",
      status: "active",
      machineId: "machine-02",
      accountCode: "TECH001",
    },
    authentication: {
      type: "ip_acl",
      ipWhitelist: [
        { ip: "10.0.1.50", subnet: "24", label: "TechStart Office" },
      ],
    },
    routing: {
      partitions: [{ machineId: "machine-02", priority: 1 }],

      supportedZones: ["INTERSTATE", "LOCAL"],
      jurisdictionPolicy: {
        behavior: "INTERSTATE",
        aniClassification: "DOM",
        normalizeAni: true,
      },
    },
    rates: {
      zones: {
        // CUSTOMER OUTBOUND RATES (Usually FREE - inbound DID delivery)
        INTERSTATE: {
          rate: 0.0, // FREE - Customer receives inbound calls at no charge
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        LOCAL: {
          rate: 0.0, // FREE - Customer receives inbound calls at no charge
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
      },
      rateLimiting: { enabled: false },
      // Note: Customer already pays monthly DID rental fees
    },
    overrides: {
      static: {},
      dynamic: [],
    },
    exclusions: {
      providers: [],
      destinations: {
        blockedPrefixes: ["900"],
        blockedCountries: [],
        blockPremium: true,
      },
    },
    features: {
      media: {
        codecs: ["PCMU", "PCMA"],
        transcoding: false,
        dtmfMode: "RFC2833",
        faxSupport: "None",
        rtpProxy: "Never",
      },
      calls: {
        maxConcurrentCalls: 25,
        callsPerSecondLimit: 5,
        sessionTimers: false,
        sessionTimeout: 3600,
      },
    },
    monitoring: {
      qualityThresholds: {
        minAsr: 90.0,
        minAcd: 2.0,
        maxPdd: 4000,
      },
      homer: {
        captureSip: false,
        captureRtpHeaders: false,
      },
    },
    dipIntegration: {
      lrn: {
        enabled: false,
        provider: "Telique",
        cacheDuration: 24,
        fallbackOnFailure: true,
      },
      cic: {
        enabled: false,
        dipTimeout: 5000,
      },
    },
    createdAt: "2024-02-10T09:15:00Z",
    updatedAt: "2024-09-10T11:45:00Z",
    createdBy: "admin@ringer.tel",
    lastModifiedBy: "admin@ringer.tel",
    stats: {
      activeCalls: 8,
      todayMinutes: 456,
      monthlyMinutes: 12340,
      asr: 94.1,
      acd: 2.8,
      pdd: 2800,
    },
  },
  // Add examples for the complete call flow
  {
    basic: {
      id: "vendor-trunk-003",
      type: "vendor",
      name: "Carrier Solutions Inbound",
      status: "active",
      direction: "from_carrier", // Carrier → YOUR PLATFORM (DID traffic)
      partition: "us-central-1",
      description:
        "Receives inbound DID calls from Carrier Solutions for customer delivery",
      providerType: "DID_PROVIDER",
      createdAt: "2024-02-15T14:30:00Z",
      updatedAt: "2024-03-10T09:20:00Z",
    },
    auth: {
      method: "ip_acl",
      allowedIps: ["198.51.100.0/24", "203.0.113.0/24"],
      requireRegistration: false,
    },
    routing: {
      supportedZones: ["DOM", "INTL"],
      techPrefix: "",
      maxConcurrentCalls: 500,
      enableLcr: false, // Inbound doesn't use LCR
    },
    stats: {
      activeCalls: 45,
      todayMinutes: 2890,
      asr: 97.2,
      acd: 3.8,
      pdd: 1.2,
      lastTestResult: "success",
      lastTestTime: "2024-03-15T10:15:00Z",
    },
  },
  {
    basic: {
      id: "cust-trunk-003",
      type: "customer",
      name: "Enterprise Corp Outbound",
      ban: "BAN-55667788",
      status: "active",
      direction: "to_customer", // YOUR PLATFORM → Customer PBX (DID delivery)
      partition: "us-east-1",
      description: "Delivers DID calls to Enterprise Corp PBX system",
      createdAt: "2024-02-20T11:00:00Z",
      updatedAt: "2024-03-14T15:45:00Z",
    },
    auth: {
      method: "combined",
      allowedIps: ["192.0.2.100/32"],
      sipCredentials: {
        username: "enterprise_inbound",
        password: "secure_delivery_2024",
        realm: "sip.yourplatform.com",
      },
      requireRegistration: false,
    },
    routing: {
      supportedZones: ["DOM", "INTL", "TF"],
      techPrefix: "",
      maxConcurrentCalls: 200,
      enableLcr: false, // Customer delivery doesn't use LCR
    },
    stats: {
      activeCalls: 18,
      todayMinutes: 1245,
      asr: 99.1,
      acd: 4.2,
      pdd: 0.8,
      lastTestResult: "success",
      lastTestTime: "2024-03-15T09:30:00Z",
    },
  },
];

// Mock Vendor Trunk Groups - Real-world separation by purpose and quality
export const mockVendorTrunks: SipTrunk[] = [
  // AT&T - Multiple trunks by region and quality
  {
    basic: {
      id: "vendor-trunk-001",
      type: "vendor",
      direction: "outbound_only", // TERMINATION: Platform sends calls TO carrier
      purpose: "quality_tier", // Premium quality tier
      qualityTier: "premium",
      regions: ["US_INTERSTATE"],
      providerId: "PROV-001",
      vendorId: "vendor-001",
      name: "AT&T Interstate Premium",
      description: "Premium quality AT&T termination for US Interstate traffic",
      status: "active",
      machineId: "machine-01",
      providerType: "LRN",
    },
    authentication: {
      type: "sip_digest",
      ipWhitelist: [],
      credentials: {
        username: "ringer_client",
        password: "vendor_auth_456",
        realm: "sip.voicestream.com",
      },
    },
    connection: {
      dialstrings: [
        "sip:+${number}@gateway1.voicestream.com:5060",
        "sip:+${number}@gateway2.voicestream.com:5060",
      ],

      transport: "UDP",
      port: 5060,
      authentication: {
        username: "ringer_client",
        password: "vendor_auth_456",
      },
    },
    routing: {
      partitions: [
        { machineId: "machine-01", priority: 1 },
        { machineId: "machine-02", priority: 2 },
      ],

      supportedZones: ["INTERSTATE", "INTRASTATE", "LOCAL"],
      jurisdictionPolicy: {
        behavior: "MIXED",
        aniClassification: "DOM",
        normalizeAni: true,
      },
    },
    rates: {
      zones: {
        // VENDOR OUTBOUND RATES (Cost - what you pay vendors for termination)
        INTERSTATE: {
          rate: 0.0045, // $0.0045/min - What you pay VoiceStream for termination
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
          maxAcceptableRate: 0.008, // LCR limit - don't route if cost exceeds this
        },
        INTRASTATE: {
          rate: 0.004, // $0.0040/min - What you pay VoiceStream for termination
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
          maxAcceptableRate: 0.007, // LCR limit
        },
        LOCAL: {
          rate: 0.0035, // $0.0035/min - What you pay VoiceStream for termination
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
          maxAcceptableRate: 0.006, // LCR limit
        },
      },
      rateLimiting: { enabled: true, maxRate: 0.01 },
    },
    overrides: {
      static: {},
      dynamic: [],
    },
    exclusions: {
      providers: [],
      destinations: {
        blockedPrefixes: [],
        blockedCountries: [],
        blockPremium: false,
      },
    },
    features: {
      media: {
        codecs: ["PCMU", "PCMA", "G729"],
        transcoding: true,
        dtmfMode: "RFC2833",
        faxSupport: "G711_Passthrough",
        rtpProxy: "Always",
      },
      calls: {
        maxConcurrentCalls: 1000,
        callsPerSecondLimit: 50,
        sessionTimers: true,
        sessionTimeout: 1800,
      },
    },
    monitoring: {
      qualityThresholds: {
        minAsr: 98.0,
        minAcd: 3.0,
        maxPdd: 2000,
      },
      homer: {
        captureSip: true,
        captureRtpHeaders: true,
        hepNodeId: 201,
      },
    },
    dipIntegration: {
      lrn: {
        enabled: true,
        provider: "Telique",
        cacheDuration: 48,
        fallbackOnFailure: true,
      },
      cic: {
        enabled: false,
        dipTimeout: 3000,
      },
    },
    createdAt: "2024-01-05T08:00:00Z",
    updatedAt: "2024-09-12T16:30:00Z",
    createdBy: "admin@ringer.tel",
    lastModifiedBy: "admin@ringer.tel",
    stats: {
      activeCalls: 156,
      todayMinutes: 8934,
      monthlyMinutes: 234567,
      asr: 98.7,
      acd: 3.4,
      pdd: 1800,
    },
  },
  {
    basic: {
      id: "vendor-trunk-002",
      type: "vendor",
      direction: "outbound_only",
      purpose: "geographic", // Geographic specialization
      qualityTier: "premium",
      regions: ["US_CA_INTRASTATE"],
      providerId: "PROV-001", // Same vendor, different trunk
      vendorId: "vendor-001", // Same vendor as trunk-001
      name: "AT&T California Intrastate",
      description:
        "AT&T termination specialized for California intrastate traffic",
      status: "active",
      machineId: "machine-02",
      providerType: "LRN",
    },
    authentication: {
      type: "sip_digest",
      ipWhitelist: [],
      credentials: {
        username: "ringer_ca_client",
        password: "ca_auth_456",
        realm: "ca.sip.att.com",
      },
    },
    connection: {
      dialstrings: [
        "sip:+${number}@ca-gateway1.att.com:5060",
        "sip:+${number}@ca-gateway2.att.com:5060",
      ],

      transport: "UDP",
      port: 5060,
      authentication: {
        username: "ringer_ca_client",
        password: "ca_auth_456",
      },
    },
    routing: {
      partitions: [{ machineId: "machine-02", priority: 1 }],
      supportedZones: ["INTRASTATE"],
      jurisdictionPolicy: {
        behavior: "INTRASTATE",
        poiState: "CA",
        aniClassification: "DOM",
        normalizeAni: true,
      },
    },
    rates: {
      zones: {
        INTRASTATE: {
          rate: 0.0038, // Better CA intrastate rate
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
          maxAcceptableRate: 0.006,
        },
      },
      rateLimiting: { enabled: true, maxRate: 0.008 },
    },
    overrides: { static: {}, dynamic: [] },
    exclusions: {
      providers: [],
      destinations: {
        blockedPrefixes: [],
        blockedCountries: [],
        blockPremium: false,
      },
    },
    features: {
      media: {
        codecs: ["PCMU", "PCMA", "G729"],
        transcoding: true,
        dtmfMode: "RFC2833",
        faxSupport: "G711_Passthrough",
        rtpProxy: "Always",
      },
      calls: {
        maxConcurrentCalls: 500,
        callsPerSecondLimit: 30,
        sessionTimers: true,
        sessionTimeout: 1800,
      },
    },
    monitoring: {
      qualityThresholds: { minAsr: 98.5, minAcd: 3.0, maxPdd: 1800 },
      homer: { captureSip: true, captureRtpHeaders: true, hepNodeId: 202 },
    },
    dipIntegration: {
      lrn: {
        enabled: true,
        provider: "Telique",
        cacheDuration: 48,
        fallbackOnFailure: true,
      },
      cic: { enabled: false, dipTimeout: 3000 },
    },
    createdAt: "2024-01-10T11:00:00Z",
    updatedAt: "2024-09-12T14:20:00Z",
    createdBy: "admin@ringer.tel",
    lastModifiedBy: "admin@ringer.tel",
    stats: {
      activeCalls: 89,
      todayMinutes: 4567,
      monthlyMinutes: 123456,
      asr: 98.9,
      acd: 3.2,
      pdd: 1600,
    },
  },
  // BANDWIDTH - DID ORIGINATION (Inbound trunk)
  {
    basic: {
      id: "vendor-trunk-003",
      type: "vendor",
      direction: "inbound_only", // DID ORIGINATION: Vendor sends calls TO platform
      purpose: "primary", // Primary DID provider
      qualityTier: "premium",
      regions: ["US_DID_RANGES"],
      providerId: "PROV-002",
      vendorId: "vendor-002",
      name: "Bandwidth DIDs - NY/CA",
      description:
        "Bandwidth DID origination for New York and California numbers",
      status: "active",
      machineId: "machine-01",
      providerType: "DNIS",
    },
    authentication: {
      type: "ip_acl",
      ipWhitelist: [
        { ip: "198.51.100.10", subnet: "32", label: "Bandwidth Gateway 1" },
        { ip: "198.51.100.11", subnet: "32", label: "Bandwidth Gateway 2" },
      ],
    },
    routing: {
      partitions: [{ machineId: "machine-01", priority: 1 }],
      supportedZones: ["INTERSTATE", "INTRASTATE", "LOCAL"],
      jurisdictionPolicy: {
        behavior: "MIXED",
        aniClassification: "DOM",
        normalizeAni: true,
      },
    },
    rates: {
      zones: {
        // VENDOR INBOUND RATES (Usually N/A or revenue sharing)
        INTERSTATE: {
          rate: 0.0,
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        INTRASTATE: {
          rate: 0.0,
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
        LOCAL: {
          rate: 0.0,
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
        },
      },
      rateLimiting: { enabled: false },
    },
    overrides: { static: {}, dynamic: [] },
    exclusions: {
      providers: [],
      destinations: {
        blockedPrefixes: [],
        blockedCountries: [],
        blockPremium: false,
      },
    },
    features: {
      media: {
        codecs: ["PCMU", "PCMA"],
        transcoding: false,
        dtmfMode: "RFC2833",
        faxSupport: "T38",
        rtpProxy: "Never",
      },
      calls: {
        maxConcurrentCalls: 1000,
        callsPerSecondLimit: 100,
        sessionTimers: false,
        sessionTimeout: 3600,
      },
    },
    monitoring: {
      qualityThresholds: { minAsr: 99.0, minAcd: 4.0, maxPdd: 1000 },
      homer: { captureSip: true, captureRtpHeaders: false, hepNodeId: 203 },
    },
    dipIntegration: {
      lrn: {
        enabled: false,
        provider: "Telique",
        cacheDuration: 24,
        fallbackOnFailure: true,
      },
      cic: { enabled: false, dipTimeout: 5000 },
    },
    createdAt: "2024-01-15T09:30:00Z",
    updatedAt: "2024-09-14T12:45:00Z",
    createdBy: "admin@ringer.tel",
    lastModifiedBy: "admin@ringer.tel",
    stats: {
      activeCalls: 67,
      todayMinutes: 3421,
      monthlyMinutes: 89456,
      asr: 99.2,
      acd: 4.1,
      pdd: 800,
    },
  },
  // TELNYX - International termination
  {
    basic: {
      id: "vendor-trunk-004",
      type: "vendor",
      direction: "outbound_only",
      purpose: "geographic", // International specialization
      qualityTier: "standard",
      regions: ["INTERNATIONAL", "ZONE1"],
      providerId: "PROV-003",
      vendorId: "vendor-003",
      name: "Telnyx International",
      description: "Telnyx termination for international and Zone 1 traffic",
      status: "active",
      machineId: "machine-04",
      providerType: "INTERNATIONAL",
    },
    authentication: {
      type: "both",
      ipWhitelist: [
        { ip: "203.0.113.10", subnet: "32", label: "IGP Gateway 1" },
        { ip: "203.0.113.11", subnet: "32", label: "IGP Gateway 2" },
      ],

      credentials: {
        username: "ringer_intl",
        password: "intl_secure_789",
        realm: "international.gateway.pro",
      },
    },
    connection: {
      dialstrings: [
        "sip:+${number}@intl1.gateway.pro:5060",
        "sip:+${number}@intl2.gateway.pro:5060",
      ],

      transport: "TLS",
      port: 5061,
      authentication: {
        username: "ringer_intl",
        password: "intl_secure_789",
      },
    },
    routing: {
      partitions: [{ machineId: "machine-04", priority: 1 }],

      supportedZones: ["INTERNATIONAL", "ZONE1"],
      jurisdictionPolicy: {
        behavior: "INTERSTATE",
        aniClassification: "INTL",
        normalizeAni: false,
      },
    },
    rates: {
      zones: {
        // VENDOR OUTBOUND RATES (Cost - what you pay vendors for international termination)
        INTERNATIONAL: {
          rate: 0.018, // $0.018/min - What you pay IGP for international termination
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
          maxAcceptableRate: 0.05, // LCR limit for international
        },
        ZONE1: {
          rate: 0.015, // $0.015/min - What you pay IGP for Zone 1 countries
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
          maxAcceptableRate: 0.03, // LCR limit for Zone 1
        },
      },
      rateLimiting: { enabled: true, maxRate: 0.1 },
    },
    overrides: {
      static: {
        intlOverride: 0.022,
      },
      dynamic: [
        {
          id: "override-002",
          type: "Prefix",
          matchPattern: "44",
          overrideRate: 0.015,
          priority: 5,
          effectiveDate: "2024-01-01",
        },
      ],
    },
    exclusions: {
      providers: [],
      destinations: {
        blockedPrefixes: [],
        blockedCountries: ["CU", "IR", "KP"],
        blockPremium: true,
      },
    },
    features: {
      media: {
        codecs: ["PCMU", "PCMA", "G729", "G722"],
        transcoding: true,
        dtmfMode: "RFC2833",
        faxSupport: "None",
        rtpProxy: "Always",
      },
      calls: {
        maxConcurrentCalls: 500,
        callsPerSecondLimit: 25,
        sessionTimers: true,
        sessionTimeout: 1800,
      },
    },
    monitoring: {
      qualityThresholds: {
        minAsr: 92.0,
        minAcd: 2.0,
        maxPdd: 5000,
      },
      homer: {
        captureSip: true,
        captureRtpHeaders: false,
        hepNodeId: 202,
      },
    },
    dipIntegration: {
      lrn: {
        enabled: false,
        provider: "Telique",
        cacheDuration: 24,
        fallbackOnFailure: true,
      },
      cic: {
        enabled: false,
        dipTimeout: 5000,
      },
    },
    authentication: {
      type: "both",
      ipWhitelist: [
        { ip: "203.0.113.20", subnet: "32", label: "Telnyx Gateway 1" },
        { ip: "203.0.113.21", subnet: "32", label: "Telnyx Gateway 2" },
      ],

      credentials: {
        username: "ringer_intl",
        password: "intl_secure_789",
        realm: "sip.telnyx.com",
      },
    },
    connection: {
      dialstrings: [
        "sip:+${number}@sip.telnyx.com:5060",
        "sip:+${number}@sip-backup.telnyx.com:5060",
      ],

      transport: "TLS",
      port: 5061,
      authentication: {
        username: "ringer_intl",
        password: "intl_secure_789",
      },
    },
    routing: {
      partitions: [{ machineId: "machine-04", priority: 1 }],
      supportedZones: ["INTERNATIONAL", "ZONE1"],
      jurisdictionPolicy: {
        behavior: "INTERSTATE",
        aniClassification: "INTL",
        normalizeAni: false,
      },
    },
    rates: {
      zones: {
        INTERNATIONAL: {
          rate: 0.015, // Competitive international rate
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
          maxAcceptableRate: 0.04,
        },
        ZONE1: {
          rate: 0.012, // Zone 1 countries (UK, Canada, etc.)
          effectiveDate: "2024-01-01",
          minimumDuration: 6,
          increment: 6,
          maxAcceptableRate: 0.025,
        },
      },
      rateLimiting: { enabled: true, maxRate: 0.08 },
    },
    overrides: {
      static: { intlOverride: 0.018 },
      dynamic: [
        {
          id: "override-intl-001",
          type: "Prefix",
          matchPattern: "44", // UK
          overrideRate: 0.01,
          priority: 5,
          effectiveDate: "2024-01-01",
        },
      ],
    },
    exclusions: {
      providers: [],
      destinations: {
        blockedPrefixes: [],
        blockedCountries: ["CU", "IR", "KP"], // Sanctioned countries
        blockPremium: true,
      },
    },
    features: {
      media: {
        codecs: ["PCMU", "PCMA", "G729", "G722"],
        transcoding: true,
        dtmfMode: "RFC2833",
        faxSupport: "None",
        rtpProxy: "Always",
      },
      calls: {
        maxConcurrentCalls: 300,
        callsPerSecondLimit: 15,
        sessionTimers: true,
        sessionTimeout: 1800,
      },
    },
    monitoring: {
      qualityThresholds: { minAsr: 90.0, minAcd: 2.0, maxPdd: 6000 },
      homer: { captureSip: true, captureRtpHeaders: false, hepNodeId: 204 },
    },
    dipIntegration: {
      lrn: {
        enabled: false,
        provider: "Telique",
        cacheDuration: 24,
        fallbackOnFailure: true,
      },
      cic: { enabled: false, dipTimeout: 5000 },
    },
    createdAt: "2024-01-25T15:00:00Z",
    updatedAt: "2024-09-13T09:30:00Z",
    createdBy: "admin@ringer.tel",
    lastModifiedBy: "admin@ringer.tel",
    stats: {
      activeCalls: 34,
      todayMinutes: 1876,
      monthlyMinutes: 45678,
      asr: 91.8,
      acd: 2.4,
      pdd: 5200,
    },
  },
];

// Combined trunk data
export const mockTrunks = [...mockCustomerTrunks, ...mockVendorTrunks];

// Trunk statistics
export const mockTrunkStats = {
  totalTrunks: mockTrunks.length,
  customerTrunks: mockCustomerTrunks.length,
  vendorTrunks: mockVendorTrunks.length,
  activeTrunks: mockTrunks.filter((t) => t.basic.status === "active").length,
  totalActiveCalls: mockTrunks.reduce(
    (sum, t) => sum + (t.stats?.activeCalls || 0),
    0
  ),
  totalTodayMinutes: mockTrunks.reduce(
    (sum, t) => sum + (t.stats?.todayMinutes || 0),
    0
  ),
  averageAsr:
    mockTrunks.reduce((sum, t) => sum + (t.stats?.asr || 0), 0) /
    mockTrunks.length,
  averageAcd:
    mockTrunks.reduce((sum, t) => sum + (t.stats?.acd || 0), 0) /
    mockTrunks.length,
};

// Rate templates for quick configuration
export const mockRateTemplates = [
  {
    id: "template-customer-standard",
    name: "Customer Standard Revenue Rates",
    type: "customer_inbound", // What you charge customers for their outbound calls
    description: "Standard rates charged to customers for outbound calling",
    rates: {
      INTERSTATE: 0.0095, // Revenue: $0.0095/min
      INTRASTATE: 0.0085, // Revenue: $0.0085/min
      LOCAL: 0.0075, // Revenue: $0.0075/min
      TOLLFREE: 0.012, // Revenue: $0.0120/min (toll-free origination)
    },
    marginAnalysis: {
      INTERSTATE: { vendorCost: 0.0045, margin: 0.005, marginPercent: 52.6 },
      INTRASTATE: { vendorCost: 0.004, margin: 0.0045, marginPercent: 52.9 },
      LOCAL: { vendorCost: 0.0035, margin: 0.004, marginPercent: 53.3 },
      TOLLFREE: { vendorCost: 0.008, margin: 0.004, marginPercent: 33.3 },
    },
  },
  {
    id: "template-customer-premium",
    name: "Customer Premium Revenue Rates",
    type: "customer_inbound", // What you charge customers for their outbound calls
    description: "Premium rates charged to high-value customers",
    rates: {
      INTERSTATE: 0.012, // Revenue: $0.012/min
      INTRASTATE: 0.011, // Revenue: $0.011/min
      LOCAL: 0.0095, // Revenue: $0.0095/min
      TOLLFREE: 0.015, // Revenue: $0.015/min
    },
    marginAnalysis: {
      INTERSTATE: { vendorCost: 0.0045, margin: 0.0075, marginPercent: 62.5 },
      INTRASTATE: { vendorCost: 0.004, margin: 0.007, marginPercent: 63.6 },
      LOCAL: { vendorCost: 0.0035, margin: 0.006, marginPercent: 63.2 },
      TOLLFREE: { vendorCost: 0.008, margin: 0.007, marginPercent: 46.7 },
    },
  },
  {
    id: "template-vendor-tier1",
    name: "Tier 1 Vendor Cost Rates",
    type: "vendor_outbound", // What you pay vendors for termination
    description: "Cost rates from Tier 1 carriers (AT&T, Verizon, etc.)",
    rates: {
      INTERSTATE: 0.0045, // Cost: $0.0045/min
      INTRASTATE: 0.004, // Cost: $0.0040/min
      LOCAL: 0.0035, // Cost: $0.0035/min
      INTERNATIONAL: 0.018, // Cost: $0.018/min
      TOLLFREE: 0.008, // Cost: $0.008/min
    },
  },
  {
    id: "template-vendor-wholesale",
    name: "Wholesale Vendor Cost Rates",
    type: "vendor_outbound", // What you pay vendors for termination
    description: "Competitive wholesale termination rates",
    rates: {
      INTERSTATE: 0.0038, // Cost: $0.0038/min (better than Tier 1)
      INTRASTATE: 0.0033, // Cost: $0.0033/min
      LOCAL: 0.0028, // Cost: $0.0028/min
      INTERNATIONAL: 0.015, // Cost: $0.015/min
      TOLLFREE: 0.007, // Cost: $0.007/min
    },
  },
  {
    id: "template-customer-inbound-free",
    name: "Customer Inbound Delivery (Free)",
    type: "customer_outbound", // What you charge customers for inbound delivery (usually free)
    description: "Free inbound DID delivery to customers (standard model)",
    rates: {
      INTERSTATE: 0.0, // FREE - Customer receives calls at no charge
      INTRASTATE: 0.0, // FREE - Customer receives calls at no charge
      LOCAL: 0.0, // FREE - Customer receives calls at no charge
      TOLLFREE: 0.0, // FREE - Customer receives toll-free calls at no charge
    },
    note: "Customers pay monthly DID rental fees instead of per-minute charges",
  },
];

// Test results for trunk validation
export interface TrunkTestResult {
  id: string;
  trunkId: string;
  testType:
    | "sip_options"
    | "test_call"
    | "route_simulation"
    | "rate_calculation";
  testTime: string;
  success: boolean;
  result: any;
  duration?: number;
  error?: string;
}

export const mockTestResults: TrunkTestResult[] = [
  {
    id: "test-001",
    trunkId: "cust-trunk-001",
    testType: "sip_options",
    testTime: "2024-09-17T10:30:00Z",
    success: true,
    result: { responseCode: 200, responseTime: 150 },
    duration: 150,
  },
  {
    id: "test-002",
    trunkId: "vendor-trunk-001",
    testType: "test_call",
    testTime: "2024-09-17T10:25:00Z",
    success: true,
    result: {
      callId: "test-call-12345",
      duration: 30,
      quality: { asr: 100, pdd: 1800 },
    },
    duration: 30000,
  },
];
