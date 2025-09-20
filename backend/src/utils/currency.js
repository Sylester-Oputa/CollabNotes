// Currency and Timezone Utilities for Nigeria-centered platform

// Real-time currency exchange rates cache
let exchangeRatesCache = {
  rates: {},
  lastUpdated: null,
  cacheExpiryMinutes: 30, // Cache expires after 30 minutes
  fallbackRates: {
    // Fallback rates in case API fails
    USD: 0.00126, // ₦794 = $1 (approximate)
    EUR: 0.0011,  // ₦909 = €1 (approximate)
    GBP: 0.00095, // ₦1053 = £1 (approximate)
    CAD: 0.0016,  // ₦625 = C$1 (approximate)
    AUD: 0.0018,  // ₦556 = A$1 (approximate)
    ZAR: 0.022,   // ₦45 = R1 (approximate)
    GHS: 0.014,   // ₦71 = ₵1 (approximate)
    KES: 0.15,    // ₦6.67 = KSh1 (approximate)
    EGP: 0.058    // ₦17 = £E1 (approximate)
  }
};

// Free currency API endpoints (no API key required)
const CURRENCY_API_ENDPOINTS = [
  'https://api.fxapi.com/v1/latest?base=NGN', // Primary API
  'https://api.exchangerate-api.com/v4/latest/NGN', // Backup API 1
  'https://open.er-api.com/v6/latest/NGN' // Backup API 2
];

// Fetch real-time exchange rates
export const fetchRealTimeRates = async (force = false) => {
  try {
    // Check if cache is still valid
    if (!force && exchangeRatesCache.lastUpdated && exchangeRatesCache.rates) {
      const cacheAge = Date.now() - exchangeRatesCache.lastUpdated;
      const cacheExpiry = exchangeRatesCache.cacheExpiryMinutes * 60 * 1000;
      
      if (cacheAge < cacheExpiry) {
        console.log('💰 Using cached exchange rates');
        return exchangeRatesCache.rates;
      }
    }

    console.log('🌐 Fetching real-time currency exchange rates...');
    
    // Try each API endpoint until one succeeds
    for (const apiUrl of CURRENCY_API_ENDPOINTS) {
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          timeout: 10000, // 10 second timeout
          headers: {
            'User-Agent': 'CollabNotes-Nigeria/1.0'
          }
        });

        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Extract rates based on API response format
        let rates = {};
        if (data.rates) {
          rates = data.rates;
        } else if (data.conversion_rates) {
          rates = data.conversion_rates;
        } else {
          throw new Error('Invalid API response format');
        }

        // Update cache
        exchangeRatesCache.rates = rates;
        exchangeRatesCache.lastUpdated = Date.now();
        
        console.log('✅ Real-time exchange rates updated successfully');
        console.log(`📊 NGN → USD: ${rates.USD ? (1/rates.USD).toFixed(2) : 'N/A'} (₦${rates.USD ? Math.round(1/rates.USD) : 'N/A'} = $1)`);
        
        return rates;
        
      } catch (apiError) {
        console.warn(`⚠️ Currency API failed (${apiUrl}):`, apiError.message);
        continue; // Try next API
      }
    }
    
    // If all APIs fail, use fallback rates
    console.warn('⚠️ All currency APIs failed, using fallback rates');
    exchangeRatesCache.rates = exchangeRatesCache.fallbackRates;
    exchangeRatesCache.lastUpdated = Date.now();
    
    return exchangeRatesCache.fallbackRates;
    
  } catch (error) {
    console.error('❌ Error fetching exchange rates:', error.message);
    
    // Return cached rates if available, otherwise fallback
    if (exchangeRatesCache.rates && Object.keys(exchangeRatesCache.rates).length > 0) {
      console.log('📦 Using last cached exchange rates');
      return exchangeRatesCache.rates;
    }
    
    console.log('📦 Using hardcoded fallback rates');
    return exchangeRatesCache.fallbackRates;
  }
};

