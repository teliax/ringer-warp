# Admin UI Prompt for Vendor & Customer SIP Trunk Configuration

## Overview
Build a comprehensive admin interface at admin.ringer.tel for configuring both vendor (downstream providers) and customer (upstream clients) SIP trunks with the sophistication discovered in the existing Kamailio routing system.

## Core Configuration Requirements

### 1. Trunk Basic Information

#### Customer Trunks (Inbound)
```yaml
Basic Info:
  - BAN (Billing Account Number)
  - Trunk Name/Description
  - Status: Active/Suspended/Testing
  - Machine ID (Routing Partition): Select from available partitions
  - Account Code: For billing correlation

Authentication:
  - Type: [IP ACL, SIP Digest, Both, None]
  - IP Whitelist: Multiple IPs/subnets with labels
  - Credentials: Username/Password for digest auth
  - Tech Prefix: Optional prefix to strip
```

#### Vendor Trunks (Outbound)
```yaml
Basic Info:
  - Provider ID
  - Provider Name
  - Type: [LRN, OCNLATA, DNIS, TOLLFREE, INTERNATIONAL]
  - Status: Active/Suspended/Testing

Connection:
  - Dialstrings: Multiple SIP URIs for load balancing
    Example: "sip:+${number}@gateway1.provider.com:5060"
  - Transport: UDP/TCP/TLS
  - Authentication: If required by vendor
```

### 2. Routing Configuration

#### Partition (Machine) Assignment
```yaml
Partition Management:
  - Assign trunk to partition(s)
  - View available routes in partition
  - Partition priority (if multiple)
  - Time-based partition switching:
    - Business hours partition
    - After-hours partition
    - Weekend partition
```

#### Zone & Jurisdiction Configuration
```yaml
Zone Handling:
  - Supported Zones:
    ☑ INTERSTATE
    ☑ INTRASTATE
    ☑ LOCAL
    ☑ INTERNATIONAL
    ☑ ZONE1 (Special International)
    ☑ TOLLFREE

Jurisdiction Policy (IJ):
  - Behavior: [INTRASTATE, INTERSTATE, POI, MIXED]
  - POI State: (if POI selected) [State dropdown]
  - ANI Classification: [DOM, DOMTF, INTL, ANY]
  - ANI Prefix Requirements: (optional prefix)
  - Normalize ANI: Yes/No
```

### 3. Rating & Cost Configuration

#### Rate Tables (Per Zone)
```yaml
Domestic Rates:
  - Interstate Rate: $0.00000 per minute
  - Intrastate Rate: $0.00000 per minute
  - Local Rate: $0.00000 per minute
  - Rate Effective Date: DateTime

Billing Increments:
  - Minimum Duration: seconds (default 6)
  - Increment: seconds (default 6)

Rate Limits:
  - Max Acceptable Rate: $0.00000 (for LCR)
  - Enable Rate Limiting: Yes/No
```

#### Override System
```yaml
Customer Overrides:
  - Static DOM Override: $0.00000 (optional)
  - Static INTL Override: $0.00000 (optional)
  - Static CIC Override: $0.00000 (optional)

Dynamic Override Rules:
  - Type: [NPANxx, OCN/LATA, Prefix, CIC]
  - Match Pattern: [pattern]
  - Override Rate: $0.00000
  - Priority: 1-100
  - Max Override: $0.00000 (ceiling)
```

### 4. Advanced Routing Rules

#### Exclusions
```yaml
Provider Exclusions:
  - Exclude Providers: [Multi-select list]
  - Exclusion Reason: [Quality, Cost, Business, Temporary]
  - Effective Period: Start/End DateTime

Destination Exclusions:
  - Blocked Prefixes: [List of prefixes]
  - Blocked Countries: [Country codes]
  - Block Premium: Yes/No (900, 976, etc.)
```

