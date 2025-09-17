import React, { createContext, useContext, useState, useEffect } from 'react';
import { platformAuth } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const initializeAuth = () => {
      try {
        const storedUser = platformAuth.getCurrentUser();
        const token = platformAuth.getToken();
        
        if (storedUser && token) {
          // Verify the user is still a platform admin
          if (storedUser.role === 'SUPER_ADMIN') {
            setUser(storedUser);
          } else {
            // Clear invalid auth data
            platformAuth.logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        platformAuth.logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const data = await platformAuth.login(email, password);
      
      // Store auth data
      platformAuth.setAuthData(data.token, data.user);
      setUser(data.user);
      
      return data;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    platformAuth.logout();
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isPlatformAdmin: user?.role === 'SUPER_ADMIN'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};