// Get current exchange rate for a currency
export const getCurrentExchangeRate = async (currencyCode) => {
  if (currencyCode === 'NGN') return 1; // Base currency
  
  const rates = await fetchRealTimeRates();
  return rates[currencyCode] || exchangeRatesCache.fallbackRates[currencyCode] || 1;
};

// Popular currencies with Nigeria (NGN) as default
export const SUPPORTED_CURRENCIES = {
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    country: 'Nigeria',
    exchangeRate: 1, // Base currency
    popular: true,
    defaultForCountry: 'NG'
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    country: 'United States',
    exchangeRate: 0.00126, // Will be updated with real-time rates
    popular: true,
    defaultForCountry: 'US'
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    country: 'European Union',
    exchangeRate: 0.0011, // Will be updated with real-time rates
    popular: true,
    defaultForCountry: 'EU'
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    country: 'United Kingdom',
    exchangeRate: 0.00095, // Will be updated with real-time rates
    popular: true,
    defaultForCountry: 'GB'
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'C$',
    country: 'Canada',
    exchangeRate: 0.0016, // Will be updated with real-time rates
    popular: true,
    defaultForCountry: 'CA'
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    country: 'Australia',
    exchangeRate: 0.0018, // Will be updated with real-time rates
    popular: true,
    defaultForCountry: 'AU'
  },
  ZAR: {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: 'R',
    country: 'South Africa',
    exchangeRate: 0.022, // Will be updated with real-time rates
    popular: true,
    defaultForCountry: 'ZA'
  },
  GHS: {
    code: 'GHS',
    name: 'Ghanaian Cedi',
    symbol: '₵',
    country: 'Ghana',
    exchangeRate: 0.014, // Will be updated with real-time rates
    popular: true,
    defaultForCountry: 'GH'
  },
  KES: {
    code: 'KES',
    name: 'Kenyan Shilling',
    symbol: 'KSh',
    country: 'Kenya',
    exchangeRate: 0.15, // Will be updated with real-time rates
    popular: true,
    defaultForCountry: 'KE'
  },
  EGP: {
    code: 'EGP',
    name: 'Egyptian Pound',
    symbol: '£E',
    country: 'Egypt',
    exchangeRate: 0.058, // Will be updated with real-time rates
    popular: true,
    defaultForCountry: 'EG'
  }
};

// Popular timezones with Nigeria (Africa/Lagos) as default
export const SUPPORTED_TIMEZONES = {
  'Africa/Lagos': {
    name: 'West Africa Time (WAT)',
    country: 'Nigeria',
    offset: '+01:00',
    popular: true,
    default: true
  },
  'Africa/Cairo': {
    name: 'Egypt Standard Time',
    country: 'Egypt',
    offset: '+02:00',
    popular: true
  },
  'Africa/Johannesburg': {
    name: 'South Africa Standard Time',
    country: 'South Africa',
    offset: '+02:00',
    popular: true
  },
  'Africa/Nairobi': {
    name: 'East Africa Time',
    country: 'Kenya',
    offset: '+03:00',
    popular: true
  },
  'Africa/Accra': {
    name: 'Ghana Mean Time',
    country: 'Ghana',
    offset: '+00:00',
    popular: true
  },
  'America/New_York': {
    name: 'Eastern Time',
    country: 'United States',
    offset: '-05:00',
    popular: true
  },
  'America/Chicago': {
    name: 'Central Time',
    country: 'United States',
    offset: '-06:00',
    popular: true
  },
  'America/Los_Angeles': {
    name: 'Pacific Time',
    country: 'United States',
    offset: '-08:00',
    popular: true
  },
  'Europe/London': {
    name: 'Greenwich Mean Time',
    country: 'United Kingdom',
    offset: '+00:00',
    popular: true
  },
  'Europe/Paris': {
    name: 'Central European Time',
    country: 'France',
    offset: '+01:00',
    popular: true
  },
  'Europe/Berlin': {
    name: 'Central European Time',
    country: 'Germany',
    offset: '+01:00',
    popular: true
  },
  'Asia/Dubai': {
    name: 'Gulf Standard Time',
    country: 'UAE',
    offset: '+04:00',
    popular: true
  },
  'Asia/Singapore': {
    name: 'Singapore Time',
    country: 'Singapore',
    offset: '+08:00',
    popular: true
  },
  'Australia/Sydney': {
    name: 'Australian Eastern Time',
    country: 'Australia',
    offset: '+10:00',
    popular: true
  },
  'UTC': {
    name: 'Coordinated Universal Time',
    country: 'International',
    offset: '+00:00',
    popular: true
  }
};

