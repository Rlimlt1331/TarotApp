import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Badge } from './ui/badge';
import { useTarot } from '../context/TarotContext';
import { useAuth } from '../context/AuthContext';
import { usePendingSubmission } from '../context/PendingSubmissionContext';
import { API_URL } from '../config/api';
import { HOROSCOPES, SUGGESTED_QUESTIONS } from '../data/mockData';
import { ReadingCategory, Gender } from '../types';
import { AlertCircle, Clock, Sparkles, Heart, Briefcase, Activity, Gem } from 'lucide-react';
import { toast } from 'sonner';
import { GemPurchaseModal } from './GemPurchaseModal';

type SubmissionOutcome = 'free' | 'paid' | 'pending_payment' | 'already_pending';

const OUTCOME_CONFIG: Record<SubmissionOutcome, {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  message: string;
  okLabel: string;
}> = {
  free: {
    icon: <Sparkles className="size-8 text-purple-600" />,
    iconBg: 'bg-purple-100',
    title: 'Reading Request Submitted!',
    message: 'Your free reading has been submitted. Our reader will review it shortly and you\'ll be notified once it\'s ready.',
    okLabel: 'Great, thank you!',
  },
  paid: {
    icon: <Gem className="size-8 text-purple-600" />,
    iconBg: 'bg-purple-100',
    title: 'Reading Request Submitted!',
    message: 'Your reading request has been submitted and 20 Gems have been deducted from your balance. Our reader will review it shortly.',
    okLabel: 'Great, thank you!',
  },
  pending_payment: {
    icon: <Clock className="size-8 text-blue-600" />,
    iconBg: 'bg-blue-100',
    title: 'Reading Queued — Payment Required',
    message: 'Your reading has been queued! To activate it, please complete payment via PayNow on the next screen.\n\nOnce your payment is verified, your Gems will be credited and your reading will become active. Please allow up to 24 hours for verification.',
    okLabel: 'Proceed to Payment',
  },
  already_pending: {
    icon: <AlertCircle className="size-8 text-amber-600" />,
    iconBg: 'bg-amber-100',
    title: 'Reading Already Queued',
    message: 'You already have a reading queued pending payment confirmation. Please allow up to 24 hours for your payment to be verified before submitting another request.',
    okLabel: 'OK, understood',
  },
};

export function RequesterPortal({ onShowAuthModal }: { onShowAuthModal: () => void }) {
  const { currentUser, addRequest } = useTarot();
  const { user, token, gemBalance, freeReadingUsed, hasPendingPurchase, refreshGems } = useAuth();
  const { pendingSubmission, setPendingSubmission, clearPendingSubmission } = usePendingSubmission();
  const [selectedCategory, setSelectedCategory] = useState<ReadingCategory>('relationships');
  const [customQuestion, setCustomQuestion] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [horoscope, setHoroscope] = useState(currentUser?.horoscope || '');
  const [gender, setGender] = useState<Gender | ''>(currentUser?.gender || '');
  const [submitting, setSubmitting] = useState(false);
  const [gemModalOpen, setGemModalOpen] = useState(false);
  const [outcomeDialog, setOutcomeDialog] = useState<SubmissionOutcome | null>(null);

  useEffect(() => {
    if (user && token && pendingSubmission) {
      const data = (pendingSubmission as any).readingData;
      setSelectedCategory(data.category);
      setCustomQuestion(data.question || '');
      setHoroscope(data.horoscope);
      setGender(data.gender);
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
  const isFreeReading = !freeReadingUsed;
  const hasEnoughGems = gemBalance >= 20;

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

    if (!user || !token) {
      setPendingSubmission({
        readingData: {
          category: selectedCategory,
          question,
          horoscope,
          gender: gender as Gender,
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
      const response = await fetch(`${API_URL}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question,
          category: selectedCategory,
          horoscope,
          gender,
        }),
      });

      if (response.status === 409) {
        setOutcomeDialog('already_pending');
        return;
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to submit reading request');
      }

      const data = await response.json();
      await refreshGems();

      addRequest({
        userId: currentUser.id,
        userName: user.name || currentUser.name || '',
        category: selectedCategory,
        question,
        userInfo: {
          horoscope: horoscope,
          gender: gender as Gender,
        },
        isFreeReading,
      });

      clearPendingSubmission();
      setCustomQuestion('');
      setSelectedQuestion('');

      if (data.pendingPayment) {
        setOutcomeDialog('pending_payment');
      } else {
        setOutcomeDialog(isFreeReading ? 'free' : 'paid');
      }
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
              First Reading Free
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {user && !isFreeReading && !hasEnoughGems && (
            hasPendingPurchase ? (
              <div className="rounded-lg border border-blue-700 bg-blue-900/30 p-4 text-center space-y-1">
                <p className="text-sm font-medium text-blue-300">
                  Payment pending verification
                </p>
                <p className="text-xs text-blue-400">
                  Your payment is being reviewed. Gems will be credited and your reading activated within 24 hours.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-700 bg-amber-900/30 p-4 text-center space-y-1">
                <p className="text-sm font-medium text-amber-300">
                  You need 20 Gems — you have {gemBalance}.
                </p>
                <p className="text-xs text-amber-400">
                  Click Submit to queue your reading and pay via PayNow. Your reading will be activated once payment is verified.
                </p>
              </div>
            )
          )}

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

          <Button
            type="submit"
            size="lg"
            disabled={submitting || (!!user && !isFreeReading && hasPendingPurchase)}
            className="w-full text-lg py-6 bg-gradient-to-r from-purple-600 to-purple-900 hover:from-purple-700 hover:to-purple-950 shadow-lg hover:shadow-xl transition-all"
          >
            <Sparkles className="size-5 mr-2" />
            {submitting
              ? 'Submitting...'
              : isFreeReading
                ? 'Submit Free Reading Request'
                : hasEnoughGems
                  ? 'Submit Reading (20 Gems)'
                  : 'Queue Reading & Pay via PayNow'}
          </Button>
        </form>
      </div>

      <GemPurchaseModal open={gemModalOpen} onOpenChange={setGemModalOpen} />

      {outcomeDialog && (() => {
        const cfg = OUTCOME_CONFIG[outcomeDialog];
        return (
          <Dialog open onOpenChange={() => {}}>
            <DialogContent className="max-w-sm text-center" onPointerDownOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <div className={`mx-auto mb-2 flex size-16 items-center justify-center rounded-full ${cfg.iconBg}`}>
                  {cfg.icon}
                </div>
                <DialogTitle className="text-center text-lg">{cfg.title}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {cfg.message}
              </p>
              <Button
                className="w-full mt-2"
                onClick={() => {
                  const wasPendingPayment = outcomeDialog === 'pending_payment';
                  setOutcomeDialog(null);
                  if (wasPendingPayment) setGemModalOpen(true);
                }}
              >
                {cfg.okLabel}
              </Button>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
