import React from 'react';
import { useAuth } from '../../context/AuthContext';
import PlatformOwnerDashboard from './PlatformOwnerDashboard';
import CompanyAdminDashboard from './CompanyAdminDashboard';
import DepartmentDashboard from './DepartmentDashboard';

const DashboardRouter = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Please log in to access your dashboard.</p>
        </div>
      </div>
    );
  }

  // Route to appropriate dashboard based on user role
  // Note: PlatformOwnerDashboard now includes its own layout
  switch (user.role) {
    case 'SUPER_ADMIN':
      return <PlatformOwnerDashboard />;
    
    case 'HEAD_OF_DEPARTMENT':
      return <CompanyAdminDashboard />;
    
    case 'USER':
    default:
      return <DepartmentDashboard />;
  }
};

export default DashboardRouter;