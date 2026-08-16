import React, { createContext, useContext, useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

interface AuthContextType {
  adminPassword: string;
  isAuthenticated: boolean;
  verifyPassword: (password: string) => boolean;
  updatePassword: (newPassword: string) => Promise<boolean>;
  logout: () => void;
}

const PASSWORD_FILE = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}visagel_admin_auth.json`;
const DEFAULT_PASSWORD = 'admin';

const AuthContext = createContext<AuthContextType>({
  adminPassword: DEFAULT_PASSWORD,
  isAuthenticated: false,
  verifyPassword: () => false,
  updatePassword: async () => false,
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminPassword, setAdminPassword] = useState<string>(DEFAULT_PASSWORD);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        if (PASSWORD_FILE) {
          const info = await FileSystem.getInfoAsync(PASSWORD_FILE);
          if (info.exists) {
            const content = await FileSystem.readAsStringAsync(PASSWORD_FILE);
            const data = JSON.parse(content);
            if (data?.adminPassword) {
              setAdminPassword(data.adminPassword);
            } else if (data?.adminPin) {
              // Backward compatibility migration
              setAdminPassword(data.adminPin);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load stored admin password', e);
      }
    })();
  }, []);

  const verifyPassword = (password: string): boolean => {
    if (password === adminPassword) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    if (!newPassword || newPassword.trim().length === 0) return false;
    const trimmed = newPassword.trim();
    setAdminPassword(trimmed);
    try {
      if (PASSWORD_FILE) {
        await FileSystem.writeAsStringAsync(
          PASSWORD_FILE,
          JSON.stringify({ adminPassword: trimmed }),
          { encoding: 'utf8' }
        );
      }
      return true;
    } catch (e) {
      console.warn('Failed to persist admin password', e);
      return true;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        adminPassword,
        isAuthenticated,
        verifyPassword,
        updatePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
