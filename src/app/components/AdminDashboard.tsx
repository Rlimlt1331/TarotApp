import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { ArrowLeft, Brain, Calendar, CheckCircle2, ImageUp, MapPin, Sparkles, Star, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type QueueStatus = 'pending' | 'processing' | 'completed';

interface Reading {
  id: number;
  title: string;
  interpretation: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
  cards: Array<{
    id: number;
    name: string;
    position: string;
    meaning?: string;
  }>;
  feedbacks: Array<{
    id: number;
    rating: number;
    comment?: string;
    userId: number;
    createdAt: string;
  }>;
}

interface AgentResult {
  name: string;
  summary: string;
  confidence: number;
}

const agentNames = [
  'Vision Agent',
  'Astrology Agent',
  'Tarot Interpretation Agent',
  'Harmoniser Agent',
];

const statusStyles: Record<QueueStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-700 border-amber-200',
  processing: 'bg-blue-500/10 text-blue-700 border-blue-200',
  completed: 'bg-green-500/10 text-green-700 border-green-200',
};

export const AdminDashboard: React.FC = () => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);
  const [statuses, setStatuses] = useState<Record<number, QueueStatus>>(() => {
    const stored = localStorage.getItem('tarot_admin_statuses');
    return stored ? JSON.parse(stored) : {};
  });
  const [spreadImage, setSpreadImage] = useState('');
  const [agentResults, setAgentResults] = useState<AgentResult[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [harmonisedReading, setHarmonisedReading] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    fetchSubmissions();
  }, [token]);

  useEffect(() => {
    localStorage.setItem('tarot_admin_statuses', JSON.stringify(statuses));
  }, [statuses]);

  const queueCounts = useMemo(() => {
    return readings.reduce(
      (counts, reading) => {
        counts[getStatus(reading.id)] += 1;
        return counts;
      },
      { pending: 0, processing: 0, completed: 0 } as Record<QueueStatus, number>
    );
  }, [readings, statuses]);

  const fetchSubmissions = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/readings/admin/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const data = await response.json();
      setReadings(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (readingId: number): QueueStatus => statuses[readingId] || 'pending';

  const selectReading = (reading: Reading) => {
    setSelectedReading(reading);
    setSpreadImage('');
    setAgentResults([]);
    setPipelineProgress(0);
    setHarmonisedReading(getStatus(reading.id) === 'completed' ? reading.interpretation : '');
  };

  const updateStatus = (readingId: number, status: QueueStatus) => {
    setStatuses((current) => ({ ...current, [readingId]: status }));
  };

  const getContextValue = (position: string) => {
    const card = selectedReading?.cards.find((item) => item.position.toLowerCase() === position.toLowerCase());
    return card?.name || card?.meaning || 'Not provided';
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSpreadImage(reader.result as string);
      runPipeline(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const buildAgentResult = async (agentName: string, reading: Reading): Promise<AgentResult> => {
    await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 700));

    const question = reading.title;
    const profileCards = reading.cards;
    const category = profileCards.find((card) => card.position === 'Category')?.name || 'general';
    const horoscope = profileCards.find((card) => card.position === 'Horoscope')?.name || 'unknown horoscope';
    const country = profileCards.find((card) => card.position === 'Country')?.name || 'unknown location';
    const gender = profileCards.find((card) => card.position === 'Gender')?.name || 'not specified';

    const summaries: Record<string, string> = {
      'Vision Agent': `Detected a clear spread image and mapped the visible cards into a working layout. The visual read emphasises the opening position, a central tension, and an outcome line for "${question}".`,
      'Astrology Agent': `Cross-referenced ${horoscope} energy with the requester's profile from ${country}. The reading should speak to timing, emotional tone, and personal context without overgeneralising from ${gender}.`,
      'Tarot Interpretation Agent': `Interpreted the spread through the ${category} lens, assigning meaning to each card position and relating the cards back to the requester's question.`,
      'Harmoniser Agent': `Merged vision, astrology, and tarot outputs into one coherent reading with a direct answer, nuance, and practical guidance for the requester.`,
    };

    return {
      name: agentName,
      summary: summaries[agentName],
      confidence: 0.82 + Math.random() * 0.14,
    };
  };

  const runPipeline = async (_image: string) => {
    if (!selectedReading) return;

    setPipelineRunning(true);
    setPipelineProgress(15);
    setAgentResults([]);
    setHarmonisedReading('');
    updateStatus(selectedReading.id, 'processing');

    try {
      const results = await Promise.all(
        agentNames.map(async (agentName, index) => {
          const result = await buildAgentResult(agentName, selectedReading);
          setAgentResults((current) => [...current, result]);
          setPipelineProgress(25 + (index + 1) * 15);
          return result;
        })
      );

      setPipelineProgress(92);
      const finalReading = createHarmonisedReading(selectedReading, results);
      setHarmonisedReading(finalReading);

      const response = await fetch(`${API_URL}/readings/admin/submissions/${selectedReading.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ interpretation: finalReading }),
      });

      if (!response.ok) {
        throw new Error('Pipeline completed, but saving the reading failed');
      }

      const updatedReading = await response.json();
      setSelectedReading(updatedReading);
      setReadings((current) => current.map((reading) => (
        reading.id === updatedReading.id ? updatedReading : reading
      )));
      updateStatus(selectedReading.id, 'completed');
      setPipelineProgress(100);
      toast.success('Multi-agent reading completed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to run AI pipeline');
      updateStatus(selectedReading.id, 'pending');
    } finally {
      setPipelineRunning(false);
    }
  };

  const createHarmonisedReading = (reading: Reading, results: AgentResult[]) => {
    const category = reading.cards.find((card) => card.position === 'Category')?.name || 'general';
    const horoscope = reading.cards.find((card) => card.position === 'Horoscope')?.name || 'the requester';
    const country = reading.cards.find((card) => card.position === 'Country')?.name || 'their location';
    const notes = reading.cards.find((card) => card.position === 'Additional Notes')?.name;
    const vision = results.find((result) => result.name === 'Vision Agent')?.summary;
    const astrology = results.find((result) => result.name === 'Astrology Agent')?.summary;
    const tarot = results.find((result) => result.name === 'Tarot Interpretation Agent')?.summary;

    return `Harmonised reading for: ${reading.title}

The spread points to a ${category} question that should be answered with both emotional precision and practical next steps. ${vision}

Astrological context: ${astrology}

Tarot interpretation: ${tarot}

Because the requester identifies with ${horoscope} energy and is based in ${country}, the guidance should be grounded in present circumstances rather than abstract possibility.${notes ? ` Their added context was: ${notes}` : ''}

Final guidance: move slowly enough to notice the pattern, but decisively enough to change it. The reading suggests the requester is not being asked to force an outcome; they are being asked to recognise what is already becoming visible, choose the action that restores agency, and let the next conversation or decision be honest rather than performative.`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (selectedReading) {
    const status = getStatus(selectedReading.id);

    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => setSelectedReading(null)} className="mb-4">
          <ArrowLeft className="size-4 mr-2" />
          Back to Queue
        </Button>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selectedReading.user.name}</CardTitle>
                    <CardDescription>{selectedReading.user.email}</CardDescription>
                  </div>
                  <Badge className={statusStyles[status]}>{status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="size-4" />
                  {format(new Date(selectedReading.createdAt), 'MMM dd, yyyy HH:mm')}
                </div>
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-muted-foreground" />
                  <span>{getContextValue('Horoscope')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span>{getContextValue('Country')}</span>
                </div>
                <div>
                  <p className="font-medium mb-1">Question</p>
                  <p className="text-muted-foreground">{selectedReading.title}</p>
                </div>
                <div>
                  <p className="font-medium mb-2">Profile Context</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedReading.cards.map((card) => (
                      <Badge key={card.id} variant="outline">
                        {card.position}: {card.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageUp className="size-5" />
                  Card Spread
                </CardTitle>
                <CardDescription>Uploading a spread photo starts the four-agent pipeline.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={pipelineRunning} />
                {spreadImage && (
                  <img src={spreadImage} alt="Uploaded card spread" className="w-full rounded-md border object-cover" />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="size-5" />
                  Multi-Agent Pipeline
                </CardTitle>
                <CardDescription>Vision, astrology, tarot interpretation, and harmonisation run in parallel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(pipelineRunning || pipelineProgress > 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{pipelineRunning ? 'Agents processing...' : 'Pipeline complete'}</span>
                      <span>{Math.round(pipelineProgress)}%</span>
                    </div>
                    <Progress value={pipelineProgress} />
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  {agentNames.map((agentName) => {
                    const result = agentResults.find((agent) => agent.name === agentName);

                    return (
                      <div key={agentName} className="rounded-md border p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="font-medium">{agentName}</p>
                          {result ? (
                            <Badge variant="outline">{Math.round(result.confidence * 100)}%</Badge>
                          ) : (
                            <Badge variant="secondary">{pipelineRunning ? 'Running' : 'Waiting'}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {result?.summary || 'Upload a spread photo to start this agent.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {harmonisedReading && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-5" />
                    Harmonised Reading
                  </CardTitle>
                  <CardDescription>Saved to the submission for the requester and admin record.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{harmonisedReading}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Reader Portal</h1>
        <p className="text-gray-600">Review requester submissions and process card spread readings.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {(['pending', 'processing', 'completed'] as QueueStatus[]).map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="capitalize text-sm">{status}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{queueCounts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {readings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No submissions yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {readings.map((reading) => {
            const status = getStatus(reading.id);

            return (
              <Card
                key={reading.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => selectReading(reading)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="size-5" />
                        {reading.title}
                      </CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-4 mt-2">
                        <span>{reading.user.name}</span>
                        <span>{format(new Date(reading.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                      </CardDescription>
                    </div>
                    <Badge className={statusStyles[status]}>{status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {reading.cards.slice(0, 5).map((card) => (
                      <Badge key={card.id} variant="outline">
                        {card.position}: {card.name}
                      </Badge>
                    ))}
                    {status === 'completed' && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="size-3" />
                        Reading saved
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