// Default platform settings for Nigeria
export const DEFAULT_PLATFORM_SETTINGS = {
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  dateFormat: 'DD/MM/YYYY', // Nigerian format
  timeFormat: '24h',
  country: 'NG',
  locale: 'en-NG'
};

// Currency formatting utilities with real-time rates
export const formatCurrency = async (amount, currencyCode = 'NGN', locale = 'en-NG', useRealTimeRates = true) => {
  const currency = SUPPORTED_CURRENCIES[currencyCode];
  if (!currency) {
    throw new Error(`Unsupported currency: ${currencyCode}`);
  }

  let convertedAmount = amount;
  
  // Convert from NGN base if needed using real-time rates
  if (currencyCode !== 'NGN' && useRealTimeRates) {
    try {
      const realTimeRate = await getCurrentExchangeRate(currencyCode);
      convertedAmount = amount * realTimeRate;
    } catch (error) {
      console.warn(`⚠️ Failed to get real-time rate for ${currencyCode}, using fallback`);
      convertedAmount = amount * currency.exchangeRate;
    }
  } else if (currencyCode !== 'NGN') {
    convertedAmount = amount * currency.exchangeRate;
  }

  try {
    // Use appropriate locale for currency
    const localeMap = {
      'NGN': 'en-NG',
      'USD': 'en-US',
      'EUR': 'en-EU',
      'GBP': 'en-GB',
      'CAD': 'en-CA',
      'AUD': 'en-AU',
      'ZAR': 'en-ZA',
      'GHS': 'en-GH',
      'KES': 'en-KE',
      'EGP': 'en-EG'
    };

    const formatLocale = localeMap[currencyCode] || 'en-NG';
    
    return new Intl.NumberFormat(formatLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: currencyCode === 'NGN' ? 0 : 2,
      maximumFractionDigits: currencyCode === 'NGN' ? 0 : 2,
    }).format(convertedAmount);
  } catch (error) {
    // Fallback formatting
    const formattedAmount = currencyCode === 'NGN' ? 
      Math.round(convertedAmount).toLocaleString() : 
      convertedAmount.toFixed(2);
    return `${currency.symbol}${formattedAmount}`;
  }
};

// Format already converted currency amounts (no conversion applied)
export const formatConvertedCurrency = (amount, currencyCode) => {
  const currency = SUPPORTED_CURRENCIES[currencyCode];
  if (!currency) {
    throw new Error(`Unsupported currency: ${currencyCode}`);
  }

  try {
    const localeMap = {
      'NGN': 'en-NG',
      'USD': 'en-US',
      'EUR': 'en-EU',
      'GBP': 'en-GB',
      'CAD': 'en-CA',
      'AUD': 'en-AU',
      'ZAR': 'en-ZA',
      'GHS': 'en-GH',
      'KES': 'en-KE',
      'EGP': 'en-EG'
    };

    const formatLocale = localeMap[currencyCode] || 'en-NG';
    
    return new Intl.NumberFormat(formatLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: currencyCode === 'NGN' ? 0 : 2,
      maximumFractionDigits: currencyCode === 'NGN' ? 0 : 2,
    }).format(amount);
  } catch (error) {
    // Fallback formatting
    const formattedAmount = currencyCode === 'NGN' ? 
      Math.round(amount).toLocaleString() : 
      amount.toFixed(2);
    return `${currency.symbol}${formattedAmount}`;
  }
};

