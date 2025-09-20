// Subscription Plans Configuration
export const SUBSCRIPTION_PLANS = {
  TRIAL: {
    id: 'trial',
    name: '7-Day Free Trial',
    price: 0,
    duration: 7, // days
    features: [
      'Up to 5 users',
      'Basic collaboration tools',
      'Limited storage (1GB)',
      'Email support',
      'Basic analytics'
    ],
    limitations: {
      maxUsers: 5,
      maxDepartments: 1,
      maxBranches: 1,
      storageGB: 1,
      supportLevel: 'email'
    }
  },
  STARTER: {
    id: 'starter',
    name: 'Starter',
    price: 29,
    priceAnnual: 290, // 2 months free
    duration: 'monthly',
    description: 'Perfect for small companies and businesses',
    features: [
      'Up to 25 users',
      'All collaboration tools',
      'Enhanced storage (10GB)',
      'Priority email support',
      'Advanced analytics',
      'Custom company branding'
    ],
    limitations: {
      maxUsers: 25,
      maxDepartments: 3,
      maxBranches: 1,
      storageGB: 10,
      supportLevel: 'priority_email'
    },
    popular: false
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium',
    price: 79,
    priceAnnual: 790, // 2 months free
    duration: 'monthly',
    description: 'Ideal for companies with departments',
    features: [
      'Up to 100 users',
      'Department management',
      'Advanced collaboration tools',
      'Enhanced storage (50GB)',
      'Phone & email support',
      'Advanced analytics & reporting',
      'API access',
      'Custom integrations'
    ],
    limitations: {
      maxUsers: 100,
      maxDepartments: 10,
      maxBranches: 1,
      storageGB: 50,
      supportLevel: 'phone_email'
    },
    popular: true
  },
  PROFESSIONAL: {
    id: 'professional',
    name: 'Professional',
    price: 149,
    priceAnnual: 1490, // 2 months free
    duration: 'monthly',
    description: 'For companies with up to 3 branches',
    features: [
      'Up to 500 users',
      'Multi-branch management',
      'Advanced department controls',
      'Premium storage (200GB)',
      'Dedicated account manager',
      'Advanced analytics & insights',
      'Full API access',
      'Custom integrations',
      'Priority support'
    ],
    limitations: {
      maxUsers: 500,
      maxDepartments: 50,
      maxBranches: 3,
      storageGB: 200,
      supportLevel: 'dedicated_manager'
    },
    popular: false
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    priceAnnual: 2990, // 2 months free
    duration: 'monthly',
    description: 'For large companies with worldwide branches',
    features: [
      'Unlimited users',
      'Unlimited branches worldwide',
      'Advanced enterprise controls',
      'Unlimited storage',
      'Dedicated success team',
      'Custom analytics & reporting',
      'Full API & webhook access',
      'Custom integrations & development',
      '24/7 priority support',
      'On-premise deployment option',
      'Advanced security features',
      'Custom SLA'
    ],
    limitations: {
      maxUsers: -1, // unlimited
      maxDepartments: -1, // unlimited
      maxBranches: -1, // unlimited
      storageGB: -1, // unlimited
      supportLevel: 'enterprise'
    },
    popular: false
  }
};

// Helper functions
export const getPlanById = (planId) => {
  return Object.values(SUBSCRIPTION_PLANS).find(plan => plan.id === planId);
};

export const formatPrice = (price, annual = false) => {
  if (price === 0) return 'Free';
  return `$${annual ? (price * 10).toLocaleString() : price}/month`;
};

export const getPlanColor = (planId) => {
  const colors = {
    trial: 'gray',
    starter: 'blue',
    premium: 'purple',
    professional: 'green',
    enterprise: 'orange'
  };
  return colors[planId] || 'gray';
};

export const getPlanFeatures = (planId) => {
  const plan = getPlanById(planId);
  return plan ? plan.features : [];
};

export const canUpgrade = (currentPlan, targetPlan) => {
  const planHierarchy = ['trial', 'starter', 'premium', 'professional', 'enterprise'];
  const currentIndex = planHierarchy.indexOf(currentPlan);
  const targetIndex = planHierarchy.indexOf(targetPlan);
  return targetIndex > currentIndex;
};

export const getTrialDaysRemaining = (trialStartDate) => {
  const start = new Date(trialStartDate);
  const now = new Date();
  const diffTime = (start.getTime() + (7 * 24 * 60 * 60 * 1000)) - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};