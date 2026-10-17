import React, { useEffect, useMemo, useState } from 'react';
import { BadgeIndianRupee, Building2, Check, CircleDollarSign, CreditCard, Landmark, Plus, RefreshCw, Trash2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import StatCard from '../../components/common/StatCard';
import { paymentsApi, WalletOrder, WalletSummary, WithdrawalAccount, WithdrawalRequest } from '../../api/payments';

const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);

export const WalletPage: React.FC = () => {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [accounts, setAccounts] = useState<WithdrawalAccount[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [orders, setOrders] = useState<WalletOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountType, setAccountType] = useState<'upi' | 'bank'>('upi');
  const [feePercent, setFeePercent] = useState('2');
  const [feeSaving, setFeeSaving] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAccountId, setWithdrawAccountId] = useState('');
  const [newAccount, setNewAccount] = useState({ holder_name: '', upi_id: '', bank_name: '', account_number: '', ifsc_code: '' });
  const [collectionUpi, setCollectionUpi] = useState('');
  const [savingCollectionUpi, setSavingCollectionUpi] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [wallet, payoutAccounts, payoutRequests, purchases, paymentSettings] = await Promise.all([
        paymentsApi.getWalletSummary(), paymentsApi.listAccounts(), paymentsApi.listWithdrawals(), paymentsApi.listOrders(), paymentsApi.getWalletPaymentSettings(),
      ]);
      setSummary(wallet);
      setAccounts(payoutAccounts);
      setWithdrawals(payoutRequests);
      setOrders(purchases);
      setCollectionUpi(paymentSettings.buyer_collection_upi_id || '');
      setFeePercent(String(wallet.platform_fee_percent));
      setWithdrawAccountId((current) => current || String(payoutAccounts[0]?.id || ''));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Wallet could not be loaded');
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const amountValue = Number(withdrawAmount) || 0;
  const previewFee = useMemo(() => Math.round(amountValue * (Number(feePercent) || 0)) / 100, [amountValue, feePercent]);
  const previewNet = Math.max(0, amountValue - previewFee);

  const addAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingAccount(true);
    try {
      const account = await paymentsApi.addAccount({ account_type: accountType, holder_name: newAccount.holder_name, ...(accountType === 'upi' ? { upi_id: newAccount.upi_id } : { bank_name: newAccount.bank_name, account_number: newAccount.account_number, ifsc_code: newAccount.ifsc_code }) });
      setAccounts((current) => [account, ...current]);
      setWithdrawAccountId(String(account.id));
      setNewAccount({ holder_name: '', upi_id: '', bank_name: '', account_number: '', ifsc_code: '' });
      toast.success('Withdrawal account added');
    } catch (error: any) { toast.error(error.response?.data?.detail || 'Could not save account details'); }
    finally { setSavingAccount(false); }
  };

  const removeAccount = async (id: number) => {
    try {
      await paymentsApi.deleteAccount(id);
      setAccounts((current) => current.filter((account) => account.id !== id));
      if (withdrawAccountId === String(id)) setWithdrawAccountId('');
      toast.success('Account removed');
    } catch (error: any) { toast.error(error.response?.data?.detail || 'Could not remove account'); }
  };

  const saveFee = async () => {
    const value = Number(feePercent);
    if (!Number.isFinite(value) || value < 0 || value > 100) { toast.error('Fee must be between 0% and 100%'); return; }
    setFeeSaving(true);
    try { await paymentsApi.updatePlatformFee(value); await refresh(); toast.success('Platform charge updated'); }
    catch (error: any) { toast.error(error.response?.data?.detail || 'Could not update fee'); }
    finally { setFeeSaving(false); }
  };

  const saveCollectionUpi = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCollectionUpi(true);
    try {
      const result = await paymentsApi.updateWalletPaymentSettings(collectionUpi.trim() || null);
      setCollectionUpi(result.buyer_collection_upi_id || '');
      toast.success(result.buyer_collection_upi_id ? 'Buyer payment UPI ID saved' : 'Buyer UPI checkout disabled');
    } catch (error: any) { toast.error(error.response?.data?.detail || 'Could not save buyer payment UPI ID'); }
    finally { setSavingCollectionUpi(false); }
  };

  const reviewUpiPayment = async (order: WalletOrder, status: 'paid' | 'rejected') => {
    const prompt = status === 'paid'
      ? `Confirm the received bank/UPI transaction matches UTR ${order.buyer_payment_reference} and amount ${money(order.amount)}?`
      : `Reject the payment reference ${order.buyer_payment_reference}? Use this only after checking that the transfer was not received.`;
    if (!window.confirm(prompt)) return;
    try {
      const result = await paymentsApi.reviewUpiPayment(order.public_id, status);
      if (status === 'paid' && result.status === 'refund_required') toast.error('Payment was received but stock could not be confirmed. Refund handling is required.');
      else toast.success(status === 'paid' ? 'UPI payment verified and wallet credited' : 'UPI payment rejected');
      await refresh();
    } catch (error: any) { toast.error(error.response?.data?.detail || 'Could not review UPI payment'); }
  };

  const createWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await paymentsApi.createWithdrawal(Number(withdrawAccountId), amountValue);
      setWithdrawAmount('');
      toast.success('Withdrawal request created. Transfer the net amount and record the reference to complete it.');
      await refresh();
    } catch (error: any) { toast.error(error.response?.data?.detail || 'Could not create withdrawal'); }
  };

  const processWithdrawal = async (withdrawal: WithdrawalRequest, status: 'paid' | 'rejected') => {
    const payoutReference = status === 'paid' ? window.prompt(`After sending ${money(withdrawal.net_amount)}, enter the UPI / bank transfer reference:`) : undefined;
    if (status === 'paid' && !payoutReference?.trim()) return;
    try {
      await paymentsApi.updateWithdrawal(withdrawal.id, status, payoutReference || undefined);
      toast.success(status === 'paid' ? 'Withdrawal marked paid' : 'Withdrawal rejected');
      await refresh();
    } catch (error: any) { toast.error(error.response?.data?.detail || 'Could not update withdrawal'); }
  };

  if (loading && !summary) return <AnimatedPage><div className="rounded-xl border border-slate-100 bg-white p-8 text-sm text-slate-500">Loading wallet…</div></AnimatedPage>;

  return <AnimatedPage>
    <PageHeader title="Payments & Wallet" subtitle="Track buyer payments, configure payout details and withdraw the available balance." actions={<button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Refresh</button>} />

    {summary && <>
      {!summary.payment_enabled && !collectionUpi && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Buyer checkout is disabled.</strong> Set the receiving UPI ID below or configure Razorpay keys and webhook secret in <code>backend/.env</code>.</div>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Available to withdraw" value={money(summary.available_balance)} icon={Wallet} color="teal" subtitle="After pending requests" />
        <StatCard title="Payments collected" value={money(summary.gross_collected)} icon={CreditCard} color="blue" subtitle="Captured payments" />
        <StatCard title="Pending withdrawals" value={money(summary.reserved_withdrawals)} icon={CircleDollarSign} color="amber" subtitle="Balance reserved" />
        <StatCard title="Platform fees earned" value={money(summary.platform_fees_collected)} icon={BadgeIndianRupee} color="emerald" subtitle="Paid withdrawals" />
      </div>
    </>}

    <div className="mb-6"><Card title="Buyer payment collection" subtitle="Set the UPI ID that authorized hospital staff will pay when buying medicine.">
      <form onSubmit={saveCollectionUpi} className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Receiving UPI ID</span><input value={collectionUpi} onChange={(event) => setCollectionUpi(event.target.value)} placeholder="medrescue@bank" className="w-full max-w-xl rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500" /></label>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-500">Buyers transfer directly to this UPI ID and submit the UTR. Check the actual bank/UPI transaction before approving it below. Orders hold stock for 30 minutes while awaiting payment details.</p>
        <button disabled={savingCollectionUpi} className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{savingCollectionUpi ? 'Saving…' : 'Save buyer payment UPI'}</button>
      </form>
    </Card></div>

    <div className="mb-6 grid gap-6 xl:grid-cols-2">
      <Card title={<span className="flex items-center gap-2"><Landmark className="h-4 w-4 text-teal-700" />Withdrawal destinations</span>} subtitle="Add a UPI ID or bank account for admin payouts.">
        <div className="mb-4 space-y-2">{accounts.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No payout destination saved yet.</p> : accounts.map((account) => <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
          <div className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-slate-100 p-2 text-slate-600">{account.account_type === 'upi' ? <CreditCard className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{account.holder_name}</p><p className="truncate text-xs text-slate-500">{account.account_type === 'upi' ? account.upi_id : `${account.bank_name} · A/C ${account.account_number} · ${account.ifsc_code}`}</p></div></div>
          <button onClick={() => void removeAccount(account.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove account"><Trash2 className="h-4 w-4" /></button>
        </div>)}</div>
        <form onSubmit={addAccount} className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex gap-2"><button type="button" onClick={() => setAccountType('upi')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${accountType === 'upi' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>UPI</button><button type="button" onClick={() => setAccountType('bank')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${accountType === 'bank' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Bank account</button></div>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Account holder name</span><input required minLength={2} value={newAccount.holder_name} onChange={(e) => setNewAccount({ ...newAccount, holder_name: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
          {accountType === 'upi' ? <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">UPI ID</span><input required value={newAccount.upi_id} onChange={(e) => setNewAccount({ ...newAccount, upi_id: e.target.value })} placeholder="name@upi" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label> : <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Bank name</span><input required value={newAccount.bank_name} onChange={(e) => setNewAccount({ ...newAccount, bank_name: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">IFSC</span><input required value={newAccount.ifsc_code} onChange={(e) => setNewAccount({ ...newAccount, ifsc_code: e.target.value.toUpperCase() })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-teal-500" /></label><label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-slate-600">Account number</span><input required inputMode="numeric" value={newAccount.account_number} onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label></div>}
          <button disabled={savingAccount} className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-50"><Plus className="h-4 w-4" />{savingAccount ? 'Saving…' : 'Save payout destination'}</button>
        </form>
      </Card>

      <div className="space-y-6">
        <Card title="Withdraw funds" subtitle="The requested gross amount is reserved; the platform charge is deducted from the payout.">
          <form onSubmit={createWithdrawal} className="space-y-4">
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Send to</span><select required value={withdrawAccountId} onChange={(e) => setWithdrawAccountId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"><option value="">Choose a saved UPI / bank account</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.holder_name} — {account.account_type === 'upi' ? account.upi_id : `${account.bank_name} ${account.account_number}`}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Gross withdrawal amount (INR)</span><input required type="number" min="0.01" max={summary?.available_balance || 0} step="0.01" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="0.00" /></label>
            <div className="rounded-xl bg-slate-50 p-4 text-sm"><div className="flex justify-between text-slate-500"><span>Platform charge ({feePercent}%)</span><span>{money(previewFee)}</span></div><div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900"><span>Net payout</span><span>{money(previewNet)}</span></div></div>
            <button disabled={!summary || accounts.length === 0 || amountValue <= 0 || amountValue > summary.available_balance} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"><Wallet className="h-4 w-4" />Create withdrawal request</button>
          </form>
        </Card>
        <Card title="Platform charge" subtitle="Applied to each withdrawal; change the percentage at any time.">
          <div className="flex items-end gap-3"><label className="block flex-1"><span className="mb-1 block text-xs font-medium text-slate-600">Charge percentage</span><div className="relative"><input type="number" min="0" max="100" step="0.01" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-9 text-sm outline-none focus:border-teal-500" /><span className="absolute right-3 top-2.5 text-sm text-slate-400">%</span></div></label><button onClick={() => void saveFee()} disabled={feeSaving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Check className="h-4 w-4" />Save</button></div>
        </Card>
      </div>
    </div>

    <Card title="Withdrawal history" subtitle="Manually send the net payout from your bank/UPI app, then mark it paid with the transfer reference.">
      {withdrawals.length === 0 ? <p className="text-sm text-slate-500">No withdrawals yet.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr><th className="pb-3 pr-4">Date</th><th className="pb-3 pr-4">Destination</th><th className="pb-3 pr-4">Gross</th><th className="pb-3 pr-4">Fee</th><th className="pb-3 pr-4">Payout</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{withdrawals.map((withdrawal) => <tr key={withdrawal.id}><td className="py-3 pr-4 text-slate-500">{new Date(withdrawal.created_at).toLocaleDateString()}</td><td className="py-3 pr-4"><div className="font-medium">{withdrawal.account_snapshot.holder_name}</div><div className="max-w-56 truncate text-xs text-slate-500">{withdrawal.account_snapshot.upi_id || `${withdrawal.account_snapshot.bank_name} ${withdrawal.account_snapshot.account_number}`}</div></td><td className="py-3 pr-4">{money(withdrawal.amount)}</td><td className="py-3 pr-4 text-amber-700">{money(withdrawal.platform_fee)}</td><td className="py-3 pr-4 font-semibold">{money(withdrawal.net_amount)}</td><td className="py-3 pr-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${withdrawal.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : withdrawal.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{withdrawal.status}</span>{withdrawal.payout_reference && <div className="mt-1 text-[11px] text-slate-400">Ref: {withdrawal.payout_reference}</div>}</td><td className="py-3">{withdrawal.status === 'pending' && <div className="flex gap-2"><button onClick={() => void processWithdrawal(withdrawal, 'paid')} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">Mark paid</button><button onClick={() => void processWithdrawal(withdrawal, 'rejected')} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700">Reject</button></div>}</td></tr>)}</tbody></table></div>}
    </Card>

      <div className="mt-6"><Card title="Medicine payments" subtitle="Razorpay captures and UPI references awaiting admin verification.">
      {orders.length === 0 ? <p className="text-sm text-slate-500">No buyer payments have been recorded.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr><th className="pb-3 pr-4">Order</th><th className="pb-3 pr-4">Authorized buyer / facility</th><th className="pb-3 pr-4">Items</th><th className="pb-3 pr-4">Amount</th><th className="pb-3 pr-4">Payment / UTR</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Date</th><th className="pb-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{orders.map((order) => <tr key={order.public_id}><td className="py-3 pr-4 font-mono text-xs text-slate-500">{order.public_id.slice(0, 12)}</td><td className="max-w-64 py-3 pr-4"><div className="font-medium text-slate-800">{order.buyer_name} · {order.buyer_phone}</div><div className="text-xs font-medium text-teal-700">{order.buyer_hospital_name || 'Facility unavailable'}</div><div className="text-xs text-slate-500">{order.delivery_address}</div></td><td className="py-3 pr-4 text-xs text-slate-600">{order.items.map((item) => `${item.medicine_name} × ${item.quantity}`).join(', ')}</td><td className="py-3 pr-4 font-semibold">{money(order.amount)}</td><td className="py-3 pr-4 text-xs"><div className="font-medium">{order.payment_method === 'upi_manual' ? 'Manual UPI' : 'Razorpay'}</div><div className="font-mono text-slate-500">{order.buyer_payment_reference || order.gateway_payment_id || '—'}</div></td><td className="py-3 pr-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${order.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : order.status === 'refund_required' || order.status === 'payment_rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{order.status}</span></td><td className="py-3 pr-4 text-slate-500">{new Date(order.created_at).toLocaleString()}</td><td className="py-3">{order.payment_method === 'upi_manual' && order.status === 'payment_submitted' && <div className="flex flex-col gap-1.5"><button onClick={() => void reviewUpiPayment(order, 'paid')} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">Verify &amp; credit</button><button onClick={() => void reviewUpiPayment(order, 'rejected')} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700">Reject</button></div>}</td></tr>)}</tbody></table></div>}
    </Card></div>
  </AnimatedPage>;
};

export default WalletPage;