// Convert currency amounts with real-time rates
export const convertCurrency = async (amount, fromCurrency = 'NGN', toCurrency = 'NGN', useRealTimeRates = true) => {
  if (fromCurrency === toCurrency) return amount;
  
  try {
    if (useRealTimeRates) {
      // Use real-time exchange rates
      const fromRate = fromCurrency === 'NGN' ? 1 : await getCurrentExchangeRate(fromCurrency);
      const toRate = toCurrency === 'NGN' ? 1 : await getCurrentExchangeRate(toCurrency);
      
      // Convert through NGN base
      const ngnAmount = fromCurrency === 'NGN' ? amount : amount / fromRate;
      return toCurrency === 'NGN' ? ngnAmount : ngnAmount * toRate;
    } else {
      // Use fallback static rates
      const fromRate = SUPPORTED_CURRENCIES[fromCurrency]?.exchangeRate || 1;
      const toRate = SUPPORTED_CURRENCIES[toCurrency]?.exchangeRate || 1;
      
      const ngnAmount = fromCurrency === 'NGN' ? amount : amount / fromRate;
      return toCurrency === 'NGN' ? ngnAmount : ngnAmount * toRate;
    }
  } catch (error) {
    console.warn(`⚠️ Real-time conversion failed, using fallback rates: ${error.message}`);
    
    // Fallback to static rates
    const fromRate = SUPPORTED_CURRENCIES[fromCurrency]?.exchangeRate || 1;
    const toRate = SUPPORTED_CURRENCIES[toCurrency]?.exchangeRate || 1;
    
    const ngnAmount = fromCurrency === 'NGN' ? amount : amount / fromRate;
    return toCurrency === 'NGN' ? ngnAmount : ngnAmount * toRate;
  }
};

// Get exchange rate information with real-time data
export const getExchangeRateInfo = async (currencyCode) => {
  const currency = SUPPORTED_CURRENCIES[currencyCode];
  if (!currency) {
    throw new Error(`Unsupported currency: ${currencyCode}`);
  }

  if (currencyCode === 'NGN') {
    return {
      code: 'NGN',
      name: currency.name,
      symbol: currency.symbol,
      rate: 1,
      lastUpdated: new Date().toISOString(),
      isBaseCurrency: true,
      source: 'base'
    };
  }

  try {
    const realTimeRate = await getCurrentExchangeRate(currencyCode);
    const inverseRate = 1 / realTimeRate; // How many NGN for 1 unit of foreign currency
    
    return {
      code: currencyCode,
      name: currency.name,
      symbol: currency.symbol,
      rate: realTimeRate, // Foreign currency per 1 NGN
      inverseRate: inverseRate, // NGN per 1 unit of foreign currency
      lastUpdated: new Date(exchangeRatesCache.lastUpdated).toISOString(),
      isBaseCurrency: false,
      source: exchangeRatesCache.lastUpdated ? 'real-time' : 'fallback',
      cacheAge: exchangeRatesCache.lastUpdated ? 
        Math.round((Date.now() - exchangeRatesCache.lastUpdated) / 60000) : null // minutes
    };
  } catch (error) {
    return {
      code: currencyCode,
      name: currency.name,
      symbol: currency.symbol,
      rate: currency.exchangeRate,
      inverseRate: 1 / currency.exchangeRate,
      lastUpdated: null,
      isBaseCurrency: false,
      source: 'static',
      error: error.message
    };
  }
};

