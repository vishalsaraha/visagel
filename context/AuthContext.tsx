import React, { createContext, useContext, useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

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
  verifyPassword: (password: string, loginId?: string) => { success: boolean; user?: AdminAccount };
  updatePassword: (newPassword: string) => Promise<boolean>;
  addAdminAccount: (account: Omit<AdminAccount, 'id' | 'createdAt'>) => Promise<boolean>;
  removeAdminAccount: (id: string) => Promise<boolean>;
  updateAdminAccount: (id: string, updates: Partial<AdminAccount>) => Promise<boolean>;
  logout: () => void;
}

const PASSWORD_FILE = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}visagel_admin_auth.json`;
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
  verifyPassword: () => ({ success: false }),
  updatePassword: async () => false,
  addAdminAccount: async () => false,
  removeAdminAccount: async () => false,
  updateAdminAccount: async () => false,
  logout: () => {},
});

import { getAdminAccountsDb, saveAdminAccountsDb } from '@/utils/database';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminAccount | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    try {
      setAdminAccounts(getAdminAccountsDb());
    } catch (e) {
      console.warn('Failed to load stored admin accounts from SQLite', e);
    }
  }, []);

  const persistAccounts = async (accounts: AdminAccount[]) => {
    setAdminAccounts(accounts);
    saveAdminAccountsDb(accounts);
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
        verifyPassword,
        updatePassword,
        addAdminAccount,
        removeAdminAccount,
        updateAdminAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

