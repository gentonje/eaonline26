import { supabase } from './supabase';

// Always use same-origin — Express serves on port 5000 in all environments
// and proxies non-API traffic to Expo Metro in dev
const API_BASE = typeof window !== 'undefined'
  ? window.location.origin
  : 'http://localhost:5000';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function apiCall(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

export const mpesaApi = {
  initiateSTKPush: (data: {
    phone: string;
    amount: number;
    userId: string;
    orderId?: number;
    type: 'payment' | 'deposit';
  }) => apiCall('/api/mpesa/stk-push', { method: 'POST', body: JSON.stringify(data) }),

  checkPaymentStatus: (paymentId: number) =>
    apiCall(`/api/payments/${paymentId}/status`),

  simulateCallback: (paymentId: number, success: boolean = true) =>
    apiCall('/api/mpesa/simulate-callback', {
      method: 'POST',
      body: JSON.stringify({ paymentId, success })
    }),
};

export const walletApi = {
  getWallet: (userId: string) => apiCall(`/api/wallet/${userId}`),

  getTransactions: (userId: string) => apiCall(`/api/wallet/${userId}/transactions`),

  payWithWallet: (data: {
    userId: string;
    orderId: number;
    amount: number;
    discount?: number;
  }) => apiCall('/api/wallet/pay', { method: 'POST', body: JSON.stringify(data) }),
};

export const paymentsApi = {
  getUserPayments: (userId: string) => apiCall(`/api/payments/user/${userId}`),
};

export interface AnalyzedProduct {
  title: string;
  description: string;
  category: string;
  price_usd: number;
  available_quantity: number;
  confidence: number;
}

export interface OptimizedListing {
  title: string;
  description: string;
  keywords: string[];
  optimized: boolean;
}

export const aiApi = {
  analyzeImage: (imageBase64: string, mimeType: string = 'image/jpeg'): Promise<AnalyzedProduct> =>
    apiCall('/api/ai/analyze-image', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mimeType }),
    }),

  // Rewrites title/description for East Africa SEO. Always returns something
  // safe (originals on failure) so callers can use it inline before saving.
  optimizeListing: async (input: {
    title: string;
    description: string;
    category?: string;
    country?: string;
    county?: string;
  }): Promise<OptimizedListing> => {
    try {
      return await apiCall('/api/ai/optimize-listing', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    } catch {
      return {
        title: input.title || '',
        description: input.description || '',
        keywords: [],
        optimized: false,
      };
    }
  },
};

export interface AssistantProduct {
  id: string;
  title: string;
  price: number;
  category?: string;
  county?: string;
  countries?: { code?: string; currency?: string; name?: string };
  product_images?: Array<{ storage_path: string; is_main?: boolean }>;
}

export interface AssistantReply {
  reply: string;
  products: AssistantProduct[];
  filters?: Record<string, unknown>;
  result_count?: number;
  summary?: string | null;
  suggestions?: Array<{ label: string; description: string; value: string }>;
}

export const assistantApi = {
  chat: (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    country_code?: string,
    selected_suggestion?: string,
    original_message?: string,
  ): Promise<AssistantReply> => {
    const latest = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    return apiCall('/api/ai/assistant', {
      method: 'POST',
      body: JSON.stringify({ message: latest, country_code, selected_suggestion, original_message }),
    });
  },
};

export interface QualityScanItem {
  id: string;
  title: string;
  flag: 'blurry' | 'harmful' | null;
  reason: string | null;
}
export interface QualityScanResult {
  ok: boolean;
  scanned: number;
  flagged_blurry: number;
  flagged_harmful: number;
  errors: number;
  items: QualityScanItem[];
  error?: string;
}

export const adminApi = {
  // Manually run the quality + safety scan. Admin / superadmin only.
  runQualityScan: (limit = 25): Promise<QualityScanResult> =>
    apiCall('/api/admin/quality-scan', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    }),
};

const WALLET_DISCOUNT_PERCENT = 5;

export function calculateWalletDiscount(amount: number): number {
  return Math.round(amount * WALLET_DISCOUNT_PERCENT / 100);
}

export { WALLET_DISCOUNT_PERCENT };
