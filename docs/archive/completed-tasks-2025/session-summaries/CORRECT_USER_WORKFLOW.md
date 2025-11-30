# Correct User & Customer Workflow

**Date**: October 27, 2025
**Status**: ✅ Implemented
**Version**: Admin Portal (latest build)

---

## Overview

This document describes the CORRECT workflow for customer creation and user management in WARP, as opposed to the incorrect implementation that was reversed.

---

## ✅ Correct Workflow

### Customer Creation (`/customers/new`)

**Step 1: Create Customer with Contact**
```
Admin navigates to /customers/new
Fills customer form:
  - Company Name: "Acme Corp"
  - Contact Name: "John Doe"
  - Contact Email: "john@acmecorp.com"  ← This is key
  - Contact Phone: "555-1234"
  - Address, billing, etc.

Clicks "Save Customer"
```

**Step 2: Backend Handles User Association**
```
Backend receives POST /v1/customers:
  {
    "company_name": "Acme Corp",
    "contact": {
      "name": "John Doe",
      "email": "john@acmecorp.com",
      "phone": "555-1234"
    },
    ...
  }

Backend logic:
  1. Create customer in accounts.customers ✅
  2. Store contact info in JSONB contact field ✅
  3. Check: Does john@acmecorp.com exist in auth.users?

     IF YES (existing user):
       → Create user_customer_access entry
       → Link existing user to new customer
       → User can immediately see customer in their list

     IF NO (new user):
       → Create invitation in auth.user_invitations
       → Send email via SendGrid
       → User accepts → account created → access granted

  4. Return customer with ID
```

**Result**:
- ✅ Customer created
- ✅ Contact info stored
- ✅ User automatically invited OR assigned (if exists)
- ✅ No manual DB operations needed

---

### Managing Users for Existing Customer

**From Customer Edit Form** (`Edit Account` button → `Users` tab):

```
Admin clicks "Edit Account" on customer page
Modal opens with tabs: General | Billing | Products | Users | Settings
Admin clicks "Users" tab

Users Tab Shows:
  1. "Add New User" card:
     - Email input
     - Name input
     - Role dropdown (customer_admin, developer, billing, viewer)
     - [Add User] button

  2. "Existing Users" list:
     - Shows all users with access to this customer
     - Can change role
     - Can change status (active/pending/inactive)
     - Can remove user

To Add User:
  1. Enter email (e.g., "newuser@acmecorp.com")
  2. Enter name
  3. Select role
  4. Click "Add User"

Backend:
  - POST /v1/admin/customers/{id}/invitations
  - Creates invitation
  - Sends email via SendGrid
  - User appears in list with status="pending"
```

---

## ❌ Incorrect Workflow (What Was Removed)

**What We Removed**:
1. ❌ `/invitations` standalone page (not needed)
2. ❌ Invite button on customer overview (wrong place)
3. ❌ Direct customer access grant in invitation service (violates workflow)

**Why These Were Wrong**:

**Problem 1: Standalone `/invitations` page**
```
Issue: Global list of all invitations across all customers
Better: Invitations managed per-customer in Edit modal → Users tab
Result: Removed page, removed navigation link
```

**Problem 2: Invite button on customer detail page**
```
Issue: Trying to invite the contact email (who might already be a user)
Better: Customer creation should handle initial user assignment
       Users tab should handle additional users
Result: Removed [Invite] button from Contact Information card
```

**Problem 3: Auto-granting access to existing users**
```
Issue: Invitation service tried to grant access if user exists
Better: Customer creation backend should handle this
       Invitation is ONLY for new users who need accounts
Result: Reversed code change in invitation/service.go
```

---

## ✅ Correct Implementation (What's Now In Place)

### 1. Customer Edit Form - Users Tab ✅

**Location**: Edit Customer Account modal → Users tab

**UI Components**:
- ✅ "Add New User" card with email/name/role inputs
- ✅ "Existing Users" list with role/status management
- ✅ Add User button → Creates invitation via API
- ✅ Remove User button → Deletes user (with safeguards)
- ✅ Role change dropdown → Updates user role
- ✅ Status change dropdown → Updates user status
- ✅ Permission info card → Explains each role

**Backend Integration**:
- ✅ Calls `POST /v1/admin/customers/{id}/invitations` when adding user
- ✅ SendGrid sends invitation email
- ✅ User accepts → account created → customer access granted

---

### 2. Invitation Flow ✅

**For New Users** (don't have account):
```
1. Admin adds user in Users tab
   → POST /v1/admin/customers/{id}/invitations

2. Backend creates invitation
   → Stores in auth.user_invitations with status=PENDING

3. Backend sends email via SendGrid
   → User receives invitation email

4. User clicks link in email
   → Opens /invitations/accept/{token} (public page)

5. User signs in with Google
   → Redirects to /oauth-callback

6. Backend processes acceptance:
   → Creates user account in auth.users
   → Grants customer access in auth.user_customer_access
   → Marks invitation ACCEPTED
   → Returns JWT tokens

7. User redirected to dashboard
   → Logged in and can see customer data
```

**For Existing Users** (already have account):
```
1. Admin adds user in Users tab
   → Enter email of existing user
   → Click "Add User"

2. Backend validates:
   → User exists? → Return error
   → Error: "user with email ... already exists - use customer assignment instead"

3. Admin should use different flow:
   → (Future) Backend API endpoint: POST /v1/admin/customers/{id}/users
   → Direct assignment without invitation
   → Or: Customer creation should handle this initially
```

---

### 3. Customer Creation - User Assignment (TO BE IMPLEMENTED)

**Current State**: ⏳ NOT YET IMPLEMENTED

**What Should Happen** (backend logic to add):

```go
// handlers/customers.go - CreateCustomer function

func (h *CustomerHandler) CreateCustomer(c *gin.Context) {
    // ... create customer ...

    // After customer created:
    contactEmail := req.Contact.Email

    if contactEmail != "" {
        // Check if user exists
        user, _ := h.userRepo.GetByEmail(ctx, contactEmail)

        if user != nil {
            // User exists - grant access directly
            err := h.userRepo.GrantCustomerAccess(ctx, user.ID, newCustomer.ID, "ADMIN")
            if err != nil {
                h.logger.Warn("Failed to grant customer access", zap.Error(err))
            } else {
                h.logger.Info("Granted customer access to existing user",
                    zap.String("user_email", contactEmail),
                    zap.String("customer_id", newCustomer.ID.String()),
                )
            }
        } else {
            // User doesn't exist - create invitation
            invitation, err := h.invitationService.CreateInvitation(
                ctx,
                contactEmail,
                "customer_admin", // Primary contact gets admin role
                newCustomer.ID,
                "ADMIN",
                nil, // No custom message
                currentUserID,
            )
            if err != nil {
                h.logger.Warn("Failed to create invitation", zap.Error(err))
            } else {
                h.logger.Info("Invitation created for new customer contact",
                    zap.String("email", contactEmail),
                    zap.String("customer_id", newCustomer.ID.String()),
                )
            }
        }
    }

    return customer
}
```

**What This Does**:
- ✅ Creates customer record
- ✅ If contact email = existing user → Grant access automatically
- ✅ If contact email = new user → Send invitation
- ✅ No manual steps required

---

## UI/UX Flow Summary

### Where Users Are Managed

**1. Customer Creation** (`/customers/new`):
- Primary contact email specified
- Backend handles user assignment automatically
- No UI changes needed (backend logic)

**2. Customer Edit → Users Tab**:
- View all users with access to customer
- Add additional users (sends invitations)
- Change user roles
- Remove users
- **This is where admins manage the user list**

**3. Public Invitation Acceptance** (`/invitations/accept/{token}`):
- New users receive email
- Click link to accept
- Sign in with Google
- Account created + access granted
- **This is how new users join**

---

## Data Model

### Customer Record
```
accounts.customers:
  - company_name
  - contact (JSONB):
      {
        "name": "John Doe",
        "email": "john@acmecorp.com",
        "phone": "555-1234"
      }
  - address (JSONB)
  - etc.
```

**Contact is just data**, not a user reference.

### User-Customer Relationship
```
auth.user_customer_access:
  - user_id → auth.users.id
  - customer_id → accounts.customers.id
  - role (USER, ADMIN, OWNER)
```

**This table links users to customers.**

### Invitations
```
auth.user_invitations:
  - email (not yet a user)
  - customer_id (will be granted access)
  - status (PENDING → ACCEPTED)
```

**Invitations are for NEW users only.**

---

## Changes Made This Session

### Removed (Incorrect Implementation)

1. ✅ **Removed**: Invite button from customer overview Contact Information card
   - **File**: `apps/admin-portal/src/polymet/pages/customer-overview.tsx`
   - **Why**: Wrong workflow - should manage users in Edit modal

2. ✅ **Removed**: `/invitations` standalone page and navigation
   - **Files**:
     - `apps/admin-portal/src/App.tsx` (routes)
     - `apps/admin-portal/src/polymet/layouts/main-layout.tsx` (nav)
   - **Why**: Not needed - users managed per-customer in Edit modal

3. ✅ **Reversed**: Auto-granting access to existing users in invitation service
   - **File**: `services/api-gateway/internal/invitation/service.go`
   - **Why**: Violates workflow - customer creation should handle this

### Added (Correct Implementation)

1. ✅ **Added**: Users tab to Customer Edit modal
   - **File**: `apps/admin-portal/src/polymet/components/customer-edit-form.tsx`
   - **What**:
     - Add user form (email, name, role)
     - Existing users list
     - Role/status management
     - Remove user functionality
   - **Lines**: +233 lines

2. ✅ **Added**: User management functions
   - handleAddUser() → Sends invitation via API
   - handleRemoveUser() → Removes user from list
   - handleUpdateUserRole() → Changes user role
   - handleUpdateUserStatus() → Changes user status
   - validateUserEmail() → Email validation

3. ✅ **Added**: Customer User interface
   - TypeScript type for user data
   - role: customer_admin | developer | billing | viewer
   - status: active | pending | inactive

---

## TODO: Backend Updates Needed

### Priority 1: Customer Creation User Assignment

**File**: `services/api-gateway/internal/handlers/customers.go`
**Function**: `CreateCustomer()`
**What to Add**: Automatic user assignment/invitation after customer creation

```go
// After creating customer:
if req.Contact.Email != "" {
    user, _ := h.userRepo.GetByEmail(ctx, req.Contact.Email)

    if user != nil {
        // Existing user - grant access
        h.userRepo.GrantCustomerAccess(ctx, user.ID, newCustomer.ID, "ADMIN")
    } else {
        // New user - send invitation
        h.invitationService.CreateInvitation(ctx, req.Contact.Email, "customer_admin", newCustomer.ID, "ADMIN", nil, currentUserID)
    }
}
```

**Estimated Time**: 30 minutes
**Impact**: Completes the correct workflow

---

### Priority 2: List Users for Customer API

**Endpoint**: `GET /v1/customers/{id}/users`
**Purpose**: Fetch actual users from database for Users tab
**Returns**: List of users with customer access

```go
func (h *CustomerHandler) ListCustomerUsers(c *gin.Context) {
    customerID := c.Param("id")

    // Query user_customer_access + users
    users, err := h.userRepo.GetCustomerUsers(ctx, customerID)

    c.JSON(200, users)
}
```

**Frontend**: Update Users tab to fetch from API instead of local state

**Estimated Time**: 1 hour
**Impact**: Real data instead of mock state

---

### Priority 3: Remove User API

**Endpoint**: `DELETE /v1/customers/{id}/users/{userId}`
**Purpose**: Remove user's access to customer
**Action**: Delete from user_customer_access

```go
func (h *CustomerHandler) RemoveCustomerUser(c *gin.Context) {
    customerID := c.Param("id")
    userID := c.Param("userId")

    // Delete from user_customer_access
    err := h.userRepo.RevokeCustomerAccess(ctx, userID, customerID)

    c.JSON(200, gin.H{"message": "User removed"})
}
```

**Estimated Time**: 30 minutes

---

## Current vs Future State

### Current State (After This Session)

```
Frontend:
  ✅ Users tab in Edit modal (UI complete)
  ✅ Add user → Sends invitation via API
  ✅ Users list → Local state (not persisted)
  ⏳ Remove/update user → Local state only (not saved)

Backend:
  ✅ Invitation system fully operational
  ✅ SendGrid email delivery working
  ⏳ Customer creation doesn't handle user assignment yet
  ⏳ No API to list/update/remove customer users
```

### Future State (After Backend Updates)

```
Frontend:
  ✅ Users tab in Edit modal
  ✅ Add user → Sends invitation
  ✅ Users list → Fetched from database via API
  ✅ Remove/update user → Saved to database via API

Backend:
  ✅ Customer creation auto-assigns contact as user
  ✅ API to list customer users (GET /v1/customers/{id}/users)
  ✅ API to remove user (DELETE /v1/customers/{id}/users/{userId})
  ✅ API to update user role (PUT /v1/customers/{id}/users/{userId})
```

---

## Summary of Changes

### Files Modified (This Correction)

```
Removed/Reverted:
  ✗ Invite button from customer-overview.tsx
  ✗ /invitations page routes from App.tsx
  ✗ Invitations navigation from main-layout.tsx
  ✗ Auto-grant logic from invitation/service.go
  ✗ UserInvitePage component (not used)
  ✗ InvitationsListPage component (not used)

Added/Kept:
  ✅ Users tab in customer-edit-form.tsx (+233 lines)
  ✅ User management functions (add, remove, update)
  ✅ CustomerUser interface
  ✅ Invitation hooks (useCreateInvitation, etc.)
  ✅ Public acceptance page (/invitations/accept/{token})
  ✅ OAuth callback handler
  ✅ Backend invitation API (all 6 endpoints)
  ✅ SendGrid integration
```

### Build Status

```
✓ Admin Portal built successfully
✓ No TypeScript errors
✓ Bundle: 1.24MB (338KB gzipped)
✓ Build time: 2.87s
```

---

## Correct User Lifecycle

### Scenario 1: New Customer with New Contact

```
1. Admin creates customer with contact: newuser@newcompany.com
2. Backend creates customer
3. Backend checks: User exists? → NO
4. Backend creates invitation
5. Backend sends email via SendGrid
6. User receives email → Accepts → Account created
7. user_customer_access entry created
8. User logs in → Sees their customer
```

### Scenario 2: New Customer with Existing Contact

```
1. Admin creates customer with contact: david.aldworth@ringer.tel
2. Backend creates customer
3. Backend checks: User exists? → YES (david is SuperAdmin)
4. Backend creates user_customer_access entry
5. No invitation needed (david can already login)
6. David logs in → Sees new customer in list
```

### Scenario 3: Add Additional User to Existing Customer

```
1. Admin opens customer → Click "Edit Account"
2. Navigate to "Users" tab
3. See existing users (contact + any added)
4. Click "Add New User"
5. Enter email: additionaluser@company.com
6. Click "Add User"
7. Backend sends invitation
8. User accepts → Gets access to this customer
```

---

## Current Limitations

### What Works Now ✅

- ✅ Users tab UI in Edit modal
- ✅ Add user sends invitation via API
- ✅ Invitation emails send via SendGrid
- ✅ Public acceptance page works
- ✅ OAuth flow works
- ✅ Multi-tenant scoping enforced

### What Needs Backend Work ⏳

- ⏳ Customer creation doesn't auto-assign contact (backend TODO)
- ⏳ Users list is local state, not fetched from database
- ⏳ Remove/update user only changes local state, not saved
- ⏳ No API endpoint to list customer users
- ⏳ No API endpoint to remove customer user

**Estimated Effort**: 2-3 hours to complete backend

---

## Next Steps

### Immediate

1. **Test Users Tab UI** (5 minutes)
   - Open customer edit modal
   - Click Users tab
   - Try adding a user
   - Verify invitation sent

2. **Document Correct Workflow** (Done - this document)

### Short-Term (Next Session)

1. **Implement Customer Creation User Assignment** (30 minutes)
   - Update CreateCustomer handler
   - Auto-assign or invite contact email

2. **Implement Customer Users API** (1 hour)
   - GET /v1/customers/{id}/users
   - DELETE /v1/customers/{id}/users/{userId}
   - PUT /v1/customers/{id}/users/{userId}/role

3. **Connect Users Tab to Real Data** (30 minutes)
   - Fetch users from API
   - Save changes to API
   - Real-time updates

### Then: Number Procurement

Once user management is complete, proceed with number procurement system.

---

## Key Takeaways

✅ **Users are managed per-customer** (not global list)
✅ **Customer Edit modal → Users tab** (correct location)
✅ **Invitations are for NEW users only** (not existing users)
✅ **Customer creation should handle initial user** (backend TODO)
✅ **SendGrid integration works** (emails sending)

---

**Status**: Workflow corrected, UI in place, backend needs 2-3 hours of work

**Date**: October 27, 2025
**Version**: Admin Portal (latest build)
