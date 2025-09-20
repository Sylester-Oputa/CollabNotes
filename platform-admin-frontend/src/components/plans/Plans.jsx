import React, { useState, useEffect } from 'react';
import { platformAPI } from '../../utils/api';
import { SUBSCRIPTION_PLANS, formatPrice } from '../../utils/subscriptionPlans';
import Layout from '../layout/Layout';

// Helper function to simulate plan distribution
const getRandomPlanDistribution = (planId) => {
  const distributions = {
    starter: 0.45,
    premium: 0.30,
    professional: 0.15,
    enterprise: 0.10
  };
  return distributions[planId] || 0.25;
};

const Plans = () => {
  const [plans, setPlans] = useState([]);
  const [planMetrics, setPlanMetrics] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlansData();
  }, []);

  const fetchPlansData = async () => {
    setLoading(true);
    try {
      // Get real business data to compute plan metrics
      const businessMetrics = await platformAPI.getBusinessMetrics();
      
      // Use static plan definitions with computed metrics from real data
      const plansWithMetrics = SUBSCRIPTION_PLANS.map(plan => ({
        ...plan,
        metrics: {
          subscribers: plan.id === 'trial' 
            ? Math.max(0, businessMetrics.totalCompanies - businessMetrics.payingCompanies)
            : Math.floor(businessMetrics.payingCompanies * getRandomPlanDistribution(plan.id)),
          conversionRate: plan.id === 'trial' ? 68.4 : null,
          avgTrialLength: plan.id === 'trial' ? 5.2 : null,
          revenue: plan.id === 'trial' ? 0 : 
            Math.floor(businessMetrics.payingCompanies * getRandomPlanDistribution(plan.id) * plan.price)
        }
      }));

      // Mock data with comprehensive plan management
      const mockPlans = [
        {
          id: 'trial',
          name: 'Trial',
          description: '7-day free trial with basic features to get started',
          price: 0,
          billing: 'trial',
          trialDays: 7,
          isActive: true,
          isPopular: false,
          features: [
            'Up to 3 collaboration boards',
            'Basic real-time editing',
            'Email support',
            '5GB storage',
            'Basic analytics'
          ],
          limits: {
            users: 5,
            boards: 3,
            storage: '5GB',
            support: 'Email'
          },
          metrics: {
            subscribers: 47,
            conversionRate: 68.4,
            avgTrialLength: 5.2,
            revenue: 0
          }
        },
        {
          id: 'starter',
          name: 'Starter',
          description: 'Perfect for small teams and startups',
          price: 29,
          billing: 'monthly',
          trialDays: 7,
          isActive: true,
          isPopular: false,
          features: [
            'Up to 10 users',
            'Unlimited collaboration boards',
            'Real-time editing & comments',
            'Email & chat support',
            '25GB storage',
            'Basic analytics & reporting',
            'Mobile app access'
          ],
          limits: {
            users: 10,
            boards: 'Unlimited',
            storage: '25GB',
            support: 'Email & Chat'
          },
          metrics: {
            subscribers: 89,
            conversionRate: 75.2,
            churnRate: 4.8,
            revenue: 25810
          }
        },
        {
          id: 'premium',
          name: 'Premium',
          description: 'Best for growing teams and departments',
          price: 79,
          billing: 'monthly',
          trialDays: 7,
          isActive: true,
          isPopular: true,
          features: [
            'Up to 25 users',
            'Everything in Starter',
            'Advanced collaboration tools',
            'Priority support',
            '100GB storage',
            'Advanced analytics & insights',
            'Third-party integrations',
            'Custom templates',
            'Version history'
          ],
          limits: {
            users: 25,
            boards: 'Unlimited',
            storage: '100GB',
            support: 'Priority'
          },
          metrics: {
            subscribers: 76,
            conversionRate: 65.8,
            churnRate: 2.9,
            revenue: 60040
          }
        },
        {
          id: 'professional',
          name: 'Professional',
          description: 'Ideal for larger teams and multiple departments',
          price: 149,
          billing: 'monthly',
          trialDays: 7,
          isActive: true,
          isPopular: false,
          features: [
            'Up to 50 users',
            'Everything in Premium',
            'Advanced security features',
            'Dedicated account manager',
            '500GB storage',
            'Custom branding',
            'API access',
            'Advanced permissions',
            'Audit logs',
            'Multiple workspaces'
          ],
          limits: {
            users: 50,
            boards: 'Unlimited',
            storage: '500GB',
            support: 'Dedicated Manager'
          },
          metrics: {
            subscribers: 28,
            conversionRate: 58.1,
            churnRate: 1.8,
            revenue: 34720
          }
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          description: 'Custom solution for large organizations',
          price: 299,
          billing: 'monthly',
          trialDays: 14,
          isActive: true,
          isPopular: false,
          features: [
            'Unlimited users',
            'Everything in Professional',
            'Single Sign-On (SSO)',
            '24/7 phone support',
            'Unlimited storage',
            'Custom integrations',
            'Advanced compliance',
            'Data export tools',
            'Custom training',
            'Service Level Agreement'
          ],
          limits: {
            users: 'Unlimited',
            boards: 'Unlimited',
            storage: 'Unlimited',
            support: '24/7 Phone'
          },
          metrics: {
            subscribers: 5,
            conversionRate: 45.0,
            churnRate: 0.9,
            revenue: 7280
          }
        }
      ];

      const mockPlanMetrics = {
        totalRevenue: 127850,
        totalSubscribers: 245,
        avgRevenuePerUser: 103.2,
        mostPopularPlan: 'starter',
        highestRevenuePlan: 'premium',
        planPerformance: [
          { plan: 'starter', growth: 18.2, satisfaction: 4.1 },
          { plan: 'premium', growth: 25.4, satisfaction: 4.3 },
          { plan: 'professional', growth: 22.1, satisfaction: 4.5 },
          { plan: 'enterprise', growth: 33.0, satisfaction: 4.8 }
        ]
      };

      setPlans(plansWithMetrics);
      setPlanMetrics(mockPlanMetrics);
    } catch (error) {
      console.error('Error fetching plans data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan({ ...plan });
  };

  const handleSavePlan = async (planData) => {
    try {
      // Mock save operation
      const updatedPlans = plans.map(plan => 
        plan.id === planData.id ? planData : plan
      );
      setPlans(updatedPlans);
      setEditingPlan(null);
    } catch (error) {
      console.error('Error saving plan:', error);
    }
  };

  const handleTogglePlanStatus = async (planId, isActive) => {
    try {
      // Mock toggle operation
      const updatedPlans = plans.map(plan => 
        plan.id === planId ? { ...plan, isActive } : plan
      );
      setPlans(updatedPlans);
    } catch (error) {
      console.error('Error toggling plan status:', error);
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

  const getPlanColor = (planId) => {
    const colors = {
      trial: 'gray',
      starter: 'blue',
      premium: 'purple',
      professional: 'green',
      enterprise: 'orange'
    };
    return colors[planId] || 'gray';
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
            <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
            <p className="text-gray-600">Manage your platform's subscription tiers and pricing</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create New Plan
          </button>
        </div>

        {/* Plan Metrics Summary */}
        {planMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-semibold text-green-600">
                  {formatCurrency(planMetrics.totalRevenue)}
                </p>
                <p className="text-xs text-gray-500">Monthly</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Total Subscribers</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {planMetrics.totalSubscribers}
                </p>
                <p className="text-xs text-gray-500">Active customers</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">ARPU</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {formatCurrency(planMetrics.avgRevenuePerUser)}
                </p>
                <p className="text-xs text-gray-500">Average revenue per user</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Top Plan</p>
                <p className="text-2xl font-semibold text-orange-600 capitalize">
                  {planMetrics.mostPopularPlan}
                </p>
                <p className="text-xs text-gray-500">Most subscribers</p>
              </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const color = getPlanColor(plan.id);
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-lg shadow-sm border-2 ${
                  plan.isPopular ? 'border-purple-500' : 'border-gray-200'
                } relative`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="p-6">
                  {/* Plan Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTogglePlanStatus(plan.id, !plan.isActive)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          plan.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-gray-900">
                        {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-gray-500 ml-2">/{plan.billing}</span>
                      )}
                    </div>
                    {plan.trialDays > 0 && (
                      <p className="text-sm text-green-600 mt-1">
                        {plan.trialDays}-day free trial
                      </p>
                    )}
                  </div>

                  {/* Plan Metrics */}
                  <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">{plan.metrics.subscribers}</p>
                      <p className="text-xs text-gray-600">Subscribers</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(plan.metrics.revenue)}
                      </p>
                      <p className="text-xs text-gray-600">Revenue</p>
                    </div>
                    {plan.metrics.conversionRate && (
                      <>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">
                            {plan.metrics.conversionRate}%
                          </p>
                          <p className="text-xs text-gray-600">Conversion</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">
                            {plan.metrics.churnRate || 0}%
                          </p>
                          <p className="text-xs text-gray-600">Churn</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Features */}
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-3">Features</h4>
                    <ul className="space-y-2">
                      {plan.features.slice(0, 5).map((feature, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600">
                          <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                      {plan.features.length > 5 && (
                        <li className="text-sm text-gray-400">
                          +{plan.features.length - 5} more features
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Edit Plan
                    </button>
                    <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Plan Performance Chart */}
        {planMetrics && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Performance Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {planMetrics.planPerformance.map((performance) => {
                const plan = plans.find(p => p.id === performance.plan);
                return (
                  <div key={performance.plan} className="text-center p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 capitalize mb-2">{performance.plan}</h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-600">Growth Rate</p>
                        <p className="text-lg font-semibold text-green-600">+{performance.growth}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Satisfaction</p>
                        <p className="text-lg font-semibold text-yellow-600">{performance.satisfaction}/5.0</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Subscribers</p>
                        <p className="text-lg font-semibold text-blue-600">{plan?.metrics.subscribers}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl m-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Plan: {editingPlan.name}</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                  <input
                    type="text"
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input
                    type="number"
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan(editingPlan)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Plans;