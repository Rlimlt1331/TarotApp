import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Gem } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { toast } from 'sonner';

const PACKS = [
  { id: 'pack_10', priceSGD: 10, totalGems: 20, label: '$10 SGD', gems: '20 Gems', subLabel: '1 reading' },
  { id: 'pack_20', priceSGD: 20, totalGems: 45, label: '$20 SGD', gems: '45 Gems', subLabel: '2 readings + 5 bonus' },
  { id: 'pack_50', priceSGD: 50, totalGems: 120, label: '$50 SGD', gems: '120 Gems', subLabel: '6 readings + 20 bonus', popular: true },
  { id: 'pack_80', priceSGD: 80, totalGems: 200, label: '$80 SGD', gems: '200 Gems', subLabel: '10 readings + 40 bonus' },
];

interface GemPurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GemPurchaseModal({ open, onOpenChange }: GemPurchaseModalProps) {
  const { token, gemBalance, freeReadingUsed, refreshGems } = useAuth();
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'pay'>('select');

  const handleSelectPack = async (packId: string) => {
    setSelectedPack(packId);
    if (!token) return;
    try {
      await fetch(`${API_URL}/gems/purchase-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packId }),
      });
    } catch {
      // fire-and-forget
    }
    setStep('pay');
  };

  const handleDone = async () => {
    await refreshGems();
    toast.info('Once your payment is verified, gems will be credited to your account.');
    onOpenChange(false);
    setStep('select');
    setSelectedPack(null);
  };

  const pack = PACKS.find((p) => p.id === selectedPack);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setStep('select'); setSelectedPack(null); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gem className="size-5 text-purple-500" />
            Tarot Gems
          </DialogTitle>
          <DialogDescription>
            {freeReadingUsed
              ? `Your current balance: ${gemBalance} Gems (${Math.floor(gemBalance / 20)} reading${Math.floor(gemBalance / 20) !== 1 ? 's' : ''})`
              : 'Your first reading is free — no gems needed!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">Each reading costs <strong>20 Gems</strong>. Choose a pack:</p>
            <div className="grid grid-cols-2 gap-3">
              {PACKS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPack(p.id)}
                  className={`relative flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    p.popular
                      ? 'border-purple-500 bg-purple-800/30 hover:bg-purple-800/40'
                      : 'border-border bg-muted/40 hover:border-purple-400 hover:bg-purple-900/20'
                  }`}
                >
                  {p.popular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs bg-purple-600 text-white border-0">
                      Most Popular
                    </Badge>
                  )}
                  <Gem className="size-6 text-purple-400" />
                  <span className="font-bold text-lg">{p.label}</span>
                  <span className="text-sm font-semibold text-purple-400">{p.gems}</span>
                  <span className="text-xs text-muted-foreground text-center">{p.subLabel}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              No refunds once gems have been used. Unused gems are non-refundable after purchase.
            </p>
          </div>
        )}

        {step === 'pay' && pack && (
          <div className="space-y-4 mt-2">
            <div className="bg-purple-900/40 border border-purple-700 rounded-lg p-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground">You selected</p>
              <p className="font-bold text-lg">{pack.label} → {pack.gems}</p>
              <p className="text-xs text-muted-foreground">{pack.subLabel}</p>
            </div>

            <div className="space-y-3">
              <p className="font-semibold text-sm">Pay via PayNow:</p>

              <div className="flex justify-center">
                <img
                  src="/paynow-qr.png"
                  alt="PayNow QR code"
                  className="w-48 h-48 rounded-lg border border-purple-200 object-contain"
                />
              </div>

              <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside bg-muted/40 rounded-lg p-3">
                <li>Open your bank app and scan the QR code above.</li>
                <li>Enter amount: <strong>SGD {pack.priceSGD}</strong></li>
                <li>Add your <strong>name</strong> in the payment reference.</li>
                <li>Screenshot the receipt and send it to the admin via Telegram.</li>
              </ol>
            </div>

            <p className="text-xs text-muted-foreground">
              Gems will be credited to your account within 24 hours after payment is verified.
              No refunds once gems have been used.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleDone} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                Done — I've paid
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
