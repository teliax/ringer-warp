import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';

interface CustomerAccess {
  customer_id: string;
  company_name: string;
  ban: string;
  role: 'USER' | 'ADMIN' | 'OWNER';
}

interface AuthContextType {
  accessToken: string | null;
  refreshToken: string | null;
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (googleData: { googleId: string; email: string; name: string; picture?: string }) => Promise<void>;
  logout: () => void;
  // New permissions and customer access
  permissions: string[];
  customerAccess: CustomerAccess[];
  activeBan: CustomerAccess | null;
  setActiveBan: (ban: CustomerAccess | null) => void;
  hasPermission: (path: string) => boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('access_token')
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    localStorage.getItem('refresh_token')
  );
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New state for permissions and customer access
  const [permissions, setPermissions] = useState<string[]>([]);
  const [customerAccess, setCustomerAccess] = useState<CustomerAccess[]>([]);
  const [activeBan, setActiveBanState] = useState<CustomerAccess | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Fetch permissions and customer access
  const fetchPermissionsAndCustomerAccess = async () => {
    try {
      const response = await axios.get('/v1/gatekeeper/my-permissions');
      const data = response.data.data;

      setPermissions(data.permissions || []);
      setCustomerAccess(data.customerAccess || []);

      // Check if user has wildcard permission (SuperAdmin)
      const hasWildcard = data.permissions?.includes('*') || false;
      setIsSuperAdmin(hasWildcard);

      // Restore active BAN from localStorage or set first customer
      const storedBanId = localStorage.getItem('active_ban_id');
      if (storedBanId && data.customerAccess) {
        const ban = data.customerAccess.find((c: CustomerAccess) => c.customer_id === storedBanId);
        setActiveBanState(ban || data.customerAccess[0] || null);
      } else if (data.customerAccess && data.customerAccess.length > 0) {
        setActiveBanState(data.customerAccess[0]);
      }

      console.log('✅ Permissions and customer access loaded');
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      // Don't fail login if this errors - graceful degradation
    }
  };

  // Check if user has permission for a specific path
  const hasPermission = (requestedPath: string): boolean => {
    if (isSuperAdmin) return true; // Wildcard permission

    return permissions.some((permission) => {
      // Exact match
      if (permission === requestedPath) return true;

      // Wildcard match (/api/v1/customers/* matches /api/v1/customers/123)
      if (permission.endsWith('/*')) {
        const basePath = permission.slice(0, -2);
        return requestedPath.startsWith(basePath + '/');
      }

      return false;
    });
  };

  // Set active BAN with localStorage persistence and event emission
  const setActiveBan = (ban: CustomerAccess | null) => {
    setActiveBanState(ban);

    if (ban) {
      localStorage.setItem('active_ban_id', ban.customer_id);
      // Optional: Set axios default header for customer context
      axios.defaults.headers.common['X-Customer-ID'] = ban.customer_id;
    } else {
      localStorage.removeItem('active_ban_id');
      delete axios.defaults.headers.common['X-Customer-ID'];
    }

    // Emit event for smart reload
    window.dispatchEvent(new CustomEvent('banChanged', { detail: ban }));
  };

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/validate`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.data);
          // Fetch permissions after token validation
          await fetchPermissionsAndCustomerAccess();
        } else {
          // Token invalid, try refresh
          if (refreshToken) {
            await refreshAccessToken();
          } else {
            logout();
          }
        }
      } catch (error) {
        console.error('Token validation failed:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = async (googleData: { googleId: string; email: string; name: string; picture?: string }) => {
    try {
      const response = await fetch(`${API_URL}/auth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_id: googleData.googleId,
          email: googleData.email,
          name: googleData.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Login failed');
      }

      const data = await response.json();
      const tokens = data.data;

      setAccessToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);

      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);

      console.log('✅ Login successful - tokens stored');

      // Set user from token response (merge with Google data for picture)
      setUser({
        user_id: tokens.user_id,
        email: tokens.email,
        user_type: tokens.user_type,
        name: googleData.name,
        picture: googleData.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(googleData.name)}&background=58C5C7&color=fff`,
      });

      // Fetch permissions and customer access after successful login
      await fetchPermissionsAndCustomerAccess();

    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) return;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        const tokens = data.data;

        setAccessToken(tokens.access_token);
        localStorage.setItem('access_token', tokens.access_token);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  };

  const logout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setPermissions([]);
    setCustomerAccess([]);
    setActiveBanState(null);
    setIsSuperAdmin(false);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('active_ban_id');
    delete axios.defaults.headers.common['X-Customer-ID'];
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        refreshToken,
        user,
        isAuthenticated: !!accessToken,
        isLoading,
        login,
        logout,
        // New permissions and customer access
        permissions,
        customerAccess,
        activeBan,
        setActiveBan,
        hasPermission,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
