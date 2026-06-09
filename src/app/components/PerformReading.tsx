import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useTarot } from '../context/TarotContext';
import { ReadingRequest, AIAgentReading } from '../types';
import { TAROT_CARDS, AI_AGENTS } from '../data/mockData';
import { ArrowLeft, Upload, Sparkles, Brain, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../lib/api-client';

interface PerformReadingProps {
  request: ReadingRequest;
  onBack: () => void;
}

export function PerformReading({ request, onBack }: PerformReadingProps) {
  const { addReading, updateRequestStatus } = useTarot();
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [cardSpreadImage, setCardSpreadImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiReadings, setAiReadings] = useState<AIAgentReading[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [harmonizedReading, setHarmonizedReading] = useState('');
  const [currentAgent, setCurrentAgent] = useState('');

  useEffect(() => {
    updateRequestStatus(request.id, 'processing');
  }, []);

  const handleCardToggle = (card: string) => {
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter(c => c !== card));
    } else if (selectedCards.length < 5) {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardSpreadImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateReading = async () => {
    if (selectedCards.length === 0 && !cardSpreadImage) {
      toast.error('Please select at least one card or upload a spread image');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(10);
    setCurrentAgent('Connecting to Vision & Tarot AI...');
    setAiReadings([]);

    try {
      const response = await apiClient.generateDraft(
        cardSpreadImage || undefined,
        selectedCards,
        request.question,
        request.userInfo.horoscope
      );
      
      setProcessingProgress(90);
      setCurrentAgent('Harmonizing readings...');

      const newAiReadings: AIAgentReading[] = [
        {
          agentName: 'Tarot Vision AI',
          interpretation: response.tarotReading,
          confidence: 0.95,
        },
        {
          agentName: 'Astrology AI',
          interpretation: response.horoscopeReading,
          confidence: 0.88,
        }
      ];

      setAiReadings(newAiReadings);
      setHarmonizedReading(response.harmonizedReading);
      
      // Update selected cards if Vision AI detected them from image
      if (response.detectedCards && response.detectedCards.length > 0) {
        setSelectedCards(response.detectedCards);
      }

      setProcessingProgress(100);
      toast.success('Reading generated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate reading');
    } finally {
      setIsProcessing(false);
      setCurrentAgent('');
    }
  };

  const handleSubmitReading = () => {
    if (!harmonizedReading) {
      toast.error('Please generate a reading first');
      return;
    }

    addReading({
      requestId: request.id,
      readerId: 'reader-1',
      readerName: 'Master Tarot Reader',
      cardSpreadImage: cardSpreadImage || undefined,
      cardsDrawn: selectedCards,
      aiReadings,
      harmonizedReading,
    });

    toast.success('Reading submitted to requester!');
    onBack();
  };

  return (
    <div className="min-h-screen p-6 mystical-gradient-subtle">
      <div className="max-w-4xl mx-auto space-y-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="size-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="tarot-card">
          <CardHeader>
            <CardTitle>Reading for {request.userName}</CardTitle>
            <CardDescription>
              <Badge className="mb-2">{request.category}</Badge>
              <p className="italic mt-2">"{request.question}"</p>
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="tarot-card">
          <CardHeader>
            <CardTitle>1. Select Cards</CardTitle>
            <CardDescription>
              Choose up to 5 cards for this reading ({selectedCards.length}/5 selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {TAROT_CARDS.map((card) => (
                <Button
                  key={card}
                  variant={selectedCards.includes(card) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCardToggle(card)}
                  disabled={!selectedCards.includes(card) && selectedCards.length >= 5}
                  className="text-xs h-auto py-2"
                >
                  {card}
                </Button>
              ))}
            </div>

            {selectedCards.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm mb-2">Selected Cards:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCards.map((card, idx) => (
                    <Badge key={idx} variant="secondary">
                      {idx + 1}. {card}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="tarot-card">
          <CardHeader>
            <CardTitle>2. Upload Card Spread Image (Optional)</CardTitle>
            <CardDescription>
              Upload a photo of the physical card spread
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="flex-1"
              />
              {cardSpreadImage && <CheckCircle2 className="size-5 text-green-600" />}
            </div>
          </CardContent>
        </Card>

        <Card className="tarot-card">
          <CardHeader>
            <CardTitle>3. Generate AI-Assisted Reading</CardTitle>
            <CardDescription>
              Multiple AI agents will analyze the cards and provide harmonized insights
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleGenerateReading}
              disabled={isProcessing || (selectedCards.length === 0 && !cardSpreadImage)}
              className="w-full"
            >
              <Sparkles className="size-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Generate Reading'}
            </Button>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Brain className="size-4 animate-pulse" />
                    {currentAgent}
                  </span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} />
              </div>
            )}

            {aiReadings.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">AI Agent Insights:</h3>
                {aiReadings.map((reading, idx) => (
                  <Card key={idx}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{reading.agentName}</span>
                        <Badge variant="outline">
                          {(reading.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{reading.interpretation}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {harmonizedReading && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-5" />
                    Review Harmonized Reading
                  </CardTitle>
                  <CardDescription>
                    Review and edit the AI-harmonized reading before submitting it to the requester.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={harmonizedReading}
                    onChange={(e) => setHarmonizedReading(e.target.value)}
                    className="min-h-[200px] text-sm leading-relaxed"
                  />
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {harmonizedReading && (
          <Button onClick={handleSubmitReading} size="lg" className="w-full">
            Submit Reading to Requester
          </Button>
        )}
      </div>
    </div>
  );
}
