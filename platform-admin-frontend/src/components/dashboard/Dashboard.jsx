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
  Cell
} from 'recharts';
import { platformAPI } from '../../utils/api';
import Navbar from '../layout/Navbar';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F', '#FFBB28'];

const Dashboard = () => {
  const [businessMetrics, setBusinessMetrics] = useState(null);
  const [companies, setCompanies] = useState({ companies: [], pagination: {} });
  const [revenueData, setRevenueData] = useState(null);
  const [timeframe, setTimeframe] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [timeframe]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // For now, use mock data since we haven't connected to the backend endpoints yet
      const mockBusinessMetrics = {
        totalRevenue: 45780,
        revenueGrowth: 12.5,
        payingCompanies: 8,
        newPayingCompanies: 3,
        avgRevenuePerCompany: 5722,
        avgRevenueGrowth: 8.2,
        mrr: 38150,
        mrrGrowth: 15.3,
        totalCompanies: 12
      };

      const mockRevenueData = {
        monthlyRevenue: [
          { month: 'Jan', revenue: 32000 },
          { month: 'Feb', revenue: 35200 },
          { month: 'Mar', revenue: 38500 },
          { month: 'Apr', revenue: 41200 },
          { month: 'May', revenue: 43800 },
          { month: 'Jun', revenue: 45780 }
        ],
        revenueByPlan: [
          { name: 'Starter', revenue: 8950, count: 15 },
          { name: 'Professional', revenue: 18420, count: 8 },
          { name: 'Enterprise', revenue: 12680, count: 3 },
          { name: 'Premium', revenue: 5730, count: 2 }
        ]
      };

      const mockCompanies = {
        companies: [
          { id: 1, name: 'TechCorp Solutions', userCount: 45, status: 'Active', createdAt: '2024-01-15', plan: 'Enterprise' },
          { id: 2, name: 'Innovation Labs', userCount: 32, status: 'Active', createdAt: '2024-02-10', plan: 'Professional' },
          { id: 3, name: 'Digital Dynamics', userCount: 28, status: 'Active', createdAt: '2024-02-25', plan: 'Professional' },
          { id: 4, name: 'Future Systems', userCount: 15, status: 'Active', createdAt: '2024-03-12', plan: 'Starter' },
          { id: 5, name: 'NextGen Tech', userCount: 52, status: 'Active', createdAt: '2024-03-28', plan: 'Premium' },
        ],
        pagination: { total: 12, page: 1, limit: 20 }
      };

      setBusinessMetrics(mockBusinessMetrics);
      setRevenueData(mockRevenueData);
      setCompanies(mockCompanies);
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
                <p className="text-gray-600">Monitor your platform's performance and growth</p>
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

            {/* Revenue Metrics Cards */}
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
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-semibold text-gray-900">{formatCurrency(businessMetrics.totalRevenue)}</p>
                      <p className={`text-xs ${businessMetrics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(businessMetrics.revenueGrowth)} vs last period
                      </p>
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
                      <p className="text-xs text-blue-600">
                        +{businessMetrics.newPayingCompanies} new this month
                      </p>
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
                      <p className="text-sm font-medium text-gray-600">Avg Revenue/Company</p>
                      <p className="text-2xl font-semibold text-gray-900">{formatCurrency(businessMetrics.avgRevenuePerCompany)}</p>
                      <p className="text-xs text-purple-600">
                        {formatPercentage(businessMetrics.avgRevenueGrowth)} growth
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Monthly Recurring Revenue</p>
                      <p className="text-2xl font-semibold text-gray-900">{formatCurrency(businessMetrics.mrr)}</p>
                      <p className="text-xs text-orange-600">
                        {formatPercentage(businessMetrics.mrrGrowth)} this month
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts */}
            {revenueData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Revenue Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueData.monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={formatCurrency} />
                      <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        dot={{ fill: '#8884d8' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue by Plan Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Plan Type</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData.revenueByPlan}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={formatCurrency} />
                      <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Companies Table */}
            {companies && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Platform Companies</h3>
                  <p className="text-sm text-gray-600">Companies using your collaboration platform</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Users
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {companies.companies.map((company) => (
                        <tr key={company.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{company.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {company.userCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              company.plan === 'Premium' ? 'bg-purple-100 text-purple-800' :
                              company.plan === 'Enterprise' ? 'bg-blue-100 text-blue-800' :
                              company.plan === 'Professional' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {company.plan}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {company.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(company.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;