#### Routing Preferences
```yaml
LCR Configuration:
  - Enable LCR: Yes/No
  - LCR Type: [Least Cost, Quality First, Blended]
  - Max Routes to Try: 1-10
  - Failover Timeout: seconds

Route Testing:
  - Preferred Providers: [Ordered list]
  - Backup Providers: [Ordered list]
  - Never Use Providers: [Exclusion list]
```

### 5. Features & Capabilities

#### Technical Features
```yaml
Media Handling:
  - Codecs: [PCMU, PCMA, G729, G722, OPUS]
  - Transcoding: Enable/Disable
  - DTMF Mode: [RFC2833, SIP INFO, Inband]
  - Fax Support: [T.38, G.711 Passthrough, None]
  - RTP Proxy: [Always, Never, NAT Only]

Call Features:
  - Max Concurrent Calls: number
  - Calls Per Second Limit: number
  - Session Timers: Enable/Disable
  - Session Timeout: seconds
```

#### Monitoring & Quality
```yaml
Quality Thresholds:
  - Min ASR: percentage (Alert if below)
  - Min ACD: minutes (Alert if below)
  - Max PDD: milliseconds (Alert if above)

Homer Integration:
  - Capture SIP: Yes/No
  - Capture RTP Headers: Yes/No
  - HEP Node ID: number
```

### 6. DIP Integration Settings

#### LRN Configuration
```yaml
LRN Dip:
  - Enable LRN Dip: Yes/No
  - LRN Provider: [Telique, Custom URL]
  - Custom LRN URL: (if custom)
  - Cache Duration: hours
  - Fallback on Failure: Yes/No
```

#### CIC Configuration (Toll-Free)
```yaml
CIC Dip:
  - Enable CIC Dip: Yes/No
  - CIC Provider URL:
  - Dip Timeout: milliseconds
  - Default CIC: (if dip fails)
```

## UI Components Required

### 1. Main Trunk List View
```typescript
interface TrunkListView {
  search: SearchBar;
  filters: {
    type: ['Customer', 'Vendor'];
    status: ['Active', 'Suspended', 'Testing'];
    partition: PartitionSelector;
  };
  columns: [
    'Trunk ID/BAN',
    'Name',
    'Type',
    'Status',
    'Partition',
    'Active Calls',
    'Today\'s Minutes',
    'Actions'
  ];
  bulkActions: ['Enable', 'Disable', 'Delete', 'Export'];
}
```

### 2. Trunk Configuration Form
```typescript
interface TrunkConfigForm {
  sections: {
    basic: BasicInfoSection;
    authentication: AuthenticationSection;
    routing: RoutingSection;
    rates: RatesSection;
    overrides: OverridesSection;
    exclusions: ExclusionsSection;
    features: FeaturesSection;
    monitoring: MonitoringSection;
  };

  actions: {
    save: () => void;
    saveAndTest: () => void;
    duplicate: () => void;
    delete: () => void;
    viewHistory: () => void;
  };

  validation: {
    realtime: boolean;  // Validate as user types
    onSubmit: boolean;  // Validate before save
  };
}
```

### 3. Rate Management Interface
```typescript
interface RateManager {
  bulkImport: CSVImporter;
  rateHistory: TimelineView;
  rateComparison: ComparisonMatrix;
  effectiveDateScheduler: DateTimePicker;

  templates: {
    copyFromTrunk: TrunkSelector;
    applyTemplate: TemplateSelector;
    saveAsTemplate: TemplateSaver;
  };
}
```

### 4. Testing & Validation Tools
```typescript
interface TrunkTester {
  sipOptions: () => TestResult;  // Send OPTIONS ping
  testCall: (testNumber: string) => CallResult;
  routeSimulation: (fromNumber: string, toNumber: string) => Route[];
  rateCalculation: (destination: string) => RateResult;

  monitoring: {
    realtimeCalls: ActiveCallsWidget;
    last24Hours: MetricsGraph;
    qualityScores: QualityDashboard;
  };
}
```

