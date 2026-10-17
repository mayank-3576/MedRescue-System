import apiClient from './client';

export interface ShopProduct {
  id: number;
  name: string;
  generic_name: string;
  category: string;
  dosage_form: string;
  strength: string;
  manufacturer: string;
  unit_price: number;
  available_quantity: number;
}

export interface PaymentConfig { enabled: boolean; provider: string; currency: string; upi_enabled: boolean; upi_id?: string | null }
export interface ShopOrderInput {
  buyer_phone: string;
  items: { medicine_id: number; quantity: number }[];
}
export interface ShopOrderCreated {
  order_id: string;
  gateway_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  buyer_name: string;
  buyer_email?: string;
  buyer_phone: string;
}
export interface ManualUpiOrderCreated {
  order_id: string;
  amount: number;
  upi_id: string;
  payee_name: string;
  payment_note: string;
}
export interface WithdrawalAccount {
  id: number;
  account_type: 'upi' | 'bank';
  holder_name: string;
  upi_id?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  created_at: string;
}
export interface WithdrawalRequest {
  id: number;
  public_id: string;
  account_id: number | null;
  account_snapshot: Record<string, string>;
  amount: number;
  platform_fee: number;
  net_amount: number;
  status: 'pending' | 'processing' | 'paid' | 'rejected';
  payout_reference?: string | null;
  created_at: string;
  updated_at: string;
}
export interface WalletSummary {
  gross_collected: number;
  available_balance: number;
  reserved_withdrawals: number;
  paid_withdrawals: number;
  platform_fees_collected: number;
  platform_fee_percent: number;
  payment_enabled: boolean;
}
export interface WalletOrder {
  public_id: string;
  buyer_user_id?: number | null;
  buyer_hospital_id?: number | null;
  buyer_hospital_name?: string | null;
  buyer_name: string;
  buyer_email?: string | null;
  buyer_phone: string;
  delivery_address: string;
  payment_method: 'razorpay' | 'upi_manual';
  buyer_payment_reference?: string | null;
  amount: number;
  status: string;
  gateway_payment_id?: string | null;
  created_at: string;
  paid_at?: string | null;
  items: { medicine_name: string; quantity: number; unit_price: number; batch_number: string }[];
}

export const paymentsApi = {
  getShopCatalog: async () => (await apiClient.get<ShopProduct[]>('/shop/medicines')).data,
  getPaymentConfig: async () => (await apiClient.get<PaymentConfig>('/shop/payment-config')).data,
  createShopOrder: async (data: ShopOrderInput) => (await apiClient.post<ShopOrderCreated>('/shop/orders', data)).data,
  createUpiOrder: async (data: ShopOrderInput) => (await apiClient.post<ManualUpiOrderCreated>('/shop/upi-orders', data)).data,
  submitUpiReference: async (orderId: string, payment_reference: string) => (await apiClient.post(`/shop/orders/${orderId}/upi-reference`, { payment_reference })).data,
  verifyPayment: async (orderId: string, data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    (await apiClient.post(`/shop/orders/${orderId}/verify`, data)).data,
  getShopOrderStatus: async (orderId: string) => (await apiClient.get(`/shop/orders/${orderId}`)).data,
  getWalletSummary: async () => (await apiClient.get<WalletSummary>('/wallet/summary')).data,
  getWalletPaymentSettings: async () => (await apiClient.get<{ buyer_collection_upi_id: string | null }>('/wallet/payment-settings')).data,
  updateWalletPaymentSettings: async (buyer_collection_upi_id: string | null) => (await apiClient.put('/wallet/payment-settings', { buyer_collection_upi_id })).data,
  updatePlatformFee: async (percent: number) => (await apiClient.put('/wallet/platform-fee', undefined, { params: { value: percent } })).data,
  listAccounts: async () => (await apiClient.get<WithdrawalAccount[]>('/wallet/accounts')).data,
  addAccount: async (data: Partial<WithdrawalAccount> & { holder_name: string; account_type: 'upi' | 'bank' }) =>
    (await apiClient.post<WithdrawalAccount>('/wallet/accounts', data)).data,
  deleteAccount: async (accountId: number) => apiClient.delete(`/wallet/accounts/${accountId}`),
  createWithdrawal: async (account_id: number, amount: number) =>
    (await apiClient.post<WithdrawalRequest>('/wallet/withdrawals', { account_id, amount })).data,
  listWithdrawals: async () => (await apiClient.get<WithdrawalRequest[]>('/wallet/withdrawals')).data,
  updateWithdrawal: async (id: number, status: 'paid' | 'rejected', payout_reference?: string) =>
    (await apiClient.post<WithdrawalRequest>(`/wallet/withdrawals/${id}/status`, { status, payout_reference })).data,
  listOrders: async () => (await apiClient.get<WalletOrder[]>('/wallet/orders')).data,
  reviewUpiPayment: async (orderId: string, status: 'paid' | 'rejected') => (await apiClient.post(`/wallet/orders/${orderId}/upi-payment`, { status })).data,
};
