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
  Area,
  FunnelChart,
  Funnel
} from 'recharts';
import { platformAPI } from '../../utils/api';
import { SUBSCRIPTION_PLANS, formatPrice } from '../../utils/subscriptionPlans';
import Layout from '../layout/Layout';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F', '#FFBB28'];

const Revenue = () => {
  const [revenueData, setRevenueData] = useState(null);
  const [conversionData, setConversionData] = useState(null);
  const [churnData, setChurnData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [timeframe, setTimeframe] = useState('12m');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenueData();
  }, [timeframe]);

  const fetchRevenueData = async () => {
    setLoading(true);
    try {
      // Fetch real revenue data from backend
      const [businessMetrics, revenueDataResponse] = await Promise.all([
        platformAPI.getBusinessMetrics(),
        platformAPI.getRevenueData(timeframe)
      ]);

      // Transform backend data for revenue analytics
      const transformedRevenueData = {
        overview: {
          totalRevenue: businessMetrics.totalRevenue,
          revenueGrowth: businessMetrics.revenueGrowth,
          mrr: businessMetrics.mrr,
          arr: businessMetrics.mrr * 12,
          avgRevenuePerUser: businessMetrics.avgRevenuePerCompany,
          ltv: 2846, // Mock data for now
          customerAcquisitionCost: 287, // Mock data for now
        },
        monthly: revenueDataResponse.monthlyRevenue || [],
        byPlan: revenueDataResponse.revenueByPlan || []
      };

      // Mock conversion data (until backend endpoint is ready)
      const mockConversionData = {
        overview: {
          totalRevenue: 147850,
          revenueGrowth: 23.5,
          mrr: 98430,
          arr: 1181160,
          avgRevenuePerUser: 103.2,
          ltv: 2846,
          customerAcquisitionCost: 287,
          paybackPeriod: 2.8,
          netRevenueRetention: 115.2
        },
        monthlyRevenue: [
          { month: 'Jan 2024', revenue: 78540, newCustomers: 12, churn: 2, expansion: 4800 },
          { month: 'Feb 2024', revenue: 82100, newCustomers: 15, churn: 1, expansion: 6200 },
          { month: 'Mar 2024', revenue: 87350, newCustomers: 18, churn: 3, expansion: 5800 },
          { month: 'Apr 2024', revenue: 93200, newCustomers: 21, churn: 2, expansion: 7100 },
          { month: 'May 2024', revenue: 98430, newCustomers: 19, churn: 4, expansion: 8300 },
          { month: 'Jun 2024', revenue: 104580, newCustomers: 23, churn: 1, expansion: 9200 },
          { month: 'Jul 2024', revenue: 112340, newCustomers: 26, churn: 3, expansion: 10500 },
          { month: 'Aug 2024', revenue: 119850, newCustomers: 22, churn: 2, expansion: 11200 },
          { month: 'Sep 2024', revenue: 127600, newCustomers: 28, churn: 5, expansion: 12100 },
          { month: 'Oct 2024', revenue: 136420, newCustomers: 31, churn: 3, expansion: 13800 },
          { month: 'Nov 2024', revenue: 142180, newCustomers: 24, churn: 2, expansion: 14200 },
          { month: 'Dec 2024', revenue: 147850, newCustomers: 29, churn: 4, expansion: 15300 }
        ],
        revenueByPlan: [
          { plan: 'Starter', revenue: 32580, customers: 112, avgRevenue: 291, growth: 18.2 },
          { plan: 'Premium', revenue: 65240, customers: 83, avgRevenue: 786, growth: 25.4 },
          { plan: 'Professional', revenue: 41720, customers: 28, avgRevenue: 1490, growth: 22.1 },
          { plan: 'Enterprise', revenue: 8310, customers: 3, avgRevenue: 2770, growth: 33.0 }
        ],
        cohortAnalysis: [
          { cohort: 'Jan 2024', month0: 100, month1: 95, month2: 89, month3: 85, month4: 82, month5: 80 },
          { cohort: 'Feb 2024', month0: 100, month1: 92, month2: 87, month3: 83, month4: 81, month5: null },
          { cohort: 'Mar 2024', month0: 100, month1: 94, month2: 88, month3: 85, month4: null, month5: null },
          { cohort: 'Apr 2024', month0: 100, month1: 96, month2: 91, month3: null, month4: null, month5: null },
          { cohort: 'May 2024', month0: 100, month1: 93, month2: null, month3: null, month4: null, month5: null },
          { cohort: 'Jun 2024', month0: 100, month1: null, month2: null, month3: null, month4: null, month5: null }
        ]
      };

      const mockChurnData = {
        overallChurn: {
          monthly: 3.2,
          annual: 34.8,
          voluntary: 2.1,
          involuntary: 1.1
        },
        churnByPlan: [
          { plan: 'Starter', churn: 4.8, customers: 112, churned: 5.4 },
          { plan: 'Premium', churn: 2.9, customers: 83, churned: 2.4 },
          { plan: 'Professional', churn: 1.8, customers: 28, churned: 0.5 },
          { plan: 'Enterprise', churn: 0.9, customers: 3, churned: 0.03 }
        ],
        churnReasons: [
          { reason: 'Price', percentage: 28.5, count: 42 },
          { reason: 'Lack of Features', percentage: 23.1, count: 34 },
          { reason: 'Poor Support', percentage: 18.7, count: 27 },
          { reason: 'Technical Issues', percentage: 15.6, count: 23 },
          { reason: 'Competitor', percentage: 14.1, count: 21 }
        ]
      };

      const mockForecastData = {
        projections: [
          { month: 'Jan 2025', projected: 156200, conservative: 152800, optimistic: 162400 },
          { month: 'Feb 2025', projected: 165100, conservative: 160900, optimistic: 172800 },
          { month: 'Mar 2025', projected: 174800, conservative: 169500, optimistic: 184200 },
          { month: 'Apr 2025', projected: 185200, conservative: 178800, optimistic: 196500 },
          { month: 'May 2025', projected: 196400, conservative: 188900, optimistic: 209800 },
          { month: 'Jun 2025', projected: 208300, conservative: 199600, optimistic: 224100 }
        ],
        assumptions: {
          growthRate: 5.8,
          churnRate: 3.2,
          conversionRate: 68.4,
          avgRevenueGrowth: 12.5
        }
      };

      setRevenueData(transformedRevenueData);
      setConversionData(mockConversionData);
      setChurnData(mockChurnData);
      setForecastData(mockForecastData);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
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
            <h1 className="text-3xl font-bold text-gray-900">Revenue Analytics</h1>
            <p className="text-gray-600">Deep dive into your platform's monetization performance</p>
          </div>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="6m">Last 6 Months</option>
            <option value="12m">Last 12 Months</option>
            <option value="24m">Last 24 Months</option>
          </select>
        </div>

        {/* Key Revenue Metrics */}
        {revenueData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Annual Recurring Revenue</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(revenueData.overview.arr)}</p>
                  <p className="text-xs text-green-600">{formatPercentage(revenueData.overview.revenueGrowth)} growth</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Customer LTV</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(revenueData.overview.ltv)}</p>
                  <p className="text-xs text-blue-600">CAC: {formatCurrency(revenueData.overview.customerAcquisitionCost)}</p>
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
                  <p className="text-sm font-medium text-gray-600">Net Revenue Retention</p>
                  <p className="text-2xl font-semibold text-gray-900">{revenueData.overview.netRevenueRetention}%</p>
                  <p className="text-xs text-purple-600">Payback: {revenueData.overview.paybackPeriod}m</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Revenue Per User</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(revenueData.overview.avgRevenuePerUser)}</p>
                  <p className="text-xs text-orange-600">Monthly average</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Trend and Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue Growth */}
          {revenueData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue Growth</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value, name) => {
                    if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                    if (name === 'expansion') return [formatCurrency(value), 'Expansion Revenue'];
                    return [value, name === 'newCustomers' ? 'New Customers' : 'Churned'];
                  }} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="expansion" stackId="1" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Revenue by Plan */}
          {revenueData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Subscription Plan</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData.revenueByPlan} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatCurrency} />
                  <YAxis dataKey="plan" type="category" />
                  <Tooltip formatter={(value, name) => {
                    if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                    if (name === 'avgRevenue') return [formatCurrency(value), 'Avg Revenue'];
                    return [value, 'Customers'];
                  }} />
                  <Bar dataKey="revenue" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Conversion Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trial Conversion Trends */}
          {conversionData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Trial Conversion Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={conversionData.trialToCustomer.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="trials" fill="#82ca9d" />
                  <Bar yAxisId="left" dataKey="conversions" fill="#8884d8" />
                  <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#ff7300" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Churn Analysis */}
          {churnData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Churn Rate by Plan</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={churnData.churnByPlan}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="plan" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => {
                    if (name === 'churn') return [`${value}%`, 'Churn Rate'];
                    return [value, 'Customers'];
                  }} />
                  <Bar dataKey="churn" fill="#ff7300" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plan Performance */}
          {revenueData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Performance</h3>
              <div className="space-y-4">
                {revenueData.revenueByPlan.map((plan, index) => (
                  <div key={plan.plan} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{plan.plan}</h4>
                      <p className="text-sm text-gray-500">{plan.customers} customers</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(plan.revenue)}</p>
                      <p className="text-sm text-green-600">{formatPercentage(plan.growth)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Churn Reasons */}
          {churnData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Churn Reasons</h3>
              <div className="space-y-3">
                {churnData.churnReasons.map((reason, index) => (
                  <div key={reason.reason} className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3`} style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-sm text-gray-700">{reason.reason}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900">{reason.percentage}%</span>
                      <span className="text-xs text-gray-500 ml-2">({reason.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue Forecast */}
          {forecastData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Forecast</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={forecastData.projections}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                  <Line type="monotone" dataKey="conservative" stroke="#ff7300" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="projected" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="optimistic" stroke="#82ca9d" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 text-sm text-gray-600">
                <p>Based on {forecastData.assumptions.growthRate}% growth rate</p>
                <p>Conversion: {forecastData.assumptions.conversionRate}% | Churn: {forecastData.assumptions.churnRate}%</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Revenue;