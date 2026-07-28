import { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Clock, Gem } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { format } from 'date-fns';

interface GemTransaction {
  id: number;
  type: string;
  amount: number;
  referenceId: string | null;
  createdAt: string;
}

const PACK_PRICES: Record<string, number> = {
  pack_10: 10,
  pack_20: 20,
  pack_50: 50,
  pack_80: 80,
};

function resolvePackPrice(referenceId: string | null): number | null {
  if (!referenceId) return null;
  const packId = referenceId.replace('paynow_', '');
  return PACK_PRICES[packId] ?? null;
}

function txLabel(type: string): string {
  switch (type) {
    case 'purchase': return 'Gems purchased';
    case 'pending_purchase': return 'Pending payment verification';
    case 'free_reading': return 'Free reading used';
    case 'reading_spend': return 'Reading submitted';
    case 'rating_bonus': return 'Rating bonus';
    default: return type;
  }
}

export function GemHistory() {
  const { token, gemBalance, freeReadingUsed } = useAuth();
  const [transactions, setTransactions] = useState<GemTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/gems/balance`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setTransactions(data.transactions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen p-6 mystical-gradient-subtle">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2 py-8">
          <h1 className="text-5xl flex items-center justify-center gap-3 gradient-text">
            <Gem className="size-10 sparkle text-purple-600" />
            Gem History
          </h1>
          <p className="text-lg text-muted-foreground">Your Tarot Gems balance and transaction history</p>
        </div>

        {/* Balance summary */}
        <Card className="tarot-card">
          <CardContent className="py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gem className="size-5 text-purple-400" />
                <span className="font-medium">Current Balance</span>
              </div>
              <span className="text-2xl font-bold text-purple-400">
                {freeReadingUsed ? `${gemBalance} Gems` : 'Free reading available'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Transaction list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Gem className="size-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No gem transactions yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const isCredit = tx.amount > 0;
              const isPending = tx.type === 'pending_purchase';
              const packPrice = resolvePackPrice(tx.referenceId);

              return (
                <Card key={tx.id} className="tarot-card">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                          isPending
                            ? 'bg-amber-900/30'
                            : isCredit
                              ? 'bg-green-900/30'
                              : 'bg-purple-900/30'
                        }`}>
                          {isPending
                            ? <Clock className="size-4 text-amber-400" />
                            : <Gem className={`size-4 ${isCredit ? 'text-green-400' : 'text-purple-400'}`} />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{txLabel(tx.type)}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(tx.createdAt), 'MMM dd, yyyy HH:mm')}
                            </span>
                            {packPrice != null && (
                              <span className="text-xs text-muted-foreground">· SGD {packPrice}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${
                        isPending
                          ? 'text-amber-400'
                          : isCredit
                            ? 'text-green-400'
                            : 'text-muted-foreground'
                      }`}>
                        {isPending
                          ? `${tx.amount} Gems (pending)`
                          : isCredit
                            ? `+${tx.amount} Gems`
                            : `${tx.amount} Gems`
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
