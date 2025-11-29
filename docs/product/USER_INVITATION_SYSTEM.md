# WARP Platform - User Invitation System

**Version**: 1.0.0
**Date**: October 27, 2025
**Status**: Planning
**Owner**: Platform Engineering Team

---

## Executive Summary

This document outlines the complete user invitation and onboarding system for WARP. Currently, only @ringer.tel employees can login (auto-created as "viewer"). This system will enable:

1. ✅ **Ringer admins** can invite customer users to their accounts
2. ✅ **Customer admins** can invite additional users to their customer account
3. ✅ **Email-based invitations** with secure, time-limited tokens
4. ✅ **Role assignment** at invitation time (admin, user, billing, etc.)
5. ✅ **Self-service acceptance** via invitation link
6. ✅ **Automatic customer assignment** when user accepts

**Current Gap**: No way to onboard customer users. Only david.aldworth@ringer.tel can use the system.

---

## User Invitation Flow

### Scenario 1: Admin Invites Customer User

```
1. Admin logs into Admin Portal
   ↓
2. Navigates to Customers → TEST-001 → Users → Invite User
   ↓
3. Fills invitation form:
   - Email: john.doe@acmecorp.com
   - Role: customer_admin (can manage account)
   - Customer: TEST-001 (auto-selected)
   - Message: "Welcome to WARP! You can now manage your telecom services."
   ↓
4. Click "Send Invitation"
   ↓
5. WARP API: POST /v1/admin/users/invitations
   - Generates secure token (UUID)
   - Stores invitation in database
   - Sends email with invitation link
   ↓
6. John receives email:
   Subject: "You've been invited to WARP Platform"
   Body: "Click here to accept: https://admin.rns.ringer.tel/invitations/accept/{token}"
   ↓
7. John clicks link → Redirected to invitation acceptance page
   ↓
8. Page loads invitation details:
   - Company: Acme Telecom Corp (TEST-001)
   - Role: Customer Admin
   - Invited by: david.aldworth@ringer.tel
   - Expires: 7 days from now
   ↓
9. John clicks "Sign in with Google"
   ↓
10. Google OAuth flow → Returns to /invitations/accept/{token}
    ↓
11. Frontend calls: POST /v1/invitations/{token}/accept
    - Validates token not expired
    - Creates user account (if doesn't exist)
    - Assigns customer access (inserts into user_customer_access)
    - Marks invitation as ACCEPTED
    ↓
12. John redirected to Customer Portal dashboard
    - Can now see TEST-001 customer data
    - Can manage trunks, numbers, messages
```

---

## Database Schema

### Invitations Table

```sql
CREATE TABLE auth.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Invitation details
    token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    user_type_id UUID NOT NULL REFERENCES auth.user_types(id),

    -- Customer assignment (what they'll get access to)
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'USER', -- USER, ADMIN, OWNER

    -- Invitation metadata
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    message TEXT, -- Custom message from inviter
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      -- PENDING, ACCEPTED, EXPIRED, REVOKED
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    accepted_by_user_id UUID REFERENCES auth.users(id),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(email, customer_id, status) -- Prevent duplicate pending invitations
);

CREATE INDEX idx_invitations_token ON auth.user_invitations(token);
CREATE INDEX idx_invitations_email ON auth.user_invitations(email);
CREATE INDEX idx_invitations_status ON auth.user_invitations(status);
CREATE INDEX idx_invitations_expires ON auth.user_invitations(expires_at) WHERE status = 'PENDING';
CREATE INDEX idx_invitations_customer ON auth.user_invitations(customer_id);
```

### Invitation Status States

```
PENDING → User invited, email sent, waiting for acceptance
ACCEPTED → User accepted and account created
EXPIRED → Token expired (7 days passed)
REVOKED → Admin cancelled invitation before acceptance
```

---

## API Endpoints

### Admin Operations (Creating Invitations)

#### POST `/v1/admin/customers/:customerId/invitations`

**Purpose**: Invite a user to a specific customer account

**Permission Required**: `/api/v1/admin/users/*` (admin, superAdmin)

