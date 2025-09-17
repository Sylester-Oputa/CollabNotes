import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../layout/Layout';
import DashboardRouter from './DashboardRouter';

const ConditionalDashboardLayout = () => {
  const { user } = useAuth();

  // Platform Owner Dashboard has its own layout, others use the general layout
  if (user?.role === 'SUPER_ADMIN') {
    return <DashboardRouter />;
  }

  return (
    <Layout>
      <DashboardRouter />
    </Layout>
  );
};

export default ConditionalDashboardLayout;