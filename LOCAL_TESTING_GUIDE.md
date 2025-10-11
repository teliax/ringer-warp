# WARP Platform - Local Testing Guide

## 🎯 **What's Ready to Test**

✅ **Complete Google OAuth + Gatekeeper auth system**
✅ **Auto-create users on first Google login**
✅ **Login page with Google button**
✅ **Protected routes**
✅ **Backend API with 14 endpoints**

---

## 📋 **Prerequisites**

1. **Pull latest code:**
   ```bash
   cd /home/daldworth/repos/ringer-warp
   git pull origin main
   ```

2. **Port-forward API Gateway:**
   ```bash
   kubectl port-forward -n warp-api svc/api-gateway 8080:8080 &
   ```

---

## 🚀 **Start Admin Portal**

```bash
cd apps/admin-portal

# Create environment file (if not exists)
cat > .env.local << 'EOF'
VITE_GOOGLE_CLIENT_ID=791559065272-mcpfc2uc9jtdd7ksovpvb3o19gsv7o7o.apps.googleusercontent.com
VITE_API_URL=http://localhost:8080
EOF

# Dependencies already installed via npm install (pushed to repo)

# Start development server
npm run dev
```

**Opens at:** `http://localhost:5173`

---

## 🔐 **Testing the Login Flow**

### **Step 1: Navigate to App**
- Open `http://localhost:5173`
- Should redirect to `/login` (not authenticated)

### **Step 2: Click "Sign in with Google"**
- Google OAuth popup appears
- Select `david.aldworth@ringer.tel`
- Google redirects back with ID token

### **Step 3: Backend Exchange**
What happens automatically:
1. Frontend sends Google ID token to: `POST http://localhost:8080/auth/exchange`
2. Backend verifies token with Google
3. Backend looks up user by google_id (your Google account's `sub` ID)
4. **If user not found**: Auto-creates as 'viewer' role
5. **If you're david.aldworth@ringer.tel**: Finds existing superAdmin user
6. Backend generates WARP JWT tokens (access + refresh)
7. Frontend stores tokens in localStorage
8. Frontend fetches your permissions
9. Redirects to `/dashboard`

### **Step 4: Verify Login**
- Dashboard should load
- Your email should show in UI (if we add user menu)
- API calls should work with your JWT token

---

## 🧪 **Manual Testing Steps**

### **Test 1: Direct API Call (Verify Backend)**

```bash
# 1. Login via frontend and copy your access token from browser devtools:
# Open DevTools → Application → Local Storage → access_token

# 2. Test API with your token
curl http://localhost:8080/v1/gatekeeper/my-permissions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Should return:
# {
#   "success": true,
#   "data": {
#     "user_id": "...",
#     "email": "david.aldworth@ringer.tel",
#     "user_type": "superAdmin",
#     "has_wildcard_permission": true,
#     "permissions": ["*"],
#     "customer_access": []
#   }
# }
```

### **Test 2: Create Customer via UI**

Once logged in:
1. Navigate to Customers page
2. Click "New Customer"
3. Fill in form
4. Submit
5. Should call: `POST /v1/customers` with your JWT token
6. Gatekeeper should allow (you're superAdmin)
7. Customer created successfully

### **Test 3: Permission Checking**

```bash
# Check if you can access a resource
curl -X POST http://localhost:8080/v1/gatekeeper/check-access \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resourcePath": "/dashboard/customers"}'

# Should return: {"success": true, "data": {"allowed": true, "userType": "superAdmin", ...}}
```

---

## 🐛 **Troubleshooting**

### **Issue: "User not found" on Login**

**If you see this error**, it means:
- Google login worked ✅
- Token exchange called ✅
- But user doesn't exist yet ✅

**Solution:** User should auto-create now! Check backend logs:
```bash
kubectl logs -n warp-api -l app=api-gateway --tail=50 | grep "Auto-creating"
```

### **Issue: Google OAuth Popup Blocked**

**Solution:**
- Allow popups for localhost:5173
- Or use redirect flow instead of popup

### **Issue: CORS Error**

**Solution:**
- Verify API Gateway is running: `curl http://localhost:8080/health`
- Check CORS middleware is active
- Verify `.env.local` has correct API_URL

### **Issue: Token Expired**

**Solution:**
- Click "Sign in with Google" again
- Frontend will auto-refresh using refresh token

---

## 👥 **Upgrading Your User to SuperAdmin**

If auto-created as 'viewer', upgrade to superAdmin:

```sql
-- Connect to database
PGPASSWORD='G7$k9mQ2@tR1' psql -h 34.42.208.57 -p 5432 -U warp_app -d warp

-- Upgrade user
UPDATE auth.users
SET user_type_id = (SELECT id FROM auth.user_types WHERE type_name = 'superAdmin')
WHERE email = 'david.aldworth@ringer.tel';

-- Verify
SELECT email, (SELECT type_name FROM auth.user_types WHERE id = user_type_id) as user_type
FROM auth.users
WHERE email = 'david.aldworth@ringer.tel';
```

**Then logout and login again** to get new token with superAdmin permissions.

---

## 📊 **What You Should See**

1. **Login Page** (`/login`)
   - "WARP Platform" title
   - Google Sign in button
   - Clean, simple UI

2. **After Login** (`/dashboard`)
   - Dashboard loads
   - No permission errors
   - API calls work

3. **Browser DevTools** → Application → Local Storage:
   - `access_token` - Your WARP JWT
   - `refresh_token` - For token refresh

4. **Network Tab:**
   - `POST /auth/exchange` - Exchange Google token
   - `GET /v1/gatekeeper/my-permissions` - Get permissions
   - `GET /v1/customers` - API calls with JWT

---

## ✅ **Success Criteria**

- [ ] Login page shows Google button
- [ ] Clicking Google button opens OAuth flow
- [ ] After Google login, redirects to dashboard
- [ ] Dashboard loads without errors
- [ ] API calls include JWT token
- [ ] Can create/view customers
- [ ] Logout works (clears tokens)

---

## 🔑 **OAuth Configuration** (Already Done)

**Client ID:** `791559065272-mcpfc2uc9jtdd7ksovpvb3o19gsv7o7o`
**Authorized Origins:**
- `http://localhost:3000`
- `http://localhost:5173` (Vite default port)
- `https://admin.ringer.tel`

**Test User:** `david.aldworth@ringer.tel` (will be superAdmin after database fix)

---

## 📝 **Next Steps After Login Works**

1. **Build API client** for customers, vendors, etc.
2. **Replace mock data** in UI with real API calls
3. **Add user menu** (show email, logout button)
4. **Deploy to Vercel** with admin.ringer.tel domain
5. **Add more users** and test permission scoping

---

**Ready to test! Pull the code and run `npm run dev`.**