**Request**:
```json
{
  "email": "john.doe@acmecorp.com",
  "user_type": "customer_admin",  // or "viewer", "developer", "billing"
  "role": "ADMIN",  // USER, ADMIN, OWNER (in user_customer_access)
  "message": "Welcome to WARP! You can now manage your telecom services."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "invitation-uuid",
    "token": "secure-token-uuid",
    "email": "john.doe@acmecorp.com",
    "customer": {
      "id": "customer-uuid",
      "company_name": "Acme Telecom Corp",
      "ban": "TEST-001"
    },
    "user_type": "customer_admin",
    "expires_at": "2025-11-03T12:00:00Z",
    "status": "PENDING"
  }
}
```

**Backend Logic** (`internal/handlers/invitations.go`):
```go
func (h *InvitationHandler) CreateInvitation(c *gin.Context) {
    customerID := c.Param("customerId")

    // Verify inviter has access to this customer
    var customerFilter []uuid.UUID
    if accessible, exists := c.Get("accessible_customer_ids"); exists {
        customerFilter = accessible.([]uuid.UUID)
    }
    if err := VerifyCustomerAccess(customerID, customerFilter); err != nil {
        c.JSON(403, "Cannot invite users to this customer")
        return
    }

    var req CreateInvitationRequest
    c.BindJSON(&req)

    // Validate email not already a user
    existingUser, _ := h.userRepo.GetByEmail(ctx, req.Email)
    if existingUser != nil {
        c.JSON(400, "User already exists - use customer assignment instead")
        return
    }

    // Create invitation
    invitation, err := h.invitationRepo.Create(ctx, &req, invitedByUserID)

    // Send email
    emailService.SendInvitation(invitation)

    c.JSON(201, invitation)
}
```

---

#### GET `/v1/admin/invitations`

**Purpose**: List all pending invitations

