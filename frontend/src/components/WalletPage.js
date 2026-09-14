import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, Plus, Minus, RefreshCw, X, Wallet as WalletIcon, Lock, LockOpen,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getErrorMessage } from '../utils/network';
import { useConnection } from '../context/ConnectionContext';
import PaymentModal from './PaymentModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const PAGE_SIZE = 20;
const METHODS = [
  { value: 'paymongo', label: 'Card (PayMongo)', type: 'external' },
  { value: 'qrph', label: 'QRPH', type: 'demo' },
  { value: 'gcash', label: 'GCash', type: 'demo' },
  { value: 'maya', label: 'Maya', type: 'demo' },
];
const PRESETS = [100, 200, 500, 1000];

const formatPHP = (minor) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((minor || 0) / 100);

const formatDateTime = (date) => {
  try {
    return new Date(date).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const newIdempotencyKey = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function WalletPage({ googleUser, onBack }) {
  const { reconnectTick } = useConnection();
  const [balance, setBalance] = useState(null);
  const [currency, setCurrency] = useState('PHP');
  const [withdrawablePercent, setWithdrawablePercent] = useState(80);
  const [withdrawableMinor, setWithdrawableMinor] = useState(0);
  const [txs, setTxs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showPayMongo, setShowPayMongo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [depAmount, setDepAmount] = useState('');
  const [depMethod, setDepMethod] = useState('qrph');
  const [depVoucherCode, setDepVoucherCode] = useState('');
  const [wdAmount, setWdAmount] = useState('');
  const [wdMethod, setWdMethod] = useState('qrph');
  const [wdName, setWdName] = useState('');
  const [wdNumber, setWdNumber] = useState('');

  const loadAll = async (pageToLoad = page, type = typeFilter, status = statusFilter) => {
    if (!googleUser?.id) return;
    setLoading(true);
    setError('');
    try {
      const [balRes, txRes] = await Promise.all([
        axios.get(`${API_URL}/wallet?userId=${googleUser.id}`),
        axios.get(`${API_URL}/wallet/transactions`, {
          params: {
            userId: googleUser.id,
            type: type === 'all' ? undefined : type,
            status: status === 'all' ? undefined : status,
            page: pageToLoad,
            limit: PAGE_SIZE,
          },
        }),
      ]);
      setBalance(balRes.data.balance);
      setCurrency(balRes.data.currency || 'PHP');
      if (typeof balRes.data.withdrawablePercent === 'number') setWithdrawablePercent(balRes.data.withdrawablePercent);
      if (typeof balRes.data.withdrawableMinor === 'number') setWithdrawableMinor(balRes.data.withdrawableMinor);
      setTxs(txRes.data.items || []);
      setTotal(txRes.data.total || 0);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load wallet'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line
  }, [googleUser, reconnectTick]);

  const applyFilter = (type, status) => {
    setTypeFilter(type);
    setStatusFilter(status);
    setPage(1);
    loadAll(1, type, status);
  };

  const changePage = (next) => {
    setPage(next);
    loadAll(next);
  };

  const pesosToCentavos = (value) => {
    const n = parseFloat(String(value).replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
  };

  const refreshAfterSubmit = () => {
    loadAll(page);
    // Demo provider settles async (deposits ~2s, withdrawals ~5s) — re-check
    setTimeout(() => loadAll(page), 3000);
    setTimeout(() => loadAll(page), 7000);
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    setFormError('');
    const amountMinor = pesosToCentavos(depAmount);
    if (amountMinor === null) {
      setFormError('Enter a valid amount');
      return;
    }

    // If PayMongo is selected, show PayMongo modal instead
    if (depMethod === 'paymongo') {
      setShowDeposit(false);
      setShowPayMongo(true);
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/wallet/deposit`, {
        userId: googleUser.id,
        amountMinor,
        method: depMethod,
        idempotencyKey: newIdempotencyKey(),
        voucherCode: depVoucherCode.trim() || undefined,
      });
      setShowDeposit(false);
      setDepAmount('');
      setDepVoucherCode('');
      refreshAfterSubmit();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Deposit failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setFormError('');
    const amountMinor = pesosToCentavos(wdAmount);
    if (amountMinor === null) {
      setFormError('Enter a valid amount');
      return;
    }
    if (!wdName.trim() || !wdNumber.trim()) {
      setFormError('Account name and number are required');
      return;
    }
    if (amountMinor > withdrawableMinor) {
      setFormError(`Amount exceeds your withdrawable limit of ${formatPHP(withdrawableMinor)} (${withdrawablePercent}% of your balance)`);
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/wallet/withdraw`, {
        userId: googleUser.id,
        amountMinor,
        method: wdMethod,
        accountName: wdName.trim(),
        accountNumber: wdNumber.trim(),
        idempotencyKey: newIdempotencyKey(),
      });
      setShowWithdraw(false);
      setWdAmount('');
      setWdName('');
      setWdNumber('');
      refreshAfterSubmit();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Withdrawal failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status) => (
    <span className={cn(
      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
      status === 'completed' && "bg-green-100 text-green-700",
      status === 'pending' && "bg-amber-100 text-amber-700",
      (status === 'failed' || status === 'cancelled') && "bg-red-100 text-red-600"
    )}>
      {status}
    </span>
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Nav + page numbers + count. Rendered above AND below so users can jump pages
  // without scrolling through every record.
  const PaginationBar = () => {
    if (totalPages <= 1) return null;
    const shownFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const shownTo = Math.min(page * PAGE_SIZE, total);
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    const pages = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return (
      <div className="flex items-center justify-between gap-2 flex-wrap mt-4">
        <p className="text-xs text-navy/50">Showing {shownFrom}–{shownTo} of {total}</p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
            className="h-8 px-2"
          >
            Prev
          </Button>
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => changePage(p)}
              className={cn(
                "w-8 h-8 rounded-lg text-xs font-medium border transition-colors",
                p === page
                  ? "bg-coral text-white border-coral"
                  : "border-navy/20 text-navy/60 hover:border-coral hover:bg-coral/5"
              )}
            >
              {p}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => changePage(page + 1)}
            className="h-8 px-2"
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="bg-white/20 text-white hover:bg-white/30 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Wallet</h1>
        </div>

     
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Balance */}
        <Card className="bg-white/95 backdrop-blur-lg border-0 shadow-xl p-5 md:p-6">
          <p className="text-sm text-navy/60">Available balance</p>
          <p className="text-3xl md:text-4xl font-bold text-navy mt-1">
            {loading && balance === null ? '…' : formatPHP(balance)}
          </p>
          <p className="text-xs text-navy/50 mt-1">{currency} · Demo credits</p>
          <p className="text-xs mt-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-flex items-center gap-1 text-amber-700">
            <Lock className="w-3 h-3" />
            Withdrawable: {formatPHP(withdrawableMinor)} ({withdrawablePercent}% of balance)
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Button
              onClick={() => { setFormError(''); setShowDeposit(true); }}
              className="flex-1 rounded-xl h-12 bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90 text-white font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Deposit
            </Button>
            <Button
              onClick={() => { setFormError(''); setShowWithdraw(true); }}
              variant="outline"
              className="flex-1 rounded-xl h-12"
            >
              <Minus className="w-4 h-4 mr-2" />
              Withdraw
            </Button>
          </div>
        </Card>

        {/* Transactions */}
        <Card className="bg-white/95 backdrop-blur-lg border-0 shadow-xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-navy">Transactions</h2>
            <button
              onClick={() => loadAll(page)}
              className="p-2 rounded-lg hover:bg-navy/5 text-navy/60"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>

          {/* Type filter = deposit record / withdrawal record / all */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { value: 'all', label: 'All' },
              { value: 'deposit', label: 'Deposits' },
              { value: 'withdraw', label: 'Withdrawals' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => applyFilter(f.value, statusFilter)}
                className={cn(
                  "py-2 rounded-xl border-2 text-sm font-medium transition-all",
                  typeFilter === f.value
                    ? "border-coral bg-coral/10 text-navy"
                    : "border-navy/20 text-navy/60 hover:border-coral"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {['all', 'pending', 'completed', 'failed'].map((s) => (
              <button
                key={s}
                onClick={() => applyFilter(typeFilter, s)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap border",
                  statusFilter === s
                    ? "bg-navy text-white border-navy"
                    : "text-navy/60 border-navy/20 hover:border-navy/40"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <PaginationBar />

          {txs.length === 0 ? (
            <div className="text-center py-8 text-navy/50">
              <WalletIcon className="w-12 h-12 mx-auto mb-2 text-navy/20" />
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {txs.map((tx) => {
                const isDeposit = tx.type === 'deposit';
                const isVoucherBonus = tx.type === 'voucher_bonus';
                const isPositive = isDeposit || isVoucherBonus;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-navy/10 hover:bg-navy/[0.02]"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      isPositive ? "bg-green-100 text-green-700" : "bg-coral/10 text-coral"
                    )}>
                      {isPositive
                        ? <ArrowDownLeft className="w-5 h-5" />
                        : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-navy">
                          {isVoucherBonus ? '+ Bonus' : tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                        </p>
                        {statusBadge(tx.status)}
                      </div>
                      <p className="text-xs text-navy/50 truncate">
                        {formatDateTime(tx.createdAt)}
                        {tx.method ? ` · ${tx.method.toUpperCase()}` : ''}
                        {tx.destination ? ` · ${tx.destination}` : ''}
                      </p>
                      {tx.remarks && (
                        <p className="text-xs text-navy/50 truncate">{tx.remarks}</p>
                      )}
                    </div>
                    <p className={cn(
                      "text-sm font-bold flex-shrink-0",
                      isPositive ? "text-green-600" : "text-navy"
                    )}>
                      {isPositive ? '+' : '−'}{formatPHP(tx.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <PaginationBar />
        </Card>
      </div>

      {/* Deposit modal */}
      {showDeposit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-navy">Deposit (Demo)</h3>
              <button onClick={() => setShowDeposit(false)} className="p-1 hover:bg-navy/10 rounded">
                <X className="w-5 h-5 text-navy/50" />
              </button>
            </div>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDepAmount(String(p))}
                    className="py-2 rounded-xl border-2 border-navy/20 text-sm font-medium text-navy hover:border-coral"
                  >
                    ₱{p}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Amount (₱)</label>
                <Input
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="rounded-xl"
                />
                <p className="text-xs text-navy/50">Min ₱20 · Max ₱50,000</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setDepMethod(m.value)}
                      className={cn(
                        "py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all",
                        depMethod === m.value
                          ? "border-coral bg-coral/10 text-navy"
                          : "border-navy/20 text-navy/60 hover:border-coral"
                      )}
                    >
                      {m.label}
                      {m.value === 'paymongo' && <span className="text-xs block text-green-600 mt-1">Secure</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Voucher Code (optional)</label>
                <Input
                  value={depVoucherCode}
                  onChange={(e) => setDepVoucherCode(e.target.value.toUpperCase())}
                  placeholder="e.g., XXXX-XXXX"
                  className="rounded-xl font-mono"
                />
              </div>
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
                  {formError}
                </div>
              )}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl h-12 bg-gradient-to-r from-coral to-softPurple text-white font-medium"
              >
                {submitting ? 'Processing...' : 'Confirm Deposit'}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Withdraw modal */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-navy">Withdraw (Demo)</h3>
              <button onClick={() => setShowWithdraw(false)} className="p-1 hover:bg-navy/10 rounded">
                <X className="w-5 h-5 text-navy/50" />
              </button>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Amount (₱)</label>
                <Input
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="rounded-xl"
                />
                <p className="text-xs text-navy/50">
                  Min ₱50 · Max ₱50,000 · Withdrawable: {formatPHP(withdrawableMinor)} ({withdrawablePercent}% of balance)
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.filter(m => m.value !== 'paymongo').map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setWdMethod(m.value)}
                      className={cn(
                        "py-2 rounded-xl border-2 text-sm font-medium transition-all",
                        wdMethod === m.value
                          ? "border-coral bg-coral/10 text-navy"
                          : "border-navy/20 text-navy/60 hover:border-coral"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Account name</label>
                <Input
                  value={wdName}
                  onChange={(e) => setWdName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Account number</label>
                <Input
                  value={wdNumber}
                  onChange={(e) => setWdNumber(e.target.value)}
                  placeholder="e.g. 0917XXXXXXX"
                  inputMode="numeric"
                  className="rounded-xl"
                />
                <p className="text-xs text-navy/50">Demo only — only the last 4 digits are stored.</p>
              </div>
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
                  {formError}
                </div>
              )}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl h-12 bg-gradient-to-r from-coral to-softPurple text-white font-medium"
              >
                {submitting ? 'Processing...' : 'Confirm Withdrawal'}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* PayMongo Payment Modal */}
      <PaymentModal
        isOpen={showPayMongo}
        onClose={() => {
          setShowPayMongo(false);
          setDepAmount('');
        }}
        purpose="wallet"
        userId={googleUser?.id}
        onSuccess={() => {
          setShowPayMongo(false);
          setDepAmount('');
          refreshAfterSubmit();
        }}
      />
    </div>
  );
}

export default WalletPage;
