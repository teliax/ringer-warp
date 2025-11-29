# Google OAuth Integration - TODO

**Priority**: HIGH
**Estimated Time**: 1 hour
**Blocks**: Invitation acceptance flow
**File**: `src/lib/auth/AuthContext.tsx:133`

---

## Current State

**Stub Implementation**:
```typescript
const signInWithGoogle = async () => {
  throw new Error('Google OAuth not yet configured - please implement signInWithPopup');
};
```

**Status**: Placeholder that shows the error clearly when invitation acceptance is attempted.

---

## Implementation Steps

### Step 1: Install Firebase SDK (if not already installed)

```bash
cd apps/admin-portal
npm install firebase
# or
yarn add firebase
```

### Step 2: Initialize Firebase

**Create**: `src/lib/firebase.ts`

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // Add other config as needed
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

**Add to `.env`**:
```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### Step 3: Implement signInWithGoogle

**Update**: `src/lib/auth/AuthContext.tsx:133`

**Replace**:
```typescript
const signInWithGoogle = async (): Promise<{ uid: string; email: string; displayName: string | null }> => {
  throw new Error('Google OAuth not yet configured - please implement signInWithPopup');
};
```

**With**:
```typescript
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const signInWithGoogle = async (): Promise<{ uid: string; email: string; displayName: string | null }> => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);

    return {
      uid: result.user.uid,
      email: result.user.email!,
      displayName: result.user.displayName,
    };
  } catch (error: any) {
    console.error('Google sign-in failed:', error);

    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    throw error;
  }
};
```

### Step 4: Add Import to AuthContext

**Add at top of file**:
```typescript
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
```

### Step 5: Update Login.tsx (if using OAuth there too)

**File**: `src/pages/Login.tsx`

**Current**: Uses window.location redirect pattern
**Option**: Keep as-is OR switch to signInWithPopup for consistency

---

## Testing

### Test Locally

```bash
# 1. Start dev server
npm run dev

# 2. Navigate to invitation link (after creating one)
http://localhost:3000/invitations/accept/{token}

# 3. Click "Sign in with Google"
# → Should show Google OAuth popup
# → Select account
# → Returns to acceptance page

# 4. Verify email match checked
# 5. Verify account created on acceptance
# 6. Verify redirected to dashboard
```

### Test Errors

```
Test 1: Email Mismatch
  - Invitation for: user-a@example.com
  - Sign in with: user-b@example.com
  - Expected: Error "Please sign in with user-a@example.com"

Test 2: Popup Blocked
  - Browser blocks popup
  - Expected: Error with instruction to allow popups

Test 3: User Cancels
  - Close popup without selecting account
  - Expected: "Sign-in cancelled" error
```

---

## Alternative: Use Google One Tap

**Instead of popup**, could use Google One Tap (smoother UX):

```typescript
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

// Use Google One Tap library
// Better UX, no popup blockers
// See: https://developers.google.com/identity/gsi/web/guides/overview
```

**Benefits**:
- No popup blockers
- Faster sign-in
- Better mobile experience

**Downside**:
- Requires additional Google Identity Services library

---

## Production Checklist

- [ ] Firebase project created
- [ ] OAuth consent screen configured
- [ ] Authorized domains added (admin.rns.ringer.tel)
- [ ] Firebase config added to .env
- [ ] signInWithPopup implemented
- [ ] Popup blockers tested
- [ ] Email validation tested
- [ ] Error handling tested
- [ ] Works on mobile

---

## Estimated Completion

**Time**: 1 hour
**Complexity**: Low (standard Firebase integration)
**Blocker**: None (Firebase free tier is fine)

**After this**: User invitation system will be 100% functional end-to-end!