// Get all supported currencies with current exchange rates
export const getAllCurrencyRates = async () => {
  const currencyRates = {};
  
  try {
    // Fetch real-time rates first
    await fetchRealTimeRates();
    
    for (const [code, currency] of Object.entries(SUPPORTED_CURRENCIES)) {
      currencyRates[code] = await getExchangeRateInfo(code);
    }
    
    return {
      baseCurrency: 'NGN',
      lastUpdated: new Date(exchangeRatesCache.lastUpdated).toISOString(),
      source: exchangeRatesCache.lastUpdated ? 'real-time' : 'fallback',
      currencies: currencyRates
    };
  } catch (error) {
    console.error('❌ Error getting all currency rates:', error.message);
    
    // Return static rates as fallback
    for (const [code, currency] of Object.entries(SUPPORTED_CURRENCIES)) {
      currencyRates[code] = {
        code,
        name: currency.name,
        symbol: currency.symbol,
        rate: currency.exchangeRate,
        source: 'static'
      };
    }
    
    return {
      baseCurrency: 'NGN',
      lastUpdated: null,
      source: 'static',
      currencies: currencyRates,
      error: error.message
    };
  }
};

// Date formatting with timezone support
export const formatDate = (date, timezone = 'Africa/Lagos', format = 'DD/MM/YYYY') => {
  const dateObj = new Date(date);
  
  try {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(dateObj);
  } catch (error) {
    return dateObj.toLocaleDateString();
  }
};

// Time formatting with timezone support
export const formatTime = (date, timezone = 'Africa/Lagos', format24h = true) => {
  const dateObj = new Date(date);
  
  try {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: !format24h
    }).format(dateObj);
  } catch (error) {
    return dateObj.toLocaleTimeString();
  }
};

// Get timezone offset
export const getTimezoneOffset = (timezone = 'Africa/Lagos') => {
  const timezoneInfo = SUPPORTED_TIMEZONES[timezone];
  return timezoneInfo ? timezoneInfo.offset : '+01:00';
};

// Get current time in specified timezone
export const getCurrentTime = (timezone = 'Africa/Lagos') => {
  return new Date().toLocaleString('en-NG', { timeZone: timezone });
};

// Popular African currencies for regional support
export const AFRICAN_CURRENCIES = Object.entries(SUPPORTED_CURRENCIES)
  .filter(([_, currency]) => ['NGN', 'ZAR', 'GHS', 'KES', 'EGP'].includes(currency.code))
  .reduce((acc, [code, currency]) => ({ ...acc, [code]: currency }), {});

// Popular global currencies
export const GLOBAL_CURRENCIES = Object.entries(SUPPORTED_CURRENCIES)
  .filter(([_, currency]) => currency.popular)
  .reduce((acc, [code, currency]) => ({ ...acc, [code]: currency }), {});

// Get currency by country code
export const getCurrencyByCountry = (countryCode) => {
  return Object.values(SUPPORTED_CURRENCIES)
    .find(currency => currency.defaultForCountry === countryCode) || SUPPORTED_CURRENCIES.NGN;
};

// Get timezone by country
export const getTimezoneByCountry = (countryCode) => {
  const countryTimezones = {
    'NG': 'Africa/Lagos',
    'ZA': 'Africa/Johannesburg',
    'GH': 'Africa/Accra',
    'KE': 'Africa/Nairobi',
    'EG': 'Africa/Cairo',
    'US': 'America/New_York',
    'GB': 'Europe/London',
    'DE': 'Europe/Berlin',
    'FR': 'Europe/Paris',
    'AU': 'Australia/Sydney',
    'SG': 'Asia/Singapore',
    'AE': 'Asia/Dubai'
  };
  
  return countryTimezones[countryCode] || 'Africa/Lagos';
};

export default {
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
  DEFAULT_PLATFORM_SETTINGS,
  formatCurrency,
  convertCurrency,
  formatDate,
  formatTime,
  getTimezoneOffset,
  getCurrentTime,
  AFRICAN_CURRENCIES,
  GLOBAL_CURRENCIES,
  getCurrencyByCountry,
  getTimezoneByCountry,
  // Real-time currency functions
  fetchRealTimeRates,
  getCurrentExchangeRate,
  getExchangeRateInfo,
  getAllCurrencyRates,
  formatConvertedCurrency
};