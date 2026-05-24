import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useTarot } from '../context/TarotContext';
import { HOROSCOPES, COUNTRIES } from '../data/mockData';
import { Gender } from '../types';
import { toast } from 'sonner';

export function UserProfile({ onComplete }: { onComplete: () => void }) {
  const { currentUser, setCurrentUser } = useTarot();
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [horoscope, setHoroscope] = useState(currentUser?.horoscope || '');
  const [country, setCountry] = useState(currentUser?.country || '');
  const [gender, setGender] = useState<Gender>(currentUser?.gender || 'prefer-not-to-say');

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
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['male', 'female', 'non-binary', 'prefer-not-to-say'] as Gender[]).map((g) => (
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
    </div>
  );
}
