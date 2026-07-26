import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Badge } from './ui/badge';
import { useTarot } from '../context/TarotContext';
import { useAuth } from '../context/AuthContext';
import { HOROSCOPES, COUNTRIES } from '../data/mockData';
import { Gender } from '../types';
import { toast } from 'sonner';
import { Gem } from 'lucide-react';
import { API_URL } from '../config/api';

interface GemTransaction {
  id: number;
  type: 'purchase' | 'reading_spend' | 'rating_bonus' | 'free_reading';
  amount: number;
  referenceId: string | null;
  createdAt: string;
}

const TX_LABELS: Record<string, string> = {
  purchase: 'Gem Pack Purchase',
  reading_spend: 'Reading',
  rating_bonus: 'Rating Bonus',
  free_reading: 'Free Reading',
};

export function UserProfile({ onComplete }: { onComplete: () => void }) {
  const { currentUser, setCurrentUser } = useTarot();
  const { token, gemBalance, freeReadingUsed, refreshGems } = useAuth();
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [horoscope, setHoroscope] = useState(currentUser?.horoscope || '');
  const [country, setCountry] = useState(currentUser?.country || '');
  const [gender, setGender] = useState<Gender>(currentUser?.gender || 'prefer-not-to-say');
  const [transactions, setTransactions] = useState<GemTransaction[]>([]);

  useEffect(() => {
    if (!token) return;
    refreshGems();
    fetch(`${API_URL}/gems/balance`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions ?? []))
      .catch(() => {});
  }, [token]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !horoscope || !country) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCurrentUser({
      id: currentUser?.id || `user-${Date.now()}`,
      name,
      email,
      horoscope,
      country,
      gender,
      readingsCount: currentUser?.readingsCount || 0,
    });

    toast.success('Profile updated successfully!');
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 mystical-gradient-subtle">
      <Card className="w-full max-w-2xl tarot-card shadow-xl">
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>
            Tell us about yourself to get personalized tarot readings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horoscope">Horoscope Sign *</Label>
                <Select value={horoscope} onValueChange={setHoroscope} required>
                  <SelectTrigger id="horoscope">
                    <SelectValue placeholder="Select your sign" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOROSCOPES.map((sign) => (
                      <SelectItem key={sign} value={sign}>
                        {sign}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select value={country} onValueChange={setCountry} required>
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gender *</Label>
              <RadioGroup value={gender} onValueChange={(value) => setGender(value as Gender)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(['male', 'female', 'prefer-not-to-say'] as Gender[]).map((g) => (
                    <Label
                      key={g}
                      htmlFor={g}
                      className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        gender === g
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={g} id={g} />
                      <span className="capitalize text-sm">
                        {g === 'prefer-not-to-say' ? 'Prefer not to say' : g}
                      </span>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="flex gap-3">
              <Button type="submit" className="flex-1">
                Save Profile
              </Button>
              {currentUser && (
                <Button type="button" variant="outline" onClick={onComplete}>
                  Skip
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl tarot-card shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gem className="size-5 text-purple-500" />
            Tarot Gems
          </CardTitle>
          <CardDescription>
            {freeReadingUsed ? `Balance: ${gemBalance} Gems` : 'Your first reading is free — no gems needed!'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gem transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{TX_LABELS[tx.type] ?? tx.type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={tx.amount >= 0 ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'}
                  >
                    {tx.amount >= 0 ? '+' : ''}{tx.amount} Gems
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
