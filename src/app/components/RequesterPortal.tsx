import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Badge } from './ui/badge';
import { useTarot } from '../context/TarotContext';
import { HOROSCOPES, COUNTRIES, SUGGESTED_QUESTIONS } from '../data/mockData';
import { ReadingCategory, Gender } from '../types';
import { Sparkles, Heart, Briefcase, Activity } from 'lucide-react';
import { toast } from 'sonner';

export function RequesterPortal() {
  const { currentUser, addRequest } = useTarot();
  const [selectedCategory, setSelectedCategory] = useState<ReadingCategory>('relationships');
  const [customQuestion, setCustomQuestion] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [horoscope, setHoroscope] = useState(currentUser?.horoscope || '');
  const [gender, setGender] = useState<Gender | ''>(currentUser?.gender || '');
  const [occupation, setOccupation] = useState('');

  const categoryIcons = {
    relationships: Heart,
    career: Briefcase,
    health: Activity,
  };

  const filteredQuestions = SUGGESTED_QUESTIONS.filter(q => q.category === selectedCategory);
  const isFreeReading = (currentUser?.readingsCount ?? 0) === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      toast.error('Please complete your profile first');
      return;
    }

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

    addRequest({
      userId: currentUser.id,
      userName: currentUser.name,
      category: selectedCategory,
      question,
      userInfo: {
        horoscope: horoscope,
        country: currentUser.country,
        gender: gender as Gender,
        occupation: occupation || undefined,
        additionalNotes: additionalNotes || undefined,
      },
      isFreeReading,
    });

    toast.success(isFreeReading ? 'Your free reading request has been submitted!' : 'Reading request submitted!');
    setCustomQuestion('');
    setSelectedQuestion('');
    setAdditionalNotes('');
    setOccupation('');
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl flex items-center justify-center gap-2">
            <Sparkles className="size-8" />
            Request a Tarot Reading
          </h1>
          <p className="text-muted-foreground">
            Connect with experienced tarot readers for guidance on your life's journey
          </p>
          {isFreeReading && (
            <Badge variant="secondary" className="text-lg px-4 py-1">
              Your First Reading is FREE
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>Your Gender</CardTitle>
              <CardDescription>
                Select your gender identity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={gender} onValueChange={(value) => setGender(value as Gender)}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['male', 'female', 'non-binary', 'prefer-not-to-say'] as Gender[]).map((g) => (
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
                      <span className="capitalize text-sm">
                        {g === 'prefer-not-to-say' ? 'Prefer not to say' : g}
                      </span>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
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
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                {(['relationships', 'career', 'health'] as ReadingCategory[]).map((category) => {
                  const Icon = categoryIcons[category];
                  return (
                    <Label
                      key={category}
                      htmlFor={category}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedCategory === category
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={category} id={category} className="sr-only" />
                      <Icon className="size-8" />
                      <span className="capitalize">{category}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="font-semibold">
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
                      className="justify-start h-auto py-3 px-4 text-left"
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

          <Card>
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

          <Button type="submit" size="lg" className="w-full">
            Submit Reading Request
          </Button>
        </form>
      </div>
    </div>
  );
}
