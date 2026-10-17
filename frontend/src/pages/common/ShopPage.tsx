import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy, Cross, ExternalLink, LoaderCircle, Minus, Plus, Search, ShoppingBag, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ManualUpiOrderCreated, paymentsApi, PaymentConfig, ShopProduct } from '../../api/payments';
import { useAuth } from '../../hooks/useAuth';
import { BrandLogoMark } from '../../components/common/BrandLogoMark';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const rupees = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export const ShopPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paidOrder, setPaidOrder] = useState<string | null>(null);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'upi_manual'>('razorpay');
  const [manualUpiOrder, setManualUpiOrder] = useState<ManualUpiOrderCreated | null>(null);
  const [upiReference, setUpiReference] = useState('');
  const [upiReferenceSubmitted, setUpiReferenceSubmitted] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [catalog, paymentConfig] = await Promise.all([paymentsApi.getShopCatalog(), paymentsApi.getPaymentConfig()]);
      setProducts(catalog);
      setConfig(paymentConfig);
      setPaymentMethod(paymentConfig.upi_enabled ? 'upi_manual' : 'razorpay');
      setCatalogError(null);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Medicine catalog could not be loaded';
      setCatalogError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => products.filter((product) =>
    `${product.name} ${product.generic_name} ${product.category} ${product.manufacturer}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const cartProducts = products.filter((product) => (cart[product.id] || 0) > 0);
  const total = cartProducts.reduce((sum, product) => sum + product.unit_price * cart[product.id], 0);

  const setQuantity = (product: ShopProduct, quantity: number) => {
    setCart((previous) => {
      const next = { ...previous };
      if (quantity <= 0) delete next[product.id];
      else next[product.id] = Math.min(product.available_quantity, 20, quantity);
      return next;
    });
  };

  const loadRazorpay = async () => {
    if (window.Razorpay) return true;
    const existing = document.getElementById('razorpay-checkout-script') as HTMLScriptElement | null;
    const script = existing || document.createElement('script');
    if (!existing) {
      script.id = 'razorpay-checkout-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
    return new Promise<boolean>((resolve) => {
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => resolve(false);
    });
  };

  const checkout = async (event: React.FormEvent) => {
    event.preventDefault();
    const methodEnabled = paymentMethod === 'upi_manual' ? config?.upi_enabled : config?.enabled;
    if (!methodEnabled || cartProducts.length === 0) return;
    setSubmitting(true);
    try {
      const orderInput = {
        buyer_phone: buyerPhone,
        items: cartProducts.map((product) => ({ medicine_id: product.id, quantity: cart[product.id] })),
      };
      if (paymentMethod === 'upi_manual') {
        const order = await paymentsApi.createUpiOrder(orderInput);
        setManualUpiOrder(order);
        setSubmitting(false);
        return;
      }
      const order = await paymentsApi.createShopOrder(orderInput);
      const scriptReady = await loadRazorpay();
      if (!scriptReady || !window.Razorpay) throw new Error('Secure checkout could not be loaded. Please retry.');
      const checkoutWindow = new window.Razorpay({
        key: order.key_id,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: 'MedRescue Pharmacy',
        description: `Medicine order ${order.order_id.slice(0, 8)}`,
        order_id: order.gateway_order_id,
        prefill: { name: order.buyer_name, email: order.buyer_email, contact: order.buyer_phone },
        notes: { order_reference: order.order_id },
        theme: { color: '#0d9488' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const result = await paymentsApi.verifyPayment(order.order_id, response);
            if (result.status === 'paid') {
              setPaidOrder(order.order_id);
              setCart({});
              toast.success('Payment received and order confirmed');
              void load();
            } else {
              toast.error(`Payment status: ${result.status}`);
            }
          } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Payment needs verification. Save your order reference: ' + order.order_id);
          } finally {
            setSubmitting(false);
          }
        },
        modal: { ondismiss: () => setSubmitting(false) },
      });
      checkoutWindow.open();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.message || 'Could not start checkout');
      setSubmitting(false);
    }
  };

  const submitUpiReference = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manualUpiOrder || !upiReference.trim()) return;
    setSubmitting(true);
    try {
      await paymentsApi.submitUpiReference(manualUpiOrder.order_id, upiReference);
      setUpiReferenceSubmitted(true);
      toast.success('UPI reference sent. Admin will verify the payment.');
      void load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not submit UPI transaction reference');
    } finally { setSubmitting(false); }
  };

  const paymentLink = manualUpiOrder ? `upi://pay?${new URLSearchParams({
    pa: manualUpiOrder.upi_id,
    pn: manualUpiOrder.payee_name,
    am: manualUpiOrder.amount.toFixed(2),
    cu: 'INR',
    tn: manualUpiOrder.payment_note,
  }).toString()}` : '';

  if (paidOrder) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Payment confirmed</h1>
          <p className="mt-2 text-sm text-slate-500">Your order has been recorded. Keep this reference for support.</p>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 font-mono text-sm text-slate-700">{paidOrder}</p>
          <button onClick={() => setPaidOrder(null)} className="mt-5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Continue shopping</button>
        </div>
      </main>
    );
  }

  if (!user?.hospital_id) {
    return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm"><Cross className="mx-auto h-12 w-12 text-amber-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Hospital assignment required</h1><p className="mt-2 text-sm text-slate-500">An administrator must assign your active staff account to a hospital before you can buy medicines.</p><Link to="/staff/dashboard" className="mt-5 inline-flex rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">Return to staff portal</Link></div></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/staff/dashboard" className="flex items-center gap-3 text-slate-900">
            <BrandLogoMark className="h-10 w-10 rounded-xl border border-slate-100" />
            <span><span className="block font-bold">MedRescue Pharmacy</span><span className="text-xs text-slate-500">Available medicine catalog</span></span>
          </Link>
          <div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-sm font-semibold text-slate-700">{user?.full_name}</span><span className="block text-xs text-slate-500">{user?.hospital_name || 'Hospital staff'}</span></span><Link to="/staff/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-teal-700"><ArrowLeft className="h-4 w-4" />Portal</Link><button onClick={() => void logout()} className="text-xs font-medium text-slate-500 hover:text-rose-600">Sign out</button></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Authorized facility ordering</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Buy medicines for your hospital</h1><p className="mt-2 text-sm text-slate-500">Signed in as {user?.full_name}; catalog and stock are limited to {user?.hospital_name || 'your assigned facility'}. Pay using UPI or Razorpay.</p></div>
          <label className="relative block w-full sm:w-80"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" placeholder="Search medicine or category" /></label>
        </div>

        {config && !config.enabled && !config.upi_enabled && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Checkout setup needed.</strong> Ask an administrator to add the receiving UPI ID in Admin â†’ Payments &amp; Wallet, or configure Razorpay keys in <code>backend/.env</code>. The store will not mark an unpaid order as paid.</div>}
        {catalogError && <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{catalogError}</div>}

        <div className="grid gap-6 lg:grid-cols-[1fr_370px]">
          <section>
            {loading ? <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Loading medicine catalog…</div> : filtered.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">No in-stock medicines match this search.</div> :
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((product) => <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2"><span className="rounded-lg bg-teal-50 p-2 text-teal-700"><Cross className="h-4 w-4" /></span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{product.available_quantity} in stock</span></div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{product.category}</p><h2 className="mt-1 font-semibold text-slate-900">{product.name}</h2><p className="mt-1 text-xs text-slate-500">{product.strength} · {product.dosage_form}</p><p className="mt-2 text-xs text-slate-400">{product.generic_name} · {product.manufacturer}</p>
                <div className="mt-5 flex items-center justify-between"><span className="text-lg font-bold text-slate-900">{rupees(product.unit_price)}<span className="ml-1 text-xs font-normal text-slate-400">/ unit</span></span><button onClick={() => setQuantity(product, (cart[product.id] || 0) + 1)} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700"><Plus className="h-3.5 w-3.5" />Add</button></div>
              </article>)}</div>}
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><ShoppingBag className="h-4 w-4 text-teal-700" />Your order</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{cartProducts.reduce((sum, item) => sum + cart[item.id], 0)}</span></div>
            {cartProducts.length === 0 ? <div className="p-6 text-center text-sm text-slate-400">Add medicine to start an order.</div> : <>
              <div className="max-h-56 space-y-3 overflow-auto p-5">{cartProducts.map((product) => <div key={product.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{product.name}</p><p className="text-xs text-slate-500">{rupees(product.unit_price)} each</p></div><div className="flex shrink-0 items-center gap-2"><button onClick={() => setQuantity(product, cart[product.id] - 1)} className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50" aria-label="Decrease quantity"><Minus className="h-3 w-3" /></button><span className="w-5 text-center text-sm">{cart[product.id]}</span><button onClick={() => setQuantity(product, cart[product.id] + 1)} disabled={cart[product.id] >= product.available_quantity || cart[product.id] >= 20} className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40" aria-label="Increase quantity"><Plus className="h-3 w-3" /></button><button onClick={() => setQuantity(product, 0)} className="ml-1 text-slate-400 hover:text-rose-600" aria-label="Remove item"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
              <form onSubmit={manualUpiOrder && !upiReferenceSubmitted ? submitUpiReference : checkout} className="space-y-3 border-t border-slate-100 p-5">
                <div className="rounded-xl bg-teal-50 p-3"><p className="text-xs font-semibold text-teal-900">Authorized buyer</p><p className="mt-1 text-sm font-medium text-teal-900">{user?.full_name}</p><p className="text-xs text-teal-800">{user?.email} · {user?.hospital_name}</p><p className="mt-2 text-[11px] text-teal-700">Order and delivery address are recorded against your assigned hospital.</p></div>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Contact phone for this order</span><input required inputMode="tel" pattern="[0-9+ ()-]{10,16}" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm"><span className="text-slate-500">Total</span><span className="text-lg font-bold text-slate-900">{rupees(total)}</span></div>
                {!manualUpiOrder && <>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={!config?.upi_enabled} onClick={() => setPaymentMethod('upi_manual')} className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${paymentMethod === 'upi_manual' ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}>UPI transfer</button>
                    <button type="button" disabled={!config?.enabled} onClick={() => setPaymentMethod('razorpay')} className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${paymentMethod === 'razorpay' ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}>Razorpay</button>
                  </div>
                  <button disabled={!(paymentMethod === 'upi_manual' ? config?.upi_enabled : config?.enabled) || submitting || cartProducts.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{submitting ? 'Starting payment…' : paymentMethod === 'upi_manual' ? 'Continue to UPI payment' : 'Pay securely'}</button>
                  <p className="text-center text-[11px] leading-relaxed text-slate-400">UPI payments enter the wallet after an admin verifies the UTR. Razorpay payments are credited after provider confirmation.</p>
                </>}
                {manualUpiOrder && !upiReferenceSubmitted && <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
                  <div><p className="text-sm font-semibold text-teal-950">Pay exactly {rupees(manualUpiOrder.amount)} using UPI</p><p className="mt-1 text-xs text-teal-800">Complete the transfer within 30 minutes. Use the payment note below so the admin can match it.</p></div>
                  <a href={paymentLink} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"><ExternalLink className="h-4 w-4" />Open UPI app</a>
                  <div className="rounded-lg bg-white p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="text-slate-500">Pay to</span><button type="button" onClick={() => { void navigator.clipboard?.writeText(manualUpiOrder.upi_id); toast.success('UPI ID copied'); }} className="inline-flex items-center gap-1 text-teal-700"><Copy className="h-3 w-3" />Copy</button></div><p className="font-semibold text-slate-900">{manualUpiOrder.upi_id}</p><p className="mt-2 text-slate-500">Payment note</p><p className="font-mono font-semibold text-slate-800">{manualUpiOrder.payment_note}</p></div>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-700">UPI transaction reference / UTR</span><input required minLength={8} maxLength={64} value={upiReference} onChange={(e) => setUpiReference(e.target.value.toUpperCase())} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-teal-500" placeholder="Enter reference after paying" /></label>
                  <button disabled={submitting || upiReference.trim().length < 8} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}I have paid — submit reference</button>
                </div>}
                {manualUpiOrder && upiReferenceSubmitted && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold text-amber-900">Payment reference submitted</p><p className="mt-1 text-xs text-amber-800">Order <span className="font-mono">{manualUpiOrder.order_id.slice(0, 12)}</span> will be confirmed after the admin verifies your transfer.</p></div>}
              </form>
            </>}
          </aside>
        </div>
      </div>
    </main>
  );
};

export default ShopPage;