**Permission Required**: `/api/v1/admin/users/*`

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "email": "john@acmecorp.com",
        "customer": {"company_name": "Acme Corp"},
        "user_type": "customer_admin",
        "status": "PENDING",
        "invited_by": "david.aldworth@ringer.tel",
        "expires_at": "2025-11-03T12:00:00Z"
      }
    ]
  }
}
```

---

#### DELETE `/v1/admin/invitations/:id`

**Purpose**: Revoke a pending invitation

**Permission Required**: `/api/v1/admin/users/*`

**Response**:
```json
{
  "success": true,
  "message": "Invitation revoked successfully"
}
```

---

### Public Operations (Accepting Invitations)

#### GET `/v1/invitations/:token`

**Purpose**: Get invitation details (PUBLIC endpoint - no auth)

**Security**: Token is the secret - knowing token = can view invitation

**Response**:
```json
{
  "success": true,
  "data": {
    "email": "john@acmecorp.com",
    "customer": {
      "company_name": "Acme Telecom Corp",
      "ban": "TEST-001"
    },
    "user_type": "customer_admin",
    "user_type_description": "Customer account admin - manages own account",
    "invited_by": {
      "name": "David Aldworth",
      "email": "david.aldworth@ringer.tel"
    },
    "expires_at": "2025-11-03T12:00:00Z",
    "status": "PENDING"
  }
}
```

**Error Cases**:
- Token not found: 404
- Token expired: 410 Gone
- Token already accepted: 400 "Invitation already accepted"
- Token revoked: 400 "Invitation was revoked"

---

#### POST `/v1/invitations/:token/accept`

**Purpose**: Accept invitation and create user account

**Auth**: Requires Google OAuth (user must login first)

**Request**:
```json
{
  "google_id": "google-sub-id-from-oauth",
  "email": "john@acmecorp.com",  // Must match invitation email
  "name": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "new-user-uuid",
      "email": "john@acmecorp.com",
      "user_type": "customer_admin"
    },
    "customer_access": {
      "customer_id": "customer-uuid",
      "company_name": "Acme Telecom Corp",
      "role": "ADMIN"
    },
    "tokens": {
      "access_token": "jwt-token-here",
      "refresh_token": "refresh-token-here"
    }
  }
}
```

**Backend Logic**:
```go
func (h *InvitationHandler) AcceptInvitation(c *gin.Context) {
    token := c.Param("token")
    var req AcceptInvitationRequest
    c.BindJSON(&req)

    // 1. Get invitation
    invitation, err := h.invitationRepo.GetByToken(ctx, token)
    if err != nil || invitation == nil {
        c.JSON(404, "Invitation not found")
        return
    }

    // 2. Validate invitation
    if invitation.Status != "PENDING" {
        c.JSON(400, "Invitation already processed")
        return
    }
    if time.Now().After(invitation.ExpiresAt) {
        h.invitationRepo.UpdateStatus(ctx, invitation.ID, "EXPIRED")
        c.JSON(410, "Invitation expired")
        return
    }
    if req.Email != invitation.Email {
        c.JSON(400, "Email mismatch")
        return
    }

    // 3. Create user (if doesn't exist)
    user, err := h.userRepo.GetByEmail(ctx, req.Email)
    if user == nil {
        user, err = h.userRepo.Create(ctx, req.GoogleID, req.Email, req.Name, invitation.UserTypeID)
    }

    // 4. Assign customer access
    err = h.userRepo.GrantCustomerAccess(ctx, user.ID, invitation.CustomerID, invitation.Role)

    // 5. Mark invitation accepted
    h.invitationRepo.UpdateStatus(ctx, invitation.ID, "ACCEPTED")
    h.invitationRepo.UpdateAcceptedBy(ctx, invitation.ID, user.ID)

    // 6. Generate JWT tokens
    accessToken, _ := h.jwtService.GenerateAccessToken(user.ID, user.Email, ...)
    refreshToken, _ := h.jwtService.GenerateRefreshToken(user.ID)

    // 7. Send welcome email
    emailService.SendWelcome(user, invitation.Customer)

    c.JSON(200, AcceptInvitationResponse{User: user, Tokens: tokens, ...})
}
```

---

## Email Templates

### Invitation Email

**Subject**: `You've been invited to WARP Platform`

**HTML Body**:
```html
<h2>You've been invited to WARP!</h2>

<p>Hi there,</p>

<p><strong>David Aldworth</strong> (david.aldworth@ringer.tel) has invited you to join
<strong>Acme Telecom Corp</strong> on the WARP platform.</p>

<p><strong>Your Role</strong>: Customer Admin</p>
<p>You'll be able to manage trunks, numbers, and messaging services for your account.</p>

<p style="margin: 30px 0;">
  <a href="https://admin.rns.ringer.tel/invitations/accept/{TOKEN}"
     style="background: #58C5C7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
    Accept Invitation
  </a>
</p>

<p><strong>Invitation Details:</strong></p>
<ul>
  <li>Company: Acme Telecom Corp (BAN: TEST-001)</li>
  <li>Expires: November 3, 2025 at 12:00 PM</li>
  <li>Your Email: john@acmecorp.com</li>
</ul>

<p>Personal message from David:</p>
<blockquote>{custom_message}</blockquote>

<hr>
<p style="color: #666; font-size: 12px;">
This invitation link is valid for 7 days and can only be used once.
If you didn't expect this invitation, you can safely ignore this email.
</p>
```

**Plain Text Version**:
```
You've been invited to WARP Platform

David Aldworth (david.aldworth@ringer.tel) has invited you to join
Acme Telecom Corp on the WARP platform.

Your Role: Customer Admin
You'll be able to manage trunks, numbers, and messaging services for your account.

Accept invitation: https://admin.rns.ringer.tel/invitations/accept/{TOKEN}

Invitation Details:
- Company: Acme Telecom Corp (BAN: TEST-001)
- Expires: November 3, 2025 at 12:00 PM
- Your Email: john@acmecorp.com

Personal message: {custom_message}

---
This invitation link is valid for 7 days and can only be used once.
If you didn't expect this invitation, you can safely ignore this email.
```

---

### Welcome Email (After Acceptance)

**Subject**: `Welcome to WARP Platform!`

**Body**:
```html
<h2>Welcome to WARP, John!</h2>

<p>Your account has been activated. You now have access to
<strong>Acme Telecom Corp</strong> as a Customer Admin.</p>

<p><strong>What you can do</strong>:</p>
<ul>
  <li>✅ Manage SIP trunks and voice routing</li>
  <li>✅ Purchase and configure phone numbers</li>
  <li>✅ Send and receive SMS/MMS messages</li>
  <li>✅ View call detail records (CDRs)</li>
  <li>✅ Monitor usage and billing</li>
</ul>

<p style="margin: 30px 0;">
  <a href="https://console.rns.ringer.tel"
     style="background: #58C5C7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
    Go to Dashboard
  </a>
</p>

<p><strong>Need help?</strong> Visit our <a href="https://docs.ringer.tel">documentation</a>
or contact support at support@ringer.tel.</p>
```

---

## Frontend Implementation

### Admin Portal - Invite User Page

**Location**: `apps/admin-portal/src/polymet/pages/users-invite.tsx` (NEW)

**UI Components**:

```typescript
export function InviteUserPage() {
  const { customerId } = useParams();
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState('customer_admin');
  const [role, setRole] = useState('USER');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    const response = await axios.post(
      `/v1/admin/customers/${customerId}/invitations`,
      { email, user_type: userType, role, message }
    );

    toast.success('Invitation sent successfully!');
    navigate(`/customers/${customerId}/users`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite User</CardTitle>
        <CardDescription>
          Send an invitation to join this customer account
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Email Input */}
          <div>
            <Label>Email Address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          {/* User Type Select */}
          <div>
            <Label>User Type</Label>
            <Select value={userType} onValueChange={setUserType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer_admin">
                  Customer Admin (Full account access)
                </SelectItem>
                <SelectItem value="developer">
                  Developer (Technical/API access)
                </SelectItem>
                <SelectItem value="billing">
                  Billing (Financial access only)
                </SelectItem>
                <SelectItem value="viewer">
                  Viewer (Read-only access)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Role Select */}
          <div>
            <Label>Account Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNER">Owner (Full control)</SelectItem>
                <SelectItem value="ADMIN">Admin (Manage resources)</SelectItem>
                <SelectItem value="USER">User (Standard access)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Message */}
          <div>
            <Label>Personal Message (Optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note to the invitation email..."
            />
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={handleSubmit}>Send Invitation</Button>
      </CardFooter>
    </Card>
  );
}
```

---

### Invitation Acceptance Page

**Location**: `apps/admin-portal/src/polymet/pages/invitation-accept.tsx` (NEW)

**Flow**:

```typescript
export function InvitationAcceptPage() {
  const { token } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load invitation details
    axios.get(`/v1/invitations/${token}`)
      .then(res => setInvitation(res.data.data))
      .catch(err => {
        if (err.response.status === 410) {
          setError('This invitation has expired');
        } else {
          setError('Invalid invitation link');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    // Sign in with Google
    const googleUser = await signInWithGoogle();

    // Verify email matches
    if (googleUser.email !== invitation.email) {
      setError(`Please sign in with ${invitation.email}`);
      return;
    }

    // Accept invitation
    const response = await axios.post(`/v1/invitations/${token}/accept`, {
      google_id: googleUser.uid,
      email: googleUser.email,
      name: googleUser.displayName
    });

    // Store tokens
    localStorage.setItem('access_token', response.data.data.tokens.access_token);
    localStorage.setItem('refresh_token', response.data.data.tokens.refresh_token);

    // Redirect to dashboard
    navigate('/dashboard');
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorPage message={error} />;

  return (
    <div className="invitation-accept">
      <Card>
        <CardHeader>
          <CardTitle>You've Been Invited!</CardTitle>
          <CardDescription>
            Accept this invitation to join {invitation.customer.company_name}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Company</Label>
              <p className="text-lg font-semibold">
                {invitation.customer.company_name} ({invitation.customer.ban})
              </p>
            </div>

            <div>
              <Label>Your Role</Label>
              <p>{invitation.user_type_description}</p>
            </div>

            <div>
              <Label>Invited by</Label>
              <p>{invitation.invited_by.name} ({invitation.invited_by.email})</p>
            </div>

            {invitation.message && (
              <div>
                <Label>Personal Message</Label>
                <p className="italic">{invitation.message}</p>
              </div>
            )}

            <div>
              <Label>Expires</Label>
              <p>{formatDate(invitation.expires_at)}</p>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button onClick={handleAccept} className="w-full">
            <GoogleIcon className="mr-2" />
            Sign in with Google to Accept
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
```

---

## Backend Implementation

### Service Layer

**Create**: `services/api-gateway/internal/invitation/` (NEW)

```
invitation/
├── service.go          # Business logic
├── repository.go       # Database operations
└── email_service.go    # Email sending
```

**`service.go`**:
```go
type InvitationService struct {
    invitationRepo *repository.InvitationRepository
    userRepo       *repository.UserRepository
    emailService   *EmailService
    logger         *zap.Logger
}

func (s *InvitationService) CreateInvitation(
    ctx context.Context,
    email string,
    customerID uuid.UUID,
    userTypeID uuid.UUID,
    role string,
    message string,
    invitedBy uuid.UUID,
) (*Invitation, error) {
    // Validate email format
    // Check not already invited (pending invitation exists)
    // Check user doesn't already exist
    // Generate secure token
    // Insert into database
    // Send email
    // Return invitation
}

func (s *InvitationService) AcceptInvitation(
    ctx context.Context,
    token uuid.UUID,
    googleID string,
    email string,
    name string,
) (*User, *Tokens, error) {
    // Get invitation by token
    // Validate not expired/revoked/accepted
    // Validate email matches
    // Create user account
    // Grant customer access
    // Mark invitation accepted
    // Generate JWT tokens
    // Send welcome email
    // Return user + tokens
}

func (s *InvitationService) RevokeInvitation(
    ctx context.Context,
    invitationID uuid.UUID,
    revokedBy uuid.UUID,
) error {
    // Update status to REVOKED
    // Audit log
}
```

---

### Email Service

**Integration Options**:

**Option A: SendGrid** (Recommended)
- Already have SendGrid SDK in `docs/api_docs/`
- Simple API
- Delivery tracking
- Template support

**Option B: AWS SES**
- Lower cost
- GCP integration
- Requires more setup

**Option C: SMTP** (Development only)
- Mailgun, Postmark, etc.
- Simplest for testing

**Implementation** (`internal/invitation/email_service.go`):

```go
type EmailService struct {
    sendgridClient *sendgrid.Client
    fromEmail      string
    fromName       string
}

func (s *EmailService) SendInvitation(invitation *Invitation) error {
    invitationURL := fmt.Sprintf("https://admin.rns.ringer.tel/invitations/accept/%s", invitation.Token)

    email := &mail.SGMailV3{
        From: mail.NewEmail(s.fromName, s.fromEmail),
        Personalizations: []*mail.Personalization{
            {
                To: []*mail.Email{mail.NewEmail("", invitation.Email)},
                Substitutions: map[string]string{
                    "{inviter_name}":      invitation.InvitedBy.Name,
                    "{company_name}":      invitation.Customer.CompanyName,
                    "{ban}":               invitation.Customer.BAN,
                    "{user_type}":         invitation.UserType.Description,
                    "{custom_message}":    invitation.Message,
                    "{invitation_url}":    invitationURL,
                    "{expires_at}":        invitation.ExpiresAt.Format("January 2, 2006 at 3:04 PM"),
                },
            },
        },
        TemplateID: "d-invitation-template-id", // SendGrid template
    }

    response, err := s.sendgridClient.Send(email)
    if err != nil {
        return fmt.Errorf("failed to send invitation email: %w", err)
    }

    log.Printf("Invitation email sent to %s (status: %d)", invitation.Email, response.StatusCode)
    return nil
}

func (s *EmailService) SendWelcome(user *User, customer *Customer) error {
    // Similar pattern for welcome email
}
```

---

## Security Considerations

### Token Security

**Token Format**: UUID v4 (128-bit random)
```
Example: 550e8400-e29b-41d4-a716-446655440000
Entropy: 2^122 possible values (effectively impossible to guess)
```

**Token Properties**:
- ✅ Single-use (marked ACCEPTED after use)
- ✅ Time-limited (7 days expiry)
- ✅ Stored hashed? (No - UUID is already random, not user-generated password)
- ✅ HTTPS only (no http:// in invitation links)
- ✅ No sensitive data in token (customer info fetched server-side)

**Attack Vectors**:
1. **Token Guessing** → Mitigated by UUID randomness
2. **Email Interception** → Mitigated by HTTPS, expiry, single-use
3. **Replay Attack** → Mitigated by single-use (status=ACCEPTED)
4. **Token Theft** → Mitigated by email validation (must match)

---

### Email Validation

**Flow**:
```
1. Invitation created for: john@acmecorp.com
2. Email sent to: john@acmecorp.com
3. John clicks link and signs in with Google
4. Google returns: jane@othercorp.com (wrong email!)
5. Backend checks: jane@othercorp.com != john@acmecorp.com
6. Response: 400 "Please sign in with john@acmecorp.com"
```

**Prevents**: Someone with stolen invitation link from accepting with their own Google account.

---

### Expiry and Cleanup

**Automatic Expiry** (Database-level):
```sql
-- CronJob runs daily
UPDATE auth.user_invitations
SET status = 'EXPIRED'
WHERE status = 'PENDING'
AND expires_at < NOW();
```

**Or** (Application-level):
```go
// Check on every API call
if invitation.Status == "PENDING" && time.Now().After(invitation.ExpiresAt) {
    invitation.Status = "EXPIRED"
    save(invitation)
    return error("Invitation expired")
}
```

**Cleanup Old Invitations**:
```sql
-- Archive invitations older than 90 days
DELETE FROM auth.user_invitations
WHERE created_at < NOW() - INTERVAL '90 days'
AND status IN ('ACCEPTED', 'EXPIRED', 'REVOKED');
```

---

## Permission Requirements

### Who Can Invite Users?

**Add new permission**:
```sql
-- Permission for inviting users
INSERT INTO auth.permission_metadata (resource_path, category, display_name, description)
VALUES (
    '/api/v1/admin/customers/:customerId/invitations',
    'User Management API',
    'Invite Users to Customer',
    'Send invitations to new users for customer account access'
);

-- Grant to superAdmin (already has * wildcard)
-- Grant to admin users
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, '/api/v1/admin/users/*' FROM auth.user_types WHERE type_name = 'admin';

-- Grant to customer_admin (can invite to their own customer)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, '/api/v1/customers/*/invitations' FROM auth.user_types WHERE type_name = 'customer_admin';
```

**Access Control**:
- SuperAdmin: Can invite to any customer
- Admin: Can invite to their assigned customers only
- Customer Admin: Can invite to their own customer only
- Others: No invitation permission

---

## Implementation Phases

### Phase 1: Backend API (Week 1) - 12-16 hours

**Tasks**:
1. **Database Schema** (2 hours)
   - [ ] Create `auth.user_invitations` table
   - [ ] Add indexes
   - [ ] Create cleanup function

2. **Repository Layer** (3 hours)
   - [ ] `internal/repository/invitation_repository.go`
   - [ ] Create(), GetByToken(), GetByEmail()
   - [ ] UpdateStatus(), List()

3. **Service Layer** (4 hours)
   - [ ] `internal/invitation/service.go`
   - [ ] CreateInvitation()
   - [ ] AcceptInvitation()
   - [ ] RevokeInvitation()

4. **Handler Layer** (3 hours)
   - [ ] `internal/handlers/invitations.go`
   - [ ] POST /admin/customers/:id/invitations
   - [ ] GET /invitations/:token
   - [ ] POST /invitations/:token/accept
   - [ ] GET /admin/invitations (list all)
   - [ ] DELETE /admin/invitations/:id (revoke)

5. **Email Integration** (2 hours - using SendGrid)
   - [ ] Configure SendGrid API key
   - [ ] Create email templates
   - [ ] Implement send logic

**Deliverable**: API endpoints working, can create/accept invitations

---

### Phase 2: Admin Portal UI (Week 2) - 8-10 hours

**Tasks**:
1. **Users Management Page** (4 hours)
   - [ ] List users for a customer
   - [ ] Show user roles and permissions
   - [ ] "Invite User" button

2. **Invite User Form** (3 hours)
   - [ ] Email input with validation
   - [ ] User type select (dropdown)
   - [ ] Role select (dropdown)
   - [ ] Custom message textarea
   - [ ] Submit and success handling

3. **Pending Invitations View** (2 hours)
   - [ ] List pending invitations
   - [ ] Show expiry countdown
   - [ ] Resend invitation button
   - [ ] Revoke invitation button

**Deliverable**: Admins can invite users via UI

---

### Phase 3: Invitation Acceptance Flow (Week 2) - 6-8 hours

**Tasks**:
1. **Invitation Accept Page** (4 hours)
   - [ ] Load invitation by token
   - [ ] Display company and role info
   - [ ] Google sign-in button
   - [ ] Email validation
   - [ ] Accept and redirect

2. **Error Handling** (2 hours)
   - [ ] Expired invitation page
   - [ ] Invalid token page
   - [ ] Already accepted page
   - [ ] Email mismatch page

**Deliverable**: Users can accept invitations end-to-end

---

### Phase 4: Testing & Polish (Week 3) - 4-6 hours

**Tasks**:
1. **Unit Tests** (2 hours)
   - [ ] InvitationService tests
   - [ ] InvitationRepository tests
   - [ ] Email validation tests

2. **Integration Tests** (2 hours)
   - [ ] Create invitation flow
   - [ ] Accept invitation flow
   - [ ] Expiry handling
   - [ ] Revocation flow

3. **E2E Tests** (2 hours)
   - [ ] Admin invites user (full flow)
   - [ ] User accepts invitation
   - [ ] User sees correct customer data

**Deliverable**: Production-ready invitation system

---

## Edge Cases & Error Handling

### Edge Case 1: User Already Exists

**Scenario**: Admin invites john@acme.com, but John already has a WARP account

**Solution**: Reject invitation creation, suggest "Grant Access" instead

```go
existingUser, _ := h.userRepo.GetByEmail(ctx, req.Email)
if existingUser != nil {
    return 400, "User already exists. Use 'Grant Customer Access' to add them to this customer."
}
```

**Alternative**: Allow invitation, but skip user creation on acceptance (just grant customer access).

---

### Edge Case 2: Duplicate Pending Invitations

**Scenario**: Admin invites john@acme.com twice while first invitation pending

**Solution**: Database constraint prevents duplicates

```sql
UNIQUE(email, customer_id, status)
```

**Behavior**: Second invitation fails with 409 Conflict

**Alternative**: Auto-revoke first invitation and create new one (with new expiry).

---

### Edge Case 3: Email Mismatch on Acceptance

**Scenario**: Invitation sent to john@acme.com, but user signs in with jane@other.com

**Solution**: Reject and show error

```go
if req.Email != invitation.Email {
    return 400, fmt.Sprintf("Email mismatch. Please sign in with %s", invitation.Email)
}
```

---

### Edge Case 4: Invitation Expires During Acceptance

**Scenario**: User clicks link, reads invitation details for 10 minutes, by the time they click accept it's expired

**Solution**: Check expiry on EVERY operation

```go
// Check on GET /invitations/{token}
// Check on POST /invitations/{token}/accept
if time.Now().After(invitation.ExpiresAt) {
    h.invitationRepo.UpdateStatus(ctx, invitation.ID, "EXPIRED")
    return 410 Gone, "Invitation expired"
}
```

**User Experience**: Clear error message with option to request new invitation.

---

### Edge Case 5: Inviter Revokes After User Clicked Link

**Scenario**: User receives email, clicks link, but admin revoked invitation before they accepted

**Solution**: Show "This invitation has been revoked" page

```go
if invitation.Status == "REVOKED" {
    return 400, "This invitation has been revoked by an administrator"
}
```

---

## Audit Logging

### Events to Log

```
Event: INVITATION_CREATED
  - Who: inviter user_id
  - What: invitation_id, email
  - Where: customer_id
  - When: created_at

Event: INVITATION_SENT
  - Email: recipient email
  - Status: SendGrid response

Event: INVITATION_ACCEPTED
  - Who: new user_id
  - What: invitation_id
  - Where: customer_id assigned
  - When: accepted_at

Event: INVITATION_REVOKED
  - Who: revoker user_id
  - What: invitation_id
  - Why: revocation_reason

Event: INVITATION_EXPIRED
  - What: invitation_id
  - When: expired_at (automatic)
```

**Storage**: Could use separate `audit_log` table or just rely on invitation table columns.

---

## Monitoring & Alerts

### Metrics to Track

```
invitation_created_total{customer_id}
invitation_sent_total{status="success|failure"}
invitation_accepted_total{user_type}
invitation_expired_total
invitation_revoked_total
invitation_email_failures_total

# Gauges
pending_invitations_count
expired_invitations_count
```

### Alerts

```yaml
# Alert if email sending fails repeatedly
- alert: InvitationEmailFailures
  expr: rate(invitation_email_failures_total[5m]) > 0.1
  severity: warning
  message: "Invitation emails failing to send"

# Alert on unusual invitation activity
- alert: HighInvitationVolume
  expr: rate(invitation_created_total[1h]) > 50
  severity: info
  message: "Unusual invitation activity detected"
```

---

## Migration Strategy

### Step 1: Deploy Backend (Non-Breaking)

**Deploy with invitations feature disabled**:
- Database table exists
- API endpoints exist
- But UI doesn't expose them yet

**Test internally first**:
```bash
# Create invitation via API (Postman/curl)
curl -X POST http://api.rns.ringer.tel/v1/admin/customers/{id}/invitations \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"test@example.com","user_type":"viewer","role":"USER"}'

# Manually test acceptance flow
```

---

### Step 2: Deploy UI (Feature Flag)

**Feature flag in Admin Portal**:
```typescript
const ENABLE_USER_INVITATIONS = import.meta.env.VITE_ENABLE_INVITATIONS === 'true';

// Only show "Invite User" button if enabled
{ENABLE_USER_INVITATIONS && (
  <Button onClick={() => navigate('/users/invite')}>
    Invite User
  </Button>
)}
```

**Gradual Rollout**:
- Week 1: Internal testing only (flag=false)
- Week 2: Enable for Ringer admins (flag=true for admin portal)
- Week 3: Enable for customer admins (flag=true for customer portal)

---

### Step 3: Email Configuration

**SendGrid Setup**:
1. Create SendGrid account (or use existing)
2. Verify sender domain (ringer.tel)
3. Create API key with "Mail Send" permission
4. Store in Kubernetes secret:
   ```bash
   kubectl create secret generic sendgrid-credentials -n warp-api \
     --from-literal=SENDGRID_API_KEY='SG.xxxxx'
   ```
5. Create email templates in SendGrid dashboard
6. Update environment variables

---

## Production Readiness Checklist

**Backend**:
- [ ] Database table created
- [ ] API endpoints implemented
- [ ] Email service configured
- [ ] Expiry cleanup CronJob deployed
- [ ] Unit tests passing
- [ ] Integration tests passing

**Frontend**:
- [ ] Invite user form complete
- [ ] Pending invitations list
- [ ] Invitation acceptance page
- [ ] Error pages (expired, invalid, etc.)
- [ ] E2E tests passing

**Security**:
- [ ] Token randomness verified (UUID v4)
- [ ] Email validation implemented
- [ ] Single-use enforcement tested
- [ ] Expiry handling verified
- [ ] HTTPS only (no http:// links)

**Operations**:
- [ ] Email templates reviewed
- [ ] Monitoring dashboards created
- [ ] Alerts configured
- [ ] Runbook created
- [ ] Support trained on invitation flow

**Documentation**:
- [ ] API documentation updated
- [ ] User guide created ("How to invite users")
- [ ] Admin runbook updated
- [ ] CLAUDE.md updated

---

## FAQ

### Q: What if invitation email goes to spam?

**A**: User can request resend:
1. Admin goes to Pending Invitations
2. Clicks "Resend" button
3. New email sent with same token
4. Email includes: "Add noreply@ringer.tel to contacts to avoid spam"

---

### Q: Can a user accept multiple invitations?

**A**: Yes! Each invitation grants access to a different customer.

**Example**:
```
Invitation 1: john@acme.com → Customer A (as Admin)
Invitation 2: john@acme.com → Customer B (as User)

Result after accepting both:
  - user_customer_access has 2 rows
  - John can access both Customer A and B
  - accessible_customer_ids = [A-uuid, B-uuid]
```

---

### Q: What if user's Google email doesn't match invitation email?

**A**: Strict enforcement - must match exactly.

**Workaround**: If user has multiple Google accounts, they must sign in with the one matching the invitation.

**Alternative**: Support email aliases (advanced feature for later).

---

### Q: How do I bulk invite users (CSV upload)?

**A**: Phase 2 feature (not in initial implementation):

```
POST /v1/admin/customers/:id/invitations/bulk
Body: multipart/form-data (CSV file)

CSV Format:
email,user_type,role,message
john@acme.com,customer_admin,ADMIN,Welcome to WARP!
jane@acme.com,developer,USER,API access for integration
```

---

## Related Documentation

- **[AUTH_AND_PERMISSION_SYSTEM.md](AUTH_AND_PERMISSION_SYSTEM.md)** - Authorization architecture
- **[API_DESIGN_FOUNDATION.md](API_DESIGN_FOUNDATION.md)** - API endpoints
- **[SECRETS_MANAGEMENT_GUIDE.md](SECRETS_MANAGEMENT_GUIDE.md)** - SendGrid API key storage

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-27 | Platform Engineering | Initial planning document |

**Next Review**: After Phase 1 implementation
**Status**: ✅ **READY FOR IMPLEMENTATION**

---

**Estimated Total Effort**: 3-4 weeks (part-time) or 1-2 weeks (full-time)

**Recommended Start**: After number procurement system (invitations enable customer onboarding for self-service number management)
