import React, { useState, useEffect } from 'react';
import { platformAPI } from '../../utils/api';
import { SUBSCRIPTION_PLANS, formatPrice, getPlanColor } from '../../utils/subscriptionPlans';
import Layout from '../layout/Layout';

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    plan: 'all',
    status: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, [filters, sortBy, sortOrder]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      // Mock data with comprehensive subscription details
      const mockCompanies = [
        {
          id: 1,
          name: 'TechCorp Solutions',
          email: 'admin@techcorp.com',
          userCount: 45,
          userLimit: 50,
          status: 'active',
          subscriptionStatus: 'paid',
          plan: 'professional',
          planDisplayName: 'Professional',
          billing: 'monthly',
          nextBilling: '2024-05-15',
          mrr: 149,
          createdAt: '2024-01-15',
          trialEndsAt: null,
          lastActivity: '2024-04-28',
          totalRevenue: 1192,
          paymentMethod: 'Credit Card ****4532',
          features: ['unlimited_boards', 'advanced_analytics', 'priority_support', 'custom_integrations']
        },
        {
          id: 2,
          name: 'Innovation Labs',
          email: 'contact@innovationlabs.io',
          userCount: 15,
          userLimit: 25,
          status: 'active',
          subscriptionStatus: 'trial',
          plan: 'trial',
          planDisplayName: 'Trial',
          billing: null,
          nextBilling: null,
          mrr: 0,
          createdAt: '2024-04-20',
          trialEndsAt: '2024-04-27',
          lastActivity: '2024-04-26',
          totalRevenue: 0,
          paymentMethod: null,
          features: ['basic_boards', 'basic_analytics']
        },
        {
          id: 3,
          name: 'Digital Dynamics',
          email: 'hello@digitaldynamics.com',
          userCount: 78,
          userLimit: 100,
          status: 'active',
          subscriptionStatus: 'paid',
          plan: 'premium',
          planDisplayName: 'Premium',
          billing: 'yearly',
          nextBilling: '2024-12-10',
          mrr: 79,
          createdAt: '2024-02-10',
          trialEndsAt: null,
          lastActivity: '2024-04-25',
          totalRevenue: 948,
          paymentMethod: 'Credit Card ****8901',
          features: ['advanced_boards', 'advanced_analytics', 'integrations']
        },
        {
          id: 4,
          name: 'Future Systems',
          email: 'admin@futuresystems.net',
          userCount: 8,
          userLimit: 10,
          status: 'active',
          subscriptionStatus: 'paid',
          plan: 'starter',
          planDisplayName: 'Starter',
          billing: 'monthly',
          nextBilling: '2024-05-05',
          mrr: 29,
          createdAt: '2024-03-12',
          trialEndsAt: null,
          lastActivity: '2024-04-27',
          totalRevenue: 87,
          paymentMethod: 'PayPal',
          features: ['basic_boards', 'basic_analytics']
        },
        {
          id: 5,
          name: 'Enterprise Corp',
          email: 'billing@enterprisecorp.com',
          userCount: 250,
          userLimit: null,
          status: 'active',
          subscriptionStatus: 'paid',
          plan: 'enterprise',
          planDisplayName: 'Enterprise',
          billing: 'yearly',
          nextBilling: '2024-08-15',
          mrr: 299,
          createdAt: '2024-01-08',
          trialEndsAt: null,
          lastActivity: '2024-04-28',
          totalRevenue: 3588,
          paymentMethod: 'Wire Transfer',
          features: ['unlimited_boards', 'enterprise_analytics', 'dedicated_support', 'custom_integrations', 'sso', 'audit_logs']
        },
        {
          id: 6,
          name: 'Startup Innovate',
          email: 'team@startupinnovate.co',
          userCount: 5,
          userLimit: 10,
          status: 'active',
          subscriptionStatus: 'trial_expired',
          plan: 'trial',
          planDisplayName: 'Trial (Expired)',
          billing: null,
          nextBilling: null,
          mrr: 0,
          createdAt: '2024-03-20',
          trialEndsAt: '2024-03-27',
          lastActivity: '2024-04-15',
          totalRevenue: 0,
          paymentMethod: null,
          features: []
        }
      ];

      // Fetch real companies data from backend
      const response = await platformAPI.getCompanies(
        1, // page
        50, // limit
        sortBy,
        sortOrder,
        filters.plan !== 'all' ? filters.plan : null,
        filters.status !== 'all' ? filters.status : null
      );

      // Transform backend data to match frontend structure
      const transformedCompanies = response.companies.map(company => ({
        id: company.id,
        name: company.name,
        email: company.email,
        userCount: company.userCount,
        userLimit: 100, // Default limit, can be from subscription data
        status: 'active', // Default status
        subscriptionStatus: 'paid', // Default, can be from subscription data
        plan: 'starter', // Default plan, can be from subscription data
        planDisplayName: 'Starter',
        billing: 'monthly',
        nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        mrr: 29, // Default MRR for starter plan
        createdAt: company.createdAt,
        trialEndsAt: null,
        lastActivity: new Date().toISOString().split('T')[0],
        totalRevenue: company.userCount * 29, // Estimated revenue
        paymentMethod: 'Credit Card ****1234',
        features: ['basic_collaboration', 'standard_support']
      }));

      setCompanies(transformedCompanies);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(company => {
    const matchesPlan = filters.plan === 'all' || company.plan === filters.plan;
    const matchesStatus = filters.status === 'all' || company.subscriptionStatus === filters.status;
    const matchesSearch = company.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                         company.email.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesPlan && matchesStatus && matchesSearch;
  });

  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    let valueA = a[sortBy];
    let valueB = b[sortBy];

    if (sortBy === 'createdAt' || sortBy === 'lastActivity') {
      valueA = new Date(valueA);
      valueB = new Date(valueB);
    }

    if (sortOrder === 'asc') {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      paid: { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' },
      trial: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Trial' },
      trial_expired: { bg: 'bg-red-100', text: 'text-red-800', label: 'Trial Expired' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' }
    };

    const config = statusConfig[status] || statusConfig.paid;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getPlanBadge = (plan) => {
    const planConfig = {
      trial: { bg: 'bg-gray-100', text: 'text-gray-800' },
      starter: { bg: 'bg-blue-100', text: 'text-blue-800' },
      premium: { bg: 'bg-purple-100', text: 'text-purple-800' },
      professional: { bg: 'bg-green-100', text: 'text-green-800' },
      enterprise: { bg: 'bg-orange-100', text: 'text-orange-800' }
    };

    const config = planConfig[plan] || planConfig.starter;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}>
        {SUBSCRIPTION_PLANS[plan]?.name || plan}
      </span>
    );
  };

  const calculateTrialDaysLeft = (trialEndsAt) => {
    if (!trialEndsAt) return null;
    const now = new Date();
    const endDate = new Date(trialEndsAt);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handleUpgrade = (company) => {
    setSelectedCompany(company);
    setShowUpgradeModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
            <p className="text-gray-600">Manage platform companies and their subscriptions</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Companies</p>
            <p className="text-2xl font-semibold text-gray-900">{companies.length}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Paid Companies</p>
              <p className="text-2xl font-semibold text-green-600">
                {companies.filter(c => c.subscriptionStatus === 'paid').length}
              </p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Trial Companies</p>
              <p className="text-2xl font-semibold text-blue-600">
                {companies.filter(c => c.subscriptionStatus === 'trial').length}
              </p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Total MRR</p>
              <p className="text-2xl font-semibold text-purple-600">
                {formatCurrency(companies.reduce((sum, c) => sum + c.mrr, 0))}
              </p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Avg Revenue</p>
              <p className="text-2xl font-semibold text-orange-600">
                {formatCurrency(companies.reduce((sum, c) => sum + c.mrr, 0) / Math.max(companies.filter(c => c.subscriptionStatus === 'paid').length, 1))}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search companies..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select
                value={filters.plan}
                onChange={(e) => setFilters({ ...filters, plan: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Plans</option>
                <option value="trial">Trial</option>
                <option value="starter">Starter</option>
                <option value="premium">Premium</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="trial">Trial</option>
                <option value="trial_expired">Trial Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="mrr-desc">Highest MRR</option>
                <option value="mrr-asc">Lowest MRR</option>
                <option value="userCount-desc">Most Users</option>
                <option value="userCount-asc">Fewest Users</option>
              </select>
            </div>
          </div>
        </div>

        {/* Companies Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan & Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MRR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Billing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedCompanies.map((company) => {
                  const trialDaysLeft = calculateTrialDaysLeft(company.trialEndsAt);
                  return (
                    <tr key={company.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{company.name}</div>
                          <div className="text-sm text-gray-500">{company.email}</div>
                          <div className="text-xs text-gray-400">
                            Joined {new Date(company.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {getPlanBadge(company.plan)}
                          {getStatusBadge(company.subscriptionStatus)}
                          {trialDaysLeft !== null && trialDaysLeft >= 0 && (
                            <div className="text-xs text-orange-600">
                              {trialDaysLeft} days left
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <span className="font-medium">{company.userCount}</span>
                          {company.userLimit && (
                            <span className="text-gray-500"> / {company.userLimit}</span>
                          )}
                          {!company.userLimit && (
                            <span className="text-gray-500"> / Unlimited</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          Active {new Date(company.lastActivity).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(company.mrr)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Total: {formatCurrency(company.totalRevenue)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {company.nextBilling ? (
                          <div>
                            <div>{new Date(company.nextBilling).toLocaleDateString()}</div>
                            <div className="text-xs capitalize">{company.billing}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex space-x-2">
                          {company.subscriptionStatus === 'trial' || company.subscriptionStatus === 'trial_expired' ? (
                            <button
                              onClick={() => handleUpgrade(company)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Upgrade
                            </button>
                          ) : (
                            <button className="text-gray-600 hover:text-gray-900">
                              Manage
                            </button>
                          )}
                          <button className="text-gray-600 hover:text-gray-900">
                            View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {sortedCompanies.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m5 0v-4a1 1 0 011-1h2a1 1 0 011 1v4m-5 0v-4a1 1 0 011-1h2a1 1 0 011 1v4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No companies found</h3>
            <p className="mt-1 text-sm text-gray-500">No companies match your current filters.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Companies;