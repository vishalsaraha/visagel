import React, { createContext, useContext, useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

export interface OrganizationInfo {
  name: string;
  orgId: string;
  contactEmail: string;
  location?: string;
  licenseKey?: string;
  isRegistered: boolean;
}

export interface AdminAccount {
  id: string;
  name: string;
  loginId: string; // e.g. "hr_admin", "admin", "hr_manager"
  password: string;
  role: 'SUPER_ADMIN' | 'HR_MANAGER' | 'HR_STAFF';
  createdAt: string;
}

interface AuthContextType {
  adminPassword: string; // compatibility default
  isAuthenticated: boolean;
  currentUser: AdminAccount | null;
  adminAccounts: AdminAccount[];
  organization: OrganizationInfo;
  updateOrganization: (updates: Partial<OrganizationInfo>) => Promise<void>;
  verifyPassword: (password: string, loginId?: string) => { success: boolean; user?: AdminAccount };
  updatePassword: (newPassword: string) => Promise<boolean>;
  addAdminAccount: (account: Omit<AdminAccount, 'id' | 'createdAt'>) => Promise<boolean>;
  removeAdminAccount: (id: string) => Promise<boolean>;
  updateAdminAccount: (id: string, updates: Partial<AdminAccount>) => Promise<boolean>;
  logout: () => void;
  logoutOrganization: () => Promise<void>;
}

const PASSWORD_FILE = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}visagel_admin_auth.json`;
const ORG_FILE = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}visagel_org_profile.json`;

const DEFAULT_ORG: OrganizationInfo = {
  name: 'Branzept',
  orgId: 'BRNZ-CORP-2026',
  contactEmail: 'admin@branzept.com',
  location: 'Corporate HQ',
  licenseKey: 'BRNZ-ENT-9948-PRO',
  isRegistered: true,
};

const DEFAULT_ADMIN: AdminAccount = {
  id: 'admin-root',
  name: 'Default Admin',
  loginId: 'admin',
  password: 'admin',
  role: 'SUPER_ADMIN',
  createdAt: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType>({
  adminPassword: 'admin',
  isAuthenticated: false,
  currentUser: null,
  adminAccounts: [DEFAULT_ADMIN],
  organization: DEFAULT_ORG,
  updateOrganization: async () => {},
  verifyPassword: () => ({ success: false }),
  updatePassword: async () => false,
  addAdminAccount: async () => false,
  removeAdminAccount: async () => false,
  updateAdminAccount: async () => false,
  logout: () => {},
  logoutOrganization: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([DEFAULT_ADMIN]);
  const [currentUser, setCurrentUser] = useState<AdminAccount | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [organization, setOrganization] = useState<OrganizationInfo>(DEFAULT_ORG);

  useEffect(() => {
    (async () => {
      try {
        if (PASSWORD_FILE) {
          const info = await FileSystem.getInfoAsync(PASSWORD_FILE);
          if (info.exists) {
            const content = await FileSystem.readAsStringAsync(PASSWORD_FILE);
            const data = JSON.parse(content);
            if (Array.isArray(data?.accounts) && data.accounts.length > 0) {
              setAdminAccounts(data.accounts);
            } else if (data?.adminPassword) {
              const singleAcc: AdminAccount = {
                id: 'admin-root',
                name: 'Main Admin',
                loginId: 'admin',
                password: data.adminPassword,
                role: 'SUPER_ADMIN',
                createdAt: new Date().toISOString(),
              };
              setAdminAccounts([singleAcc]);
            }
          }
        }
        if (ORG_FILE) {
          const orgInfo = await FileSystem.getInfoAsync(ORG_FILE);
          if (orgInfo.exists) {
            const orgContent = await FileSystem.readAsStringAsync(ORG_FILE);
            const orgData = JSON.parse(orgContent);
            if (orgData?.name) {
              setOrganization((prev) => ({ ...prev, ...orgData }));
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load stored auth/org data', e);
      }
    })();
  }, []);

  const updateOrganization = async (updates: Partial<OrganizationInfo>) => {
    const updated = { ...organization, ...updates };
    setOrganization(updated);
    try {
      if (ORG_FILE) {
        await FileSystem.writeAsStringAsync(
          ORG_FILE,
          JSON.stringify(updated),
          { encoding: 'utf8' }
        );
      }
    } catch (e) {
      console.warn('Failed to persist organization info', e);
    }
  };

  const logoutOrganization = async () => {
    // Reset to default de-registered organization and clear session
    const deRegistered: OrganizationInfo = {
      name: 'Unregistered Company',
      orgId: '',
      contactEmail: '',
      location: '',
      licenseKey: '',
      isRegistered: false,
    };
    setOrganization(deRegistered);
    setIsAuthenticated(false);
    setCurrentUser(null);
    try {
      if (ORG_FILE) {
        await FileSystem.writeAsStringAsync(
          ORG_FILE,
          JSON.stringify(deRegistered),
          { encoding: 'utf8' }
        );
      }
    } catch (e) {
      console.warn('Failed to deregister organization', e);
    }
  };

  const persistAccounts = async (accounts: AdminAccount[]) => {
    setAdminAccounts(accounts);
    try {
      if (PASSWORD_FILE) {
        await FileSystem.writeAsStringAsync(
          PASSWORD_FILE,
          JSON.stringify({ accounts }),
          { encoding: 'utf8' }
        );
      }
    } catch (e) {
      console.warn('Failed to persist admin accounts', e);
    }
  };

  const verifyPassword = (password: string, loginId?: string): { success: boolean; user?: AdminAccount } => {
    const trimmedPass = password.trim();
    const trimmedId = loginId?.trim().toLowerCase();

    // Check if matching specific ID + Password, or any account where password matches
    let matched: AdminAccount | undefined;
    if (trimmedId) {
      matched = adminAccounts.find(
        (a) => a.loginId.toLowerCase() === trimmedId && a.password === trimmedPass
      );
    } else {
      matched = adminAccounts.find((a) => a.password === trimmedPass);
    }

    if (matched) {
      setIsAuthenticated(true);
      setCurrentUser(matched);
      return { success: true, user: matched };
    }
    return { success: false };
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    if (!newPassword || newPassword.trim().length === 0) return false;
    const trimmed = newPassword.trim();
    const updated = adminAccounts.map((acc) =>
      currentUser && acc.id === currentUser.id ? { ...acc, password: trimmed } : (acc.loginId === 'admin' ? { ...acc, password: trimmed } : acc)
    );
    await persistAccounts(updated);
    if (currentUser) {
      setCurrentUser({ ...currentUser, password: trimmed });
    }
    return true;
  };

  const addAdminAccount = async (account: Omit<AdminAccount, 'id' | 'createdAt'>): Promise<boolean> => {
    const exists = adminAccounts.some(
      (a) => a.loginId.toLowerCase() === account.loginId.trim().toLowerCase()
    );
    if (exists) return false;

    const newAcc: AdminAccount = {
      ...account,
      id: `admin-${Date.now()}`,
      loginId: account.loginId.trim(),
      password: account.password.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...adminAccounts, newAcc];
    await persistAccounts(updated);
    return true;
  };

  const removeAdminAccount = async (id: string): Promise<boolean> => {
    if (adminAccounts.length <= 1) return false; // Prevent removing last admin
    const updated = adminAccounts.filter((a) => a.id !== id);
    await persistAccounts(updated);
    return true;
  };

  const updateAdminAccount = async (id: string, updates: Partial<AdminAccount>): Promise<boolean> => {
    const updated = adminAccounts.map((a) => (a.id === id ? { ...a, ...updates } : a));
    await persistAccounts(updated);
    return true;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const activeAdminPassword = currentUser?.password || adminAccounts[0]?.password || 'admin';

  return (
    <AuthContext.Provider
      value={{
        adminPassword: activeAdminPassword,
        isAuthenticated,
        currentUser,
        adminAccounts,
        organization,
        updateOrganization,
        verifyPassword,
        updatePassword,
        addAdminAccount,
        removeAdminAccount,
        updateAdminAccount,
        logout,
        logoutOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

