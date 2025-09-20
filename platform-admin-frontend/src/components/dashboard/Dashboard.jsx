import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { platformAPI } from '../../utils/api';
import { SUBSCRIPTION_PLANS, formatPrice, getPlanColor } from '../../utils/subscriptionPlans';
import Layout from '../layout/Layout';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F', '#FFBB28'];

const Dashboard = () => {
  const [businessMetrics, setBusinessMetrics] = useState(null);
  const [subscriptionAnalytics, setSubscriptionAnalytics] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [trialConversions, setTrialConversions] = useState(null);
  const [timeframe, setTimeframe] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [timeframe]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch real business metrics from backend
      const [businessData, revenueDataResponse] = await Promise.all([
        platformAPI.getBusinessMetrics(),
        platformAPI.getRevenueData(timeframe)
      ]);

      setBusinessMetrics(businessData);
      setRevenueData(revenueDataResponse);

      // Mock subscription analytics (until backend endpoint is ready)
      const mockSubscriptionAnalytics = {
        planDistribution: [
          { name: 'Trial', count: businessData.totalCompanies - businessData.payingCompanies, revenue: 0, percentage: ((businessData.totalCompanies - businessData.payingCompanies) / businessData.totalCompanies * 100).toFixed(1) },
          { name: 'Starter', count: Math.floor(businessData.payingCompanies * 0.36), revenue: Math.floor(businessData.payingCompanies * 0.36 * 29), percentage: 36.3 },
          { name: 'Premium', count: Math.floor(businessData.payingCompanies * 0.31), revenue: Math.floor(businessData.payingCompanies * 0.31 * 79), percentage: 31.0 },
          { name: 'Professional', count: Math.floor(businessData.payingCompanies * 0.23), revenue: Math.floor(businessData.payingCompanies * 0.23 * 149), percentage: 23.0 },
          { name: 'Enterprise', count: Math.floor(businessData.payingCompanies * 0.10), revenue: Math.floor(businessData.payingCompanies * 0.10 * 299), percentage: 10.0 }
        ],
        monthlyGrowth: [
          { month: 'Jan', starter: Math.floor(businessData.payingCompanies * 0.32), premium: Math.floor(businessData.payingCompanies * 0.28), professional: Math.floor(businessData.payingCompanies * 0.20), enterprise: Math.floor(businessData.payingCompanies * 0.08) },
          { month: 'Feb', starter: Math.floor(businessData.payingCompanies * 0.33), premium: Math.floor(businessData.payingCompanies * 0.29), professional: Math.floor(businessData.payingCompanies * 0.21), enterprise: Math.floor(businessData.payingCompanies * 0.08) },
          { month: 'Mar', starter: Math.floor(businessData.payingCompanies * 0.35), premium: Math.floor(businessData.payingCompanies * 0.30), professional: Math.floor(businessData.payingCompanies * 0.22), enterprise: Math.floor(businessData.payingCompanies * 0.09) },
          { month: 'Apr', starter: Math.floor(businessData.payingCompanies * 0.36), premium: Math.floor(businessData.payingCompanies * 0.31), professional: Math.floor(businessData.payingCompanies * 0.23), enterprise: Math.floor(businessData.payingCompanies * 0.10) }
        ]
      };

      // Mock trial conversions (until backend endpoint is ready)
      const mockTrialConversions = {
        conversionRate: 68.4,
        avgDaysToConvert: 4.2,
        conversionsByPlan: [
          { plan: 'Starter', conversions: businessData.newPayingCompanies * 0.5, rate: 75.2 },
          { plan: 'Premium', conversions: businessData.newPayingCompanies * 0.3, rate: 65.8 },
          { plan: 'Professional', conversions: businessData.newPayingCompanies * 0.15, rate: 58.1 },
          { plan: 'Enterprise', conversions: businessData.newPayingCompanies * 0.05, rate: 45.0 }
        ]
      };

      setSubscriptionAnalytics(mockSubscriptionAnalytics);
      setTrialConversions(mockTrialConversions);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
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
            <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
            <p className="text-gray-600">Monitor your SaaS platform's performance and growth</p>
          </div>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
        </div>

        {/* Key Metrics */}
        {businessMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Monthly Recurring Revenue</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(businessMetrics.mrr)}</p>
                  <p className="text-xs text-green-600">{formatPercentage(businessMetrics.mrrGrowth)} growth</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m5 0v-4a1 1 0 011-1h2a1 1 0 011 1v4m-5 0v-4a1 1 0 011-1h2a1 1 0 011 1v4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Paying Companies</p>
                  <p className="text-2xl font-semibold text-gray-900">{businessMetrics.payingCompanies}</p>
                  <p className="text-xs text-blue-600">{businessMetrics.trialCompanies} in trial</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-semibold text-gray-900">{businessMetrics.conversionRate}%</p>
                  <p className="text-xs text-purple-600">Trial to paid</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Churn Rate</p>
                  <p className="text-2xl font-semibold text-gray-900">{businessMetrics.churnRate}%</p>
                  <p className="text-xs text-orange-600">Monthly churn</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          {revenueData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue & Conversion Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="revenue" orientation="left" tickFormatter={formatCurrency} />
                  <YAxis yAxisId="conversions" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                      return [value, name === 'conversions' ? 'Conversions' : 'New Trials'];
                    }}
                  />
                  <Legend />
                  <Area yAxisId="revenue" type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Line yAxisId="conversions" type="monotone" dataKey="conversions" stroke="#ff7300" strokeWidth={2} />
                  <Line yAxisId="conversions" type="monotone" dataKey="trials" stroke="#82ca9d" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Plan Distribution */}
          {subscriptionAnalytics && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Plan Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={subscriptionAnalytics.planDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                  >
                    {subscriptionAnalytics.planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, 'Companies']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Plan */}
          {revenueData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Plan Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData.revenueByPlan}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                      return [value, 'Companies'];
                    }}
                  />
                  <Bar dataKey="revenue" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Subscription Growth */}
          {subscriptionAnalytics && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Growth by Plan</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={subscriptionAnalytics.monthlyGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="starter" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="premium" stroke="#82ca9d" strokeWidth={2} />
                  <Line type="monotone" dataKey="professional" stroke="#ffc658" strokeWidth={2} />
                  <Line type="monotone" dataKey="enterprise" stroke="#ff7300" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Trial Conversion Summary */}
        {trialConversions && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trial Conversion Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {trialConversions.conversionsByPlan.map((plan, index) => (
                <div key={plan.plan} className="text-center p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">{plan.plan}</h4>
                  <p className="text-2xl font-semibold text-blue-600">{plan.rate}%</p>
                  <p className="text-sm text-gray-500">{plan.conversions} conversions</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;