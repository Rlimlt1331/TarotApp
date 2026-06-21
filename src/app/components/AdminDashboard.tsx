import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { ArrowLeft, Brain, Calendar, CheckCircle2, ImageUp, MapPin, Sparkles, Star, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type QueueStatus = 'pending' | 'processing' | 'completed';

interface DetectedCardRecord {
  id: number;
  name: string;
  position: string | null;
}

interface AgentReading {
  id: number;
  submissionId: number;
  astrologyReading: string | null;
  tarotReading: string | null;
  harmonisedReading: string | null;
  detectedCards: DetectedCardRecord[];
  createdAt: string;
  updatedAt: string;
}

interface Submission {
  id: number;
  question: string;
  category: string | null;
  horoscope: string | null;
  gender: string | null;
  country: string | null;
  occupation: string | null;
  additionalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
  reading: AgentReading | null;
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
  fullOutput?: string;
  detectedCardNames?: string[];
}

interface DetectedCard {
  name: string;
  position: string;
  confidence?: string;
  visualEvidence?: string;
}

const agentNames = [
  'Tarot Interpretation Agent',
  'Astrology Agent',
];

const statusStyles: Record<QueueStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-700 border-amber-200',
  processing: 'bg-blue-500/10 text-blue-700 border-blue-200',
  completed: 'bg-green-500/10 text-green-700 border-green-200',
};

