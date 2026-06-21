import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Badge } from './ui/badge';
import { Combobox } from './ui/combobox';
import { useTarot } from '../context/TarotContext';
import { useAuth } from '../context/AuthContext';
import { usePendingSubmission } from '../context/PendingSubmissionContext';
import { API_URL } from '../config/api';
import { HOROSCOPES, COUNTRIES, SUGGESTED_QUESTIONS } from '../data/mockData';
import { ReadingCategory, Gender } from '../types';
import { Sparkles, Heart, Briefcase, Activity } from 'lucide-react';
import { toast } from 'sonner';

export function RequesterPortal({ onShowAuthModal }: { onShowAuthModal: () => void }) {
  const { currentUser, addRequest } = useTarot();
  const { user, token } = useAuth();
  const { pendingSubmission, setPendingSubmission, clearPendingSubmission } = usePendingSubmission();
  const [selectedCategory, setSelectedCategory] = useState<ReadingCategory>('relationships');
  const [customQuestion, setCustomQuestion] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [horoscope, setHoroscope] = useState(currentUser?.horoscope || '');
  const [gender, setGender] = useState<Gender | ''>(currentUser?.gender || '');
  const [country, setCountry] = useState(currentUser?.country || '');
  const [occupation, setOccupation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && token && pendingSubmission) {
      const data = (pendingSubmission as any).readingData;
      setSelectedCategory(data.category);
      setCustomQuestion(data.question || '');
      setHoroscope(data.horoscope);
      setGender(data.gender);
      setCountry(data.country);
      setOccupation(data.occupation || '');
      setAdditionalNotes(data.additionalNotes || '');
      toast.success('Your form data has been restored!');
      clearPendingSubmission();
    }
  }, [user, token, pendingSubmission, clearPendingSubmission]);

  const categoryIcons = {
    relationships: Heart,
    career: Briefcase,
    health: Activity,
  };

  const filteredQuestions = SUGGESTED_QUESTIONS.filter(q => q.category === selectedCategory);
  const isFreeReading = (currentUser?.readingsCount ?? 0) === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const question = selectedQuestion || customQuestion;
    if (!question) {
      toast.error('Please select or enter a question');
      return;
    }

    if (!horoscope) {
      toast.error('Please select your horoscope sign');
      return;
    }

    if (!gender) {
      toast.error('Please select your gender');
      return;
    }

    if (!country) {
      toast.error('Please select your country');
      return;
    }

    if (!user || !token) {
      setPendingSubmission({
        readingData: {
          category: selectedCategory,
          question,
          horoscope,
          gender: gender as Gender,
          country,
          occupation,
          additionalNotes,
        },
        timestamp: Date.now(),
      } as any);
      toast.error('Please log in to submit a reading request');
      onShowAuthModal();
      return;
    }

    if (!currentUser) {
      toast.error('Please complete your profile first');
      return;
    }

    setSubmitting(true);

    try {
      const cards = [
        { name: selectedCategory, position: 'Category', meaning: question },
        { name: horoscope, position: 'Horoscope' },
        { name: country, position: 'Country' },
        { name: gender, position: 'Gender' },
        ...(occupation ? [{ name: occupation, position: 'Occupation' }] : []),
        ...(additionalNotes ? [{ name: additionalNotes, position: 'Additional Notes' }] : []),
      ];

      const response = await fetch(`${API_URL}/readings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: question,
          cards,
          skipGeneration: true,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to submit reading request');
      }

      addRequest({
        userId: currentUser.id,
        userName: user.name || currentUser.name,
        category: selectedCategory,
        question,
        userInfo: {
          horoscope: horoscope,
          country: country,
          gender: gender as Gender,
          occupation: occupation || undefined,
          additionalNotes: additionalNotes || undefined,
        },
        isFreeReading: (currentUser?.readingsCount ?? 0) === 0,
      });

      clearPendingSubmission();
      toast.success((currentUser?.readingsCount ?? 0) === 0 ? 'Your free reading request has been submitted!' : 'Reading request submitted!');
      setCustomQuestion('');
      setSelectedQuestion('');
      setAdditionalNotes('');
      setOccupation('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit reading request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 mystical-gradient-subtle">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        <div className="text-center space-y-4 py-4 md:py-8">
          <h1 className="text-3xl md:text-5xl flex items-center justify-center gap-3 gradient-text">
            <Sparkles className="size-10 sparkle text-purple-600" />
            Request a Tarot Reading
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect with experienced tarot readers for guidance on your life's journey
          </p>
          {isFreeReading && (
            <Badge className="text-lg px-6 py-2 free-badge text-white border-0">
              <Sparkles className="size-4 mr-2" />
              Your First Reading is FREE
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <Card className="tarot-card">
            <CardHeader>
              <CardTitle>Your Horoscope Sign</CardTitle>
              <CardDescription>
                Select your zodiac sign for personalized insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={horoscope} onValueChange={setHoroscope} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select your horoscope sign" />
                </SelectTrigger>
                <SelectContent>
                  {HOROSCOPES.map((sign) => (
                    <SelectItem key={sign} value={sign}>
                      {sign}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="tarot-card">
            <CardHeader>
              <CardTitle>Your Gender</CardTitle>
              <CardDescription>
                Select your gender identity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={gender} onValueChange={(value) => setGender(value as Gender)}>
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {(['male', 'female', 'prefer-not-to-say'] as Gender[]).map((g) => (
                    <Label
                      key={g}
                      htmlFor={`gender-${g}`}
                      className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        gender === g
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={g} id={`gender-${g}`} />
                      <span className="capitalize text-xs md:text-sm">
                        {g === 'prefer-not-to-say' ? 'Prefer not to say' : g}
                      </span>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="tarot-card">
            <CardHeader>
              <CardTitle>Your Country</CardTitle>
              <CardDescription>
                Select your country (this will be shown to the reader as your geo-location)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Combobox
                options={COUNTRIES.map(c => ({ value: c, label: c }))}
                value={country}
                onValueChange={setCountry}
                placeholder="Select your country..."
                searchPlaceholder="Type to search countries..."
                emptyText="No country found."
              />
            </CardContent>
          </Card>

          <Card className="tarot-card">
            <CardHeader>
              <CardTitle>Select Reading Category</CardTitle>
              <CardDescription>
                Choose the area of life you'd like guidance on
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={selectedCategory}
                onValueChange={(value) => {
                  setSelectedCategory(value as ReadingCategory);
                  setSelectedQuestion('');
                }}
                className="grid grid-cols-3 gap-2 md:gap-4"
              >
                {(['relationships', 'career', 'health'] as ReadingCategory[]).map((category) => {
                  const Icon = categoryIcons[category];
                  const gradientClass = {
                    relationships: 'category-icon-relationships',
                    career: 'category-icon-career',
                    health: 'category-icon-health',
                  }[category];

                  return (
                    <Label
                      key={category}
                      htmlFor={category}
                      className={`flex flex-col items-center gap-2 p-3 md:p-6 border-2 rounded-xl cursor-pointer transition-all ${
                        selectedCategory === category
                          ? 'border-primary bg-primary/10 shadow-lg mystical-glow'
                          : 'border-border hover:border-primary/50 hover:shadow-md'
                      }`}
                    >
                      <RadioGroupItem value={category} id={category} className="sr-only" />
                      <div className={`${gradientClass} p-3 rounded-full`}>
                        <Icon className="size-6 text-white" />
                      </div>
                      <span className="capitalize font-semibold">{category}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="tarot-card">
            <CardHeader>
              <p className="text-lg font-semibold">
                Select a suggested question or write your own
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Suggested Questions</Label>
                <div className="grid gap-2">
                  {filteredQuestions.map((q, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant={selectedQuestion === q.question ? 'default' : 'outline'}
                      className="justify-start h-auto py-2 px-3 md:py-3 md:px-4 text-left whitespace-normal"
                      onClick={() => {
                        setSelectedQuestion(q.question);
                        setCustomQuestion('');
                      }}
                    >
                      {q.question}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-question">Write your own question</Label>
                <Textarea
                  id="custom-question"
                  placeholder="Enter your own question..."
                  value={customQuestion}
                  onChange={(e) => {
                    setCustomQuestion(e.target.value);
                    setSelectedQuestion('');
                  }}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="tarot-card">
            <CardHeader>
              <CardTitle>Additional Information (Optional)</CardTitle>
              <CardDescription>
                Help our readers provide more personalized insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="occupation">Occupation</Label>
                <Input
                  id="occupation"
                  placeholder="e.g., Software Engineer"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional context you'd like to share..."
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={submitting} className="w-full text-lg py-6 bg-gradient-to-r from-purple-600 to-purple-900 hover:from-purple-700 hover:to-purple-950 shadow-lg hover:shadow-xl transition-all">
            <Sparkles className="size-5 mr-2" />
            {submitting ? 'Submitting...' : 'Submit Reading Request'}
          </Button>
        </form>
      </div>
    </div>
  );
}