## Extensibility Requirements

### 1. Custom Fields Framework
```yaml
CustomFieldSupport:
  - Add custom fields per trunk type
  - Field types: Text, Number, Select, Boolean, JSON
  - Validation rules: Regex, Range, Required
  - API exposure: Include in webhooks/exports
```

### 2. Plugin Architecture
```yaml
Plugins:
  - Before Save Hooks
  - After Save Hooks
  - Custom Validation Rules
  - Rate Calculation Modifiers
  - Custom DIP Providers
```

### 3. Import/Export
```yaml
DataPortability:
  - Export formats: JSON, CSV, XML
  - Import with validation
  - Bulk update via CSV
  - API for programmatic access
  - Terraform provider for IaC
```

## Database Schema Extensions Needed

```sql
-- Additional tables for UI configuration
CREATE TABLE trunk_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  type ENUM('customer', 'vendor'),
  config JSON,
  created_by VARCHAR(255),
  created_at TIMESTAMP
);

CREATE TABLE trunk_history (
  id BIGSERIAL PRIMARY KEY,
  trunk_id VARCHAR(255),
  changed_by VARCHAR(255),
  changed_at TIMESTAMP,
  field_changed VARCHAR(255),
  old_value TEXT,
  new_value TEXT
);

CREATE TABLE routing_test_results (
  id UUID PRIMARY KEY,
  trunk_id VARCHAR(255),
  test_type VARCHAR(50),
  test_time TIMESTAMP,
  result JSON,
  success BOOLEAN
);
```

## Priority Features for MVP

### Phase 1 (Must Have):
1. Basic trunk CRUD
2. IP ACL management
3. Simple rate configuration
4. Partition assignment
5. Basic routing rules

### Phase 2 (Should Have):
1. Override system
2. Exclusion rules
3. Rate history
4. Testing tools
5. Bulk import

### Phase 3 (Nice to Have):
1. Template system
2. Advanced scheduling
3. Custom fields
4. Audit history
5. Terraform provider

## Insights from Existing PHP UI Analysis

Based on analysis of `/home/daldworth/repos/vlcadmin`, the current system includes:

### Verified Provider Configuration Fields
- **Provider Type Options**: INTERNATIONAL, OTHER, DNIS, LRN, OCNLATA, CUSTOMER, RATEDECK
- **Jurisdiction Classes**: ENHANCED, NONENHANCED, DIALER, UNKNOWN
- **IJ Policy Options**: INTRASTATE, INTERSTATE, POI, NOTAPPLICABLE
- **Name Policy**: DENY/ALLOW for international providers

### Verified Override Management
- **Override Types**: LRN, DNIS, OCNLATA for domestic
- **Rate Fields**: Includes ceiling, floor (maxrate), call duration min/increment
- **Regional Support**: US, Mexico, Other checkboxes
- **Null-friendly**: All rate fields optional

### Configuration Workflow
- **Staging System**: Uses `_scratch` tables for work copies
- **Sync Queue**: Changes queued before going live
- **No Approval Workflow**: Direct save to production tables

### Database Schema Patterns
```sql
-- Key tables discovered:
- origin (providers and customers)
- dial (dialstrings with machine_id)
- machine (partition definitions)
- rate_exclusions (customer-provider exclusions)
- formula_override2 (rate overrides)
- wholesaleusers_new2 (customer details)
- configblocks/configvalues (application configs)
```

## Answers to Previous Questions

1. **PHP UI Reviewed** ✓ - Feature parity achieved
2. **Rate Precision**: System uses DECIMAL fields, UI shows 5-7 decimal places
3. **Approval Workflow**: None currently - direct saves
4. **Multi-tenant**: Single admin view, account manager assignments only
5. **Real-time Updates**: Uses staging tables with sync mechanism

---

This prompt provides a comprehensive blueprint for the admin UI that matches the sophistication of the existing Kamailio routing system while building on an extensible foundation for future enhancements.