export const AdminDashboard: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [statuses, setStatuses] = useState<Record<number, QueueStatus>>(() => {
    const stored = localStorage.getItem('tarot_admin_statuses');
    return stored ? JSON.parse(stored) : {};
  });
  const [spreadImage, setSpreadImage] = useState('');
  const [agentResults, setAgentResults] = useState<AgentResult[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [harmonisedReading, setHarmonisedReading] = useState('');
  const [astrologyReading, setAstrologyReading] = useState('');
  const [tarotReading, setTarotReading] = useState('');
  const [detectedCards, setDetectedCards] = useState<DetectedCard[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    fetchSubmissions();
  }, [token]);

  useEffect(() => {
    localStorage.setItem('tarot_admin_statuses', JSON.stringify(statuses));
  }, [statuses]);

  const getStatus = (submissionId: number): QueueStatus => {
    if (statuses[submissionId] === 'processing') return 'processing';
    const submission = submissions.find(s => s.id === submissionId);
    if (submission?.reading) return 'completed';
    return 'pending';
  };

  const fetchSubmissions = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/submissions/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const data = await response.json();
      setSubmissions(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const queueCounts = useMemo(() => {
    return submissions.reduce(
      (counts, submission) => {
        counts[getStatus(submission.id)] += 1;
        return counts;
      },
      { pending: 0, processing: 0, completed: 0 } as Record<QueueStatus, number>
    );
  }, [submissions, statuses]);

  const selectSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    setSpreadImage('');
    setSelectedCards([]);
    setAgentResults([]);
    setPipelineProgress(0);
    setHarmonisedReading(submission.reading?.harmonisedReading || '');
    setAstrologyReading(submission.reading?.astrologyReading || '');
    setTarotReading(submission.reading?.tarotReading || '');
    if (submission.reading?.detectedCards) {
      setDetectedCards(submission.reading.detectedCards.map(c => ({
        name: c.name,
        position: c.position || '',
        confidence: 'Saved',
      })));
    } else {
      setDetectedCards([]);
    }
  };

  const updateStatus = (submissionId: number, status: QueueStatus) => {
    setStatuses((current) => ({ ...current, [submissionId]: status }));
  };

  const submitReading = async () => {
    if (!selectedSubmission || !harmonisedReading.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch(
        `${API_URL}/submissions/admin/${selectedSubmission.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            astrologyReading,
            tarotReading,
            harmonisedReading,
            detectedCardNames: detectedCards.map((c) => c.name),
          }),
        }
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const message = contentType.includes('application/json')
          ? (await response.json()).error
          : await response.text();
        throw new Error(message || 'Failed to submit reading');
      }

      const updatedSubmission = await response.json();
      setSelectedSubmission(updatedSubmission);
      setSubmissions((current) =>
        current.map((s) => (s.id === updatedSubmission.id ? updatedSubmission : s))
      );
      updateStatus(selectedSubmission.id, 'completed');
      toast.success('Reading submitted to requester');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit reading');
    } finally {
      setSubmitting(false);
    }
  };

  const getContextValue = (field: string) => {
    if (!selectedSubmission) return 'Not provided';
    switch (field.toLowerCase()) {
      case 'horoscope': return selectedSubmission.horoscope || 'Not provided';
      case 'category': return selectedSubmission.category || 'Not provided';
      case 'country': return selectedSubmission.country || 'Not provided';
      case 'gender': return selectedSubmission.gender || 'Not provided';
      case 'occupation': return selectedSubmission.occupation || 'Not provided';
      case 'additional notes': return selectedSubmission.additionalNotes || 'Not provided';
      default: return 'Not provided';
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSpreadImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const runPipeline = async (image?: string) => {
    if (!selectedSubmission) return;

    if (!image) {
      toast.error('Upload a spread photo to start the pipeline');
      return;
    }

    const horoscope = selectedSubmission.horoscope || 'unknown';
    const category = selectedSubmission.category || 'general';

    setPipelineRunning(true);
    setPipelineProgress(15);
    setAgentResults([]);
    setHarmonisedReading('');
    setDetectedCards([]);
    updateStatus(selectedSubmission.id, 'processing');

    try {
      // Phase 1: simulate agent progress for visual feedback while real API call prepares
      const tempSummaries: Record<string, string> = {
        'Tarot Interpretation Agent': `Reading through the ${category} lens…`,
        'Astrology Agent': `Processing ${horoscope} energy…`,
      };

      await Promise.all(
        agentNames.map(async (agentName, index) => {
          await new Promise((resolve) => setTimeout(resolve, 800 + index * 300));
          setAgentResults((current) => [
            ...current,
            {
              name: agentName,
              summary: tempSummaries[agentName] || 'Processing…',
              confidence: 0.82 + Math.random() * 0.14,
            },
          ]);
          setPipelineProgress(25 + (index + 1) * 15);
        })
      );

      setPipelineProgress(88);

      // Phase 2: real AI generation on the backend
      const response = await fetch(
        `${API_URL}/submissions/admin/${selectedSubmission.id}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            spreadImage: image,
          }),
        }
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const message = contentType.includes('application/json')
          ? (await response.json()).error
          : await response.text();
        throw new Error(message || 'Failed to generate reading');
      }

      const generated = await response.json();
      // generated: { detectedCards: string[], tarotReading: string, horoscopeReading: string, harmonizedReading: string }

      // Phase 3: replace placeholder agent results with real content
      setAgentResults([
        {
          name: 'Tarot Interpretation Agent',
          summary: `Interpreted cards through the ${category} lens.`,
          confidence: 0.91,
          fullOutput: generated.tarotReading,
        },
        {
          name: 'Astrology Agent',
          summary: `${horoscope} energy cross-referenced with the reading question.`,
          confidence: 0.89,
          fullOutput: generated.horoscopeReading,
        },
      ]);

      setDetectedCards(
        (generated.detectedCards as string[]).map((name, index) => ({
          name,
          position: `Card ${index + 1}`,
          confidence: 'Detected by AI',
        }))
      );

      setAstrologyReading(generated.horoscopeReading || '');
      setTarotReading(generated.tarotReading || '');
      setHarmonisedReading(generated.harmonizedReading || generated.harmonisedReading || '');
      setPipelineProgress(100);
      toast.success('Reading generated — review and click "Submit Reading" to send to requester');
    } catch (error: any) {
      toast.error(error.message || 'Failed to run AI pipeline');
      updateStatus(selectedSubmission.id, 'pending');
    } finally {
      setPipelineRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (selectedSubmission) {
    const status = getStatus(selectedSubmission.id);

    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => setSelectedSubmission(null)} className="mb-4">
          <ArrowLeft className="size-4 mr-2" />
          Back to Queue
        </Button>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selectedSubmission.user.name}</CardTitle>
                    <CardDescription>{selectedSubmission.user.email}</CardDescription>
                  </div>
                  <Badge className={statusStyles[status]}>{status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="size-4" />
                  {format(new Date(selectedSubmission.createdAt), 'MMM dd, yyyy HH:mm')}
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
                  <p className="text-muted-foreground">{selectedSubmission.question}</p>
                </div>
                <div>
                  <p className="font-medium mb-2">Profile Context</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Category: {getContextValue('Category')}</Badge>
                    <Badge variant="outline">Horoscope: {getContextValue('Horoscope')}</Badge>
                    <Badge variant="outline">Country: {getContextValue('Country')}</Badge>
                    <Badge variant="outline">Gender: {getContextValue('Gender')}</Badge>
                    <Badge variant="outline">Occupation: {getContextValue('Occupation')}</Badge>
                    <Badge variant="outline">Notes: {getContextValue('Additional Notes')}</Badge>
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
                <Button
                  type="button"
                  onClick={() => runPipeline(spreadImage || undefined)}
                  disabled={pipelineRunning || !spreadImage}
                  className="w-full"
                >
                  <Sparkles className="size-4 mr-2" />
                  Generate Reading
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {selectedSubmission.reading?.detectedCards && selectedSubmission.reading.detectedCards.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Star className="size-4" />
                    Cards from Reading Session
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubmission.reading.detectedCards.map((card, i) => (
                      <Badge key={i} variant="outline">{card.name}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="size-5" />
                  Multi-Agent Pipeline
                </CardTitle>
                <CardDescription>Gemini reads the photo or selected cards, then saves the final interpretation.</CardDescription>
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

                <div className="space-y-4">
                  {agentNames.map((agentName) => {
                    const result = agentResults.find((agent) => agent.name === agentName);

                    return (
                      <div key={agentName} className="rounded-md border p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{agentName}</p>
                          {result ? (
                            <Badge variant="outline">{Math.round(result.confidence * 100)}%</Badge>
                          ) : (
                            <Badge variant="secondary">{pipelineRunning ? 'Running…' : 'Waiting'}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {result?.summary || 'Upload a spread photo to start.'}
                        </p>
                        {result?.fullOutput && (
                          <div className="rounded border bg-muted/30 p-3">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.fullOutput}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {(pipelineRunning || detectedCards.length > 0 || harmonisedReading) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageUp className="size-5" />
                    Detected Cards
                  </CardTitle>
                  <CardDescription>Use this to verify that Gemini is reading the uploaded image.</CardDescription>
                </CardHeader>
                <CardContent>
                  {pipelineRunning && detectedCards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Waiting for Gemini vision output...</p>
                  ) : detectedCards.length > 0 ? (
                    <div className="space-y-3">
                      {detectedCards.map((card, index) => (
                        <div key={`${card.position}-${card.name}-${index}`} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{index + 1}</Badge>
                            <p className="font-medium">{card.name}</p>
                            <Badge variant="outline">{card.position}</Badge>
                            {card.confidence && <Badge>{card.confidence}</Badge>}
                          </div>
                          {card.visualEvidence && (
                            <p className="mt-2 text-sm text-muted-foreground">{card.visualEvidence}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No cards were confidently identified from the image.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {harmonisedReading && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-5" />
                    Harmonised Reading
                  </CardTitle>
                  <CardDescription>
                    {getStatus(selectedSubmission.id) === 'completed'
                      ? 'Submitted to the requester.'
                      : 'Review and edit the reading before submitting to the requester.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={harmonisedReading}
                    onChange={(e) => setHarmonisedReading(e.target.value)}
                    className="min-h-[220px] text-sm leading-relaxed"
                    disabled={getStatus(selectedSubmission.id) === 'completed' || submitting}
                  />
                  {getStatus(selectedSubmission.id) !== 'completed' && (
                    <Button
                      onClick={submitReading}
                      disabled={submitting || !harmonisedReading.trim()}
                      className="w-full"
                    >
                      <CheckCircle2 className="size-4 mr-2" />
                      {submitting ? 'Submitting…' : 'Submit Reading to Requester'}
                    </Button>
                  )}
                  {getStatus(selectedSubmission.id) === 'completed' && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="size-4" />
                      Reading submitted — visible to requester under My Readings.
                    </div>
                  )}
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

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No submissions yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {submissions.map((submission) => {
            const status = getStatus(submission.id);

            return (
              <Card
                key={submission.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => selectSubmission(submission)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="size-5" />
                        {submission.question}
                      </CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-4 mt-2">
                        <span>{submission.user.name}</span>
                        <span>{format(new Date(submission.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                      </CardDescription>
                    </div>
                    <Badge className={statusStyles[status]}>{status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {submission.category && (
                      <Badge variant="outline">Category: {submission.category}</Badge>
                    )}
                    {submission.horoscope && (
                      <Badge variant="outline">Horoscope: {submission.horoscope}</Badge>
                    )}
                    {submission.country && (
                      <Badge variant="outline">Country: {submission.country}</Badge>
                    )}
                    {submission.gender && (
                      <Badge variant="outline">Gender: {submission.gender}</Badge>
                    )}
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
