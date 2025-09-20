import React, { useState, useEffect } from 'react';
import { platformAPI } from '../../utils/api';
import Layout from '../layout/Layout';

const Settings = () => {
  const [settings, setSettings] = useState({
    platform: {
      name: 'CollabNotes',
      description: 'Collaborative note-taking platform for teams',
      website: 'https://collabnotes.com',
      supportEmail: 'support@collabnotes.com',
      timezone: 'America/New_York',
      dateFormat: 'MM/dd/yyyy',
      currency: 'USD'
    },
    billing: {
      stripePublicKey: 'pk_test_...',
      stripeSecretKey: '••••••••••••••••',
      webhookEndpoint: 'https://api.collabnotes.com/webhooks/stripe',
      defaultTrialDays: 7,
      gracePeriodDays: 3,
      invoicePrefix: 'INV-',
      taxRate: 0
    },
    notifications: {
      emailEnabled: true,
      slackEnabled: false,
      discordEnabled: false,
      webhookUrl: '',
      notifyOnSignup: true,
      notifyOnSubscription: true,
      notifyOnChurn: true,
      notifyOnPaymentFailed: true,
      notifyOnUsageLimit: true
    },
    security: {
      twoFactorRequired: false,
      sessionTimeout: 24,
      passwordMinLength: 8,
      passwordRequireSpecial: true,
      maxLoginAttempts: 5,
      lockoutDuration: 30,
      allowGoogleAuth: true,
      allowGithubAuth: true
    },
    features: {
      maintenanceMode: false,
      registrationEnabled: true,
      trialEnabled: true,
      referralProgram: false,
      customBranding: true,
      apiAccess: true,
      webhooksEnabled: true,
      analyticsEnabled: true
    },
    integrations: {
      googleAnalytics: '',
      intercomAppId: '',
      hotjarSiteId: '',
      sentryDsn: '',
      mixpanelToken: '',
      segmentWriteKey: ''
    }
  });

  const [activeTab, setActiveTab] = useState('platform');
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [systemHealth, setSystemHealth] = useState(null);

  useEffect(() => {
    fetchSystemHealth();
  }, []);

  const fetchSystemHealth = async () => {
    try {
      const healthData = await platformAPI.getSystemHealth();
      setSystemHealth(healthData);
    } catch (error) {
      console.error('Error fetching system health:', error);
    }
  };

  const tabs = [
    { id: 'platform', name: 'Platform', icon: '🏢' },
    { id: 'billing', name: 'Billing', icon: '💳' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'security', name: 'Security', icon: '🔒' },
    { id: 'features', name: 'Features', icon: '⚙️' },
    { id: 'integrations', name: 'Integrations', icon: '🔗' },
    { id: 'health', name: 'System Health', icon: '🔍' }
  ];

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      // Mock save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Error saving settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const renderPlatformSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
            <input
              type="text"
              value={settings.platform.name}
              onChange={(e) => updateSetting('platform', 'name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
            <input
              type="url"
              value={settings.platform.website}
              onChange={(e) => updateSetting('platform', 'website', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Platform Description</label>
        <textarea
          value={settings.platform.description}
          onChange={(e) => updateSetting('platform', 'description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
          <input
            type="email"
            value={settings.platform.supportEmail}
            onChange={(e) => updateSetting('platform', 'supportEmail', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <select
            value={settings.platform.timezone}
            onChange={(e) => updateSetting('platform', 'timezone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            value={settings.platform.currency}
            onChange={(e) => updateSetting('platform', 'currency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CAD">CAD (C$)</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderBillingSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Stripe Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Public Key</label>
            <input
              type="text"
              value={settings.billing.stripePublicKey}
              onChange={(e) => updateSetting('billing', 'stripePublicKey', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Secret Key</label>
            <input
              type="password"
              value={settings.billing.stripeSecretKey}
              onChange={(e) => updateSetting('billing', 'stripeSecretKey', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Endpoint</label>
        <input
          type="url"
          value={settings.billing.webhookEndpoint}
          onChange={(e) => updateSetting('billing', 'webhookEndpoint', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Trial Days</label>
          <input
            type="number"
            value={settings.billing.defaultTrialDays}
            onChange={(e) => updateSetting('billing', 'defaultTrialDays', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period Days</label>
          <input
            type="number"
            value={settings.billing.gracePeriodDays}
            onChange={(e) => updateSetting('billing', 'gracePeriodDays', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
          <input
            type="text"
            value={settings.billing.invoicePrefix}
            onChange={(e) => updateSetting('billing', 'invoicePrefix', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
          <input
            type="number"
            step="0.01"
            value={settings.billing.taxRate}
            onChange={(e) => updateSetting('billing', 'taxRate', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Channels</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Email Notifications</h4>
              <p className="text-sm text-gray-500">Send notifications via email</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications.emailEnabled}
                onChange={(e) => updateSetting('notifications', 'emailEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Slack Notifications</h4>
              <p className="text-sm text-gray-500">Send notifications to Slack channels</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications.slackEnabled}
                onChange={(e) => updateSetting('notifications', 'slackEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Event Notifications</h3>
        <div className="space-y-3">
          {[
            { key: 'notifyOnSignup', label: 'New User Signups', description: 'When a new user registers' },
            { key: 'notifyOnSubscription', label: 'New Subscriptions', description: 'When a user subscribes to a plan' },
            { key: 'notifyOnChurn', label: 'Customer Churn', description: 'When a customer cancels their subscription' },
            { key: 'notifyOnPaymentFailed', label: 'Payment Failures', description: 'When a payment fails' },
            { key: 'notifyOnUsageLimit', label: 'Usage Limits', description: 'When customers reach usage limits' }
          ].map((notification) => (
            <div key={notification.key} className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{notification.label}</h4>
                <p className="text-sm text-gray-500">{notification.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications[notification.key]}
                  onChange={(e) => updateSetting('notifications', notification.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Authentication Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Require Two-Factor Authentication</h4>
              <p className="text-sm text-gray-500">Force all users to enable 2FA</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.security.twoFactorRequired}
                onChange={(e) => updateSetting('security', 'twoFactorRequired', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Google Authentication</h4>
              <p className="text-sm text-gray-500">Allow login with Google accounts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.security.allowGoogleAuth}
                onChange={(e) => updateSetting('security', 'allowGoogleAuth', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Password & Session Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (hours)</label>
            <input
              type="number"
              value={settings.security.sessionTimeout}
              onChange={(e) => updateSetting('security', 'sessionTimeout', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Min Length</label>
            <input
              type="number"
              value={settings.security.passwordMinLength}
              onChange={(e) => updateSetting('security', 'passwordMinLength', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Login Attempts</label>
            <input
              type="number"
              value={settings.security.maxLoginAttempts}
              onChange={(e) => updateSetting('security', 'maxLoginAttempts', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderFeaturesSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Features</h3>
        <div className="space-y-4">
          {[
            { key: 'registrationEnabled', label: 'User Registration', description: 'Allow new users to register' },
            { key: 'trialEnabled', label: 'Free Trials', description: 'Offer free trial periods' },
            { key: 'referralProgram', label: 'Referral Program', description: 'Enable customer referral rewards' },
            { key: 'customBranding', label: 'Custom Branding', description: 'Allow customers to customize branding' },
            { key: 'apiAccess', label: 'API Access', description: 'Provide API access to customers' },
            { key: 'webhooksEnabled', label: 'Webhooks', description: 'Enable webhook integrations' },
            { key: 'analyticsEnabled', label: 'Analytics Tracking', description: 'Track user behavior and usage' }
          ].map((feature) => (
            <div key={feature.key} className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{feature.label}</h4>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.features[feature.key]}
                  onChange={(e) => updateSetting('features', feature.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h4 className="font-medium text-yellow-800">Maintenance Mode</h4>
            <p className="text-sm text-yellow-700">Enable maintenance mode to temporarily disable user access</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={settings.features.maintenanceMode}
              onChange={(e) => updateSetting('features', 'maintenanceMode', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderIntegrationsSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Analytics & Tracking</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Analytics ID</label>
            <input
              type="text"
              placeholder="G-XXXXXXXXXX"
              value={settings.integrations.googleAnalytics}
              onChange={(e) => updateSetting('integrations', 'googleAnalytics', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mixpanel Token</label>
            <input
              type="text"
              placeholder="YOUR_PROJECT_TOKEN"
              value={settings.integrations.mixpanelToken}
              onChange={(e) => updateSetting('integrations', 'mixpanelToken', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Support</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Intercom App ID</label>
            <input
              type="text"
              placeholder="YOUR_APP_ID"
              value={settings.integrations.intercomAppId}
              onChange={(e) => updateSetting('integrations', 'intercomAppId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hotjar Site ID</label>
            <input
              type="text"
              placeholder="YOUR_SITE_ID"
              value={settings.integrations.hotjarSiteId}
              onChange={(e) => updateSetting('integrations', 'hotjarSiteId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Development & Monitoring</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sentry DSN</label>
            <input
              type="text"
              placeholder="https://xxxxx@sentry.io/xxxxx"
              value={settings.integrations.sentryDsn}
              onChange={(e) => updateSetting('integrations', 'sentryDsn', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segment Write Key</label>
            <input
              type="text"
              placeholder="YOUR_WRITE_KEY"
              value={settings.integrations.segmentWriteKey}
              onChange={(e) => updateSetting('integrations', 'segmentWriteKey', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderHealthSettings = () => (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">System Health & Monitoring</h3>
      
      {systemHealth ? (
        <div className="space-y-6">
          {/* System Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 mb-3">System Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Database Status:</span>
                <span className={`font-medium ${systemHealth.database?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                  {systemHealth.database?.status || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Overall Status:</span>
                <span className={`font-medium ${systemHealth.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                  {systemHealth.status}
                </span>
              </div>
            </div>
          </div>

          {/* Platform Statistics */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 mb-3">Platform Statistics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{systemHealth.statistics?.companies || 0}</div>
                <div className="text-sm text-gray-600">Companies</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{systemHealth.statistics?.users || 0}</div>
                <div className="text-sm text-gray-600">Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{systemHealth.statistics?.messages || 0}</div>
                <div className="text-sm text-gray-600">Messages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{systemHealth.statistics?.messagesLast24h || 0}</div>
                <div className="text-sm text-gray-600">Messages (24h)</div>
              </div>
            </div>
          </div>

          {/* Storage Information */}
          {systemHealth.storage && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-3">Storage Usage</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Attachments:</span>
                  <span className="font-medium">{systemHealth.storage.totalAttachments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Size:</span>
                  <span className="font-medium">{Math.round(systemHealth.storage.totalSize / 1024 / 1024)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Average Size:</span>
                  <span className="font-medium">{Math.round(systemHealth.storage.averageSize / 1024)} KB</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">
              Last updated: {new Date(systemHealth.timestamp).toLocaleString()}
            </span>
            <button
              onClick={fetchSystemHealth}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading system health data...</p>
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'platform':
        return renderPlatformSettings();
      case 'billing':
        return renderBillingSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'security':
        return renderSecuritySettings();
      case 'features':
        return renderFeaturesSettings();
      case 'integrations':
        return renderIntegrationsSettings();
      case 'health':
        return renderHealthSettings();
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Platform Settings</h1>
            <p className="text-gray-600">Configure your platform's core settings and integrations</p>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`p-4 rounded-lg ${
            saveMessage.includes('Error') 
              ? 'bg-red-50 text-red-800 border border-red-200' 
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}>
            {saveMessage}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;