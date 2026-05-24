import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useTarot } from '../context/TarotContext';
import { ReadingRequest, AIAgentReading } from '../types';
import { TAROT_CARDS, AI_AGENTS } from '../data/mockData';
import { ArrowLeft, Upload, Sparkles, Brain, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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

  const simulateAIReading = async (agentName: string, cards: string[]): Promise<AIAgentReading> => {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const interpretations = {
      relationships: [
        `The cards reveal a transformative period in your emotional connections. ${cards[0]} suggests new beginnings, while ${cards[1]} indicates the need for balance and patience.`,
        `Your heart's journey shows signs of growth and healing. The presence of ${cards[0]} signals opening yourself to vulnerability, leading to deeper authentic connections.`,
        `A significant shift in relationship dynamics is approaching. ${cards[0]} combined with ${cards[1]} suggests letting go of past patterns to welcome new harmonious energy.`,
      ],
      career: [
        `Professional opportunities are aligning with your true purpose. ${cards[0]} indicates it's time to trust your skills and take calculated risks in your career path.`,
        `The cards show a period of professional transformation ahead. ${cards[0]} suggests leadership qualities emerging, while ${cards[1]} indicates the importance of strategic planning.`,
        `Career advancement requires both courage and wisdom. ${cards[0]} shows potential for significant growth when you align your work with your authentic values.`,
      ],
      health: [
        `Your wellbeing journey shows promise for positive change. ${cards[0]} suggests focusing on mind-body balance, while ${cards[1]} indicates the healing power of rest and reflection.`,
        `The cards reveal important insights about your wellness path. ${cards[0]} encourages you to listen to your body's wisdom and prioritize self-care practices.`,
        `A holistic approach to health is needed now. ${cards[0]} combined with ${cards[1]} suggests integrating physical activity with emotional healing for optimal wellness.`,
      ],
    };

    const categoryInterpretations = interpretations[request.category];
    const randomInterpretation = categoryInterpretations[Math.floor(Math.random() * categoryInterpretations.length)];

    return {
      agentName,
      interpretation: randomInterpretation,
      confidence: 0.75 + Math.random() * 0.2,
    };
  };

  const harmonizeReadings = (readings: AIAgentReading[], cards: string[]): string => {
    const categoryGuidance = {
      relationships: 'in matters of the heart and personal connections',
      career: 'regarding your professional journey and aspirations',
      health: 'concerning your wellbeing and vitality',
    };

    return `Based on the cosmic wisdom of the cards you've drawn - ${cards.join(', ')} - here is your harmonized reading ${categoryGuidance[request.category]}:

The collective insight from multiple mystical sources reveals a powerful message for you. This reading combines ancient tarot wisdom with modern intuitive guidance to provide you with the clearest path forward.

${readings[0]?.interpretation}

The secondary insights suggest that ${readings[1]?.interpretation.toLowerCase()}

Furthermore, the spiritual guidance indicates that ${readings[2]?.interpretation.toLowerCase()}

Remember, ${request.userInfo.horoscope} energy influences your current journey. As someone from ${request.userInfo.country}, your unique perspective and experiences shape how these energies manifest in your life.

The cards encourage you to trust your intuition and take inspired action. The universe is supporting your growth and evolution during this time.`;
  };

  const handleGenerateReading = async () => {
    if (selectedCards.length === 0) {
      toast.error('Please select at least one card');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setAiReadings([]);

    try {
      const readings: AIAgentReading[] = [];

      for (let i = 0; i < AI_AGENTS.length; i++) {
        const agent = AI_AGENTS[i];
        setCurrentAgent(agent);
        setProcessingProgress((i / AI_AGENTS.length) * 100);

        const reading = await simulateAIReading(agent, selectedCards);
        readings.push(reading);
        setAiReadings([...readings]);
      }

      setProcessingProgress(95);
      setCurrentAgent('Harmonizing readings...');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const harmonized = harmonizeReadings(readings, selectedCards);
      setHarmonizedReading(harmonized);
      setProcessingProgress(100);

      toast.success('Reading generated successfully!');
    } catch (error) {
      toast.error('Failed to generate reading');
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
              disabled={isProcessing || selectedCards.length === 0}
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
                    Harmonized Reading
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {harmonizedReading}
                  </p>
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
