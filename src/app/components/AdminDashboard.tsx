import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { ArrowLeft, Brain, Calendar, CheckCircle2, Gem, ImageUp, Sparkles, Star, User, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PendingPurchase {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  packId: string | null;
  gems: number;
  pack: { id: string; priceSGD: number; totalGems: number } | null;
  requestedAt: string;
  pendingSubmissions: number;
}

type QueueStatus = 'pending' | 'processing' | 'completed' | 'pending_payment';

interface DetectedCardRecord {
  id: number;
  name: string;
  position: string | null;
  orientation: string | null;
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
  pendingPayment: boolean;
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
  orientation?: string;
  confidence?: string;
  visualEvidence?: string;
}

const agentNames = [
  'Tarot Interpretation Agent',
  'Astrology Agent',
];

const statusStyles: Record<QueueStatus, string> = {
  pending: 'bg-amber-900/30 text-amber-300 border-amber-700',
  processing: 'bg-blue-900/30 text-blue-300 border-blue-700',
  completed: 'bg-green-900/30 text-green-300 border-green-700',
  pending_payment: 'bg-purple-900/30 text-purple-300 border-purple-700',
};

const statusLabels: Record<QueueStatus, string> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  pending_payment: 'pending payment',
};

export const AdminDashboard: React.FC = () => {
  const [view, setView] = useState<'queue' | 'gems'>('queue');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [statuses, setStatuses] = useState<Record<number, QueueStatus>>(() => {
    const stored = localStorage.getItem('tarot_admin_statuses');
    return stored ? JSON.parse(stored) : {};
  });
  const [spreadImage, setSpreadImage] = useState('');
  const [agentResults, setAgentResults] = useState<AgentResult[]>([]);
  const [pipelinePhase, setPipelinePhase] = useState<'idle' | 'detecting' | 'confirming' | 'generating' | 'complete'>('idle');
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [harmonisedReading, setHarmonisedReading] = useState('');
  const [astrologyReading, setAstrologyReading] = useState('');
  const [tarotReading, setTarotReading] = useState('');
  const [detectedCards, setDetectedCards] = useState<DetectedCard[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Gem credits state
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
  const [gemsLoading, setGemsLoading] = useState(false);
  const [crediting, setCrediting] = useState<number | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchSubmissions();
    fetchPendingPurchases();
  }, [token]);

  useEffect(() => {
    if (view === 'gems') fetchPendingPurchases();
  }, [view]);

  useEffect(() => {
    localStorage.setItem('tarot_admin_statuses', JSON.stringify(statuses));
  }, [statuses]);

  const getStatus = (submissionId: number): QueueStatus => {
    if (statuses[submissionId] === 'processing') return 'processing';
    const submission = submissions.find(s => s.id === submissionId);
    if (submission?.reading) return 'completed';
    if (submission?.pendingPayment) return 'pending_payment';
    return 'pending';
  };

  const fetchPendingPurchases = async () => {
    if (!token) return;
    setGemsLoading(true);
    try {
      const res = await fetch(`${API_URL}/gems/admin/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingPurchases(data.pending);
      }
    } catch (err: any) {
      toast.error('Failed to load pending purchases');
    } finally {
      setGemsLoading(false);
    }
  };

  const creditGems = async (purchase: PendingPurchase) => {
    if (!token) return;
    setCrediting(purchase.id);
    try {
      const res = await fetch(`${API_URL}/gems/admin/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: purchase.userId,
          packId: purchase.packId,
          pendingId: purchase.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to credit gems');
      }
      const data = await res.json();
      toast.success(`${data.message} to ${purchase.userName || purchase.userEmail}`);
      await Promise.all([fetchPendingPurchases(), fetchSubmissions()]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to credit gems');
    } finally {
      setCrediting(null);
    }
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
      { pending: 0, processing: 0, completed: 0, pending_payment: 0 } as Record<QueueStatus, number>
    );
  }, [submissions, statuses]);

  const selectSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    setSpreadImage('');
    setAgentResults([]);
    setPipelinePhase('idle');
    setPipelineProgress(0);
    setHarmonisedReading(submission.reading?.harmonisedReading || '');
    setAstrologyReading(submission.reading?.astrologyReading || '');
    setTarotReading(submission.reading?.tarotReading || '');
    setDetectedCards([]);
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
            detectedCards: detectedCards.map((c) => ({ name: c.name, orientation: c.orientation })),
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

  const pipelineRunning = pipelinePhase === 'detecting' || pipelinePhase === 'generating';

  // Step 1: vision-only card detection — reader reviews before generation
  const detectCards = async () => {
    if (!selectedSubmission || !spreadImage) {
      toast.error('Upload a spread photo to detect cards');
      return;
    }

    setPipelinePhase('detecting');
    setDetectedCards([]);

    try {
      const response = await fetch(
        `${API_URL}/submissions/admin/${selectedSubmission.id}/detect-cards`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ spreadImage }),
        }
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const message = contentType.includes('application/json')
          ? (await response.json()).error
          : await response.text();
        throw new Error(message || 'Failed to detect cards');
      }

      const { detectedCards: cards } = await response.json();
      setDetectedCards(
        (cards as Array<{ name: string; orientation?: string; position?: string; confidence?: string }>)
          .map((c, index) => ({
            name: c.name,
            orientation: c.orientation || 'upright',
            position: c.position || `Card ${index + 1}`,
            confidence: c.confidence,
          }))
      );
      setPipelinePhase('confirming');
    } catch (error: any) {
      toast.error(error.message || 'Failed to detect cards');
      setPipelinePhase('idle');
    }
  };

  const updateConfirmedCardName = (index: number, name: string) => {
    setDetectedCards((current) => current.map((c, i) => (i === index ? { ...c, name } : c)));
  };

  const toggleConfirmedCardOrientation = (index: number) => {
    setDetectedCards((current) =>
      current.map((c, i) =>
        i === index ? { ...c, orientation: c.orientation === 'upright' ? 'reversed' : 'upright' } : c
      )
    );
  };

  const removeConfirmedCard = (index: number) => {
    setDetectedCards((current) => current.filter((_, i) => i !== index));
  };

  const addConfirmedCard = () => {
    setDetectedCards((current) => [
      ...current,
      { name: '', orientation: 'upright', position: `Card ${current.length + 1}` },
    ]);
  };

  // Step 2: generate tarot/horoscope/harmonise using the confirmed card list
  const generateFromConfirmed = async () => {
    if (!selectedSubmission || detectedCards.filter((c) => c.name.trim()).length === 0) return;

    const horoscope = selectedSubmission.horoscope || 'unknown';
    const category = selectedSubmission.category || 'general';

    setPipelinePhase('generating');
    setPipelineProgress(15);
    setAgentResults([]);
    setHarmonisedReading('');
    updateStatus(selectedSubmission.id, 'processing');

    try {
      const tempSummaries: Record<string, string> = {
        'Tarot Interpretation Agent': `Reading through the ${category} lens…`,
        'Astrology Agent': `Processing ${horoscope} energy…`,
      };

      await Promise.all(
        agentNames.map(async (agentName, index) => {
          await new Promise((resolve) => setTimeout(resolve, 800 + index * 300));
          setAgentResults((current) => [
            ...current,
            { name: agentName, summary: tempSummaries[agentName] || 'Processing…', confidence: 0.82 + Math.random() * 0.14 },
          ]);
          setPipelineProgress(25 + (index + 1) * 15);
        })
      );

      setPipelineProgress(88);

      const response = await fetch(
        `${API_URL}/submissions/admin/${selectedSubmission.id}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            confirmedCards: detectedCards
              .filter((c) => c.name.trim())
              .map((c) => ({ name: c.name, orientation: c.orientation || 'upright' })),
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

      setAstrologyReading(generated.horoscopeReading || '');
      setTarotReading(generated.tarotReading || '');
      setHarmonisedReading(generated.harmonizedReading || generated.harmonisedReading || '');
      setPipelineProgress(100);
      setPipelinePhase('complete');
      toast.success('Reading generated — review and click "Submit Reading" to send to requester');
    } catch (error: any) {
      toast.error(error.message || 'Failed to run AI pipeline');
      updateStatus(selectedSubmission.id, 'pending');
      setPipelineProgress(0);
      setPipelinePhase('confirming');
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
    const isCompleted = status === 'completed';

    // Cards to show: prefer freshly-detected (current run), fall back to DB-stored
    const cardsToDisplay: DetectedCard[] = detectedCards.length > 0
      ? detectedCards
      : (selectedSubmission.reading?.detectedCards || []).map((c) => ({
          name: c.name,
          position: c.position || '',
          orientation: c.orientation || undefined,
        }));

    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => setSelectedSubmission(null)} className="mb-4">
          <ArrowLeft className="size-4 mr-2" />
          Back to Queue
        </Button>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selectedSubmission.user.name}</CardTitle>
                    <CardDescription>{selectedSubmission.user.email}</CardDescription>
                  </div>
                  <Badge className={statusStyles[status]}>{statusLabels[status]}</Badge>
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
                <div>
                  <p className="font-medium mb-1">Question</p>
                  <p className="text-muted-foreground">{selectedSubmission.question}</p>
                </div>
                <div>
                  <p className="font-medium mb-2">Profile Context</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Category: {getContextValue('Category')}</Badge>
                    <Badge variant="outline">Horoscope: {getContextValue('Horoscope')}</Badge>
                    <Badge variant="outline">Gender: {getContextValue('Gender')}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!isCompleted && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageUp className="size-5" />
                    Card Spread
                  </CardTitle>
                  <CardDescription>Upload a spread photo to detect and confirm cards.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={pipelineRunning} />
                  {spreadImage && (
                    <img src={spreadImage} alt="Uploaded card spread" className="w-full rounded-md border object-cover" />
                  )}
                  <Button
                    type="button"
                    onClick={detectCards}
                    disabled={pipelineRunning || !spreadImage || pipelinePhase === 'confirming'}
                    className="w-full"
                  >
                    <Sparkles className="size-4 mr-2" />
                    {pipelinePhase === 'detecting' ? 'Detecting…' : 'Detect Cards'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">

            {/* Card Confirmation — shown after detection, before generation */}
            {!isCompleted && pipelinePhase === 'confirming' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Star className="size-4" />
                    Confirm Detected Cards
                  </CardTitle>
                  <CardDescription>
                    Fix any card names or toggle upright/reversed before generating the reading.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {detectedCards.map((card, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-md border p-2">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <Input
                        value={card.name}
                        onChange={(e) => updateConfirmedCardName(index, e.target.value)}
                        className="flex-1 h-8 text-sm"
                        placeholder="Card name"
                      />
                      <Button
                        size="sm"
                        variant={card.orientation === 'upright' ? 'default' : 'outline'}
                        onClick={() => toggleConfirmedCardOrientation(index)}
                        className="shrink-0 h-8 px-3 text-xs"
                      >
                        {card.orientation === 'upright' ? '↑ Upright' : '↓ Reversed'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeConfirmedCard(index)}
                        className="shrink-0 h-8 w-8 p-0"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addConfirmedCard} className="w-full">
                    + Add Card
                  </Button>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={generateFromConfirmed}
                    disabled={detectedCards.filter((c) => c.name.trim()).length === 0}
                    className="w-full"
                  >
                    <Sparkles className="size-4 mr-2" />
                    Generate Reading
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Cards from Reading Session — shown when not in confirmation phase */}
            {pipelinePhase !== 'confirming' && (cardsToDisplay.length > 0 || (pipelinePhase === 'generating' && !isCompleted)) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Star className="size-4" />
                    Cards from Reading Session
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pipelinePhase === 'generating' && cardsToDisplay.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Generating reading…</p>
                  ) : (
                    <div className="space-y-2">
                      {cardsToDisplay.map((card, index) => (
                        <div key={`${card.name}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                          <Badge variant="secondary">{index + 1}</Badge>
                          <p className="font-medium">{card.name}</p>
                          {card.orientation && (
                            <Badge variant={card.orientation === 'upright' ? 'default' : 'outline'}>
                              {card.orientation}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* COMPLETED: show stored agent readings from DB */}
            {isCompleted && selectedSubmission.reading && (
              <>
                {selectedSubmission.reading.tarotReading && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="size-5" />
                        Tarot Interpretation Agent
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedSubmission.reading.tarotReading}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {selectedSubmission.reading.astrologyReading && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Star className="size-5" />
                        Astrology Agent
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedSubmission.reading.astrologyReading}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* PENDING/PROCESSING: live agent pipeline — hidden during confirmation */}
            {!isCompleted && pipelinePhase !== 'confirming' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="size-5" />
                    Multi-Agent Pipeline
                  </CardTitle>
                  <CardDescription>Gemini agents generate the tarot and horoscope interpretation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pipelinePhase === 'detecting' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary shrink-0" />
                      Analysing image and detecting cards…
                    </div>
                  )}
                  {(pipelinePhase === 'generating' || pipelinePhase === 'complete') && pipelineProgress > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{pipelinePhase === 'generating' ? 'Agents processing...' : 'Pipeline complete'}</span>
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
                              <Badge variant="secondary">
                                {pipelinePhase === 'generating' ? 'Running…' : 'Waiting'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {result?.summary || 'Detect and confirm cards to start.'}
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
            )}

            {/* Harmonised Reading */}
            {harmonisedReading && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-5" />
                    Harmonised Reading
                  </CardTitle>
                  <CardDescription>
                    {isCompleted
                      ? 'Submitted to the requester.'
                      : 'Review and edit the reading before submitting to the requester.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={harmonisedReading}
                    onChange={(e) => setHarmonisedReading(e.target.value)}
                    className="min-h-[220px] text-sm leading-relaxed"
                    disabled={isCompleted || submitting}
                  />
                  {!isCompleted && (
                    <Button
                      onClick={submitReading}
                      disabled={submitting || !harmonisedReading.trim()}
                      className="w-full"
                    >
                      <CheckCircle2 className="size-4 mr-2" />
                      {submitting ? 'Submitting…' : 'Submit Reading to Requester'}
                    </Button>
                  )}
                  {isCompleted && (
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Reader Portal</h1>
        <p className="text-muted-foreground">Review requester submissions and process card spread readings.</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border mb-6">
        <div className="flex">
          <button
            onClick={() => setView('queue')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === 'queue'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Reading Queue
          </button>
          <button
            onClick={() => setView('gems')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === 'gems'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Payment Verification
            {pendingPurchases.length > 0 && (
              <Badge className="bg-purple-600 text-white border-0 text-xs py-0 h-5">{pendingPurchases.length}</Badge>
            )}
          </button>
        </div>
      </div>

      {/* Reading Queue tab */}
      {view === 'queue' && (
        <>
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            {(['pending_payment', 'pending', 'processing', 'completed'] as QueueStatus[]).map((status) => (
              <Card key={status}>
                <CardHeader className="pb-2">
                  <CardTitle className="capitalize text-sm">{statusLabels[status]}</CardTitle>
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
                <p className="text-muted-foreground">No submissions yet</p>
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
                        <Badge className={statusStyles[status]}>{statusLabels[status]}</Badge>
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
        </>
      )}

      {/* Payment Verification tab */}
      {view === 'gems' && (
        <>
          {gemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
            </div>
          ) : pendingPurchases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Gem className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No pending payment requests</p>
                <p className="text-xs text-muted-foreground mt-1">Requests appear here when a user selects a gem pack and initiates PayNow payment.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingPurchases.map((p) => (
                <Card key={p.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <User className="size-4 text-muted-foreground" />
                          <span className="font-medium">{p.userName || '(no name)'}</span>
                          {p.userEmail && <span className="text-sm text-muted-foreground">{p.userEmail}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Gem className="size-3.5 text-purple-400" />
                          <span>{p.pack ? `SGD ${p.pack.priceSGD} — ${p.gems} Gems` : `${p.gems} Gems`}</span>
                          {p.pendingSubmissions > 0 && (
                            <>
                              <span>·</span>
                              <Badge className="bg-purple-800/40 text-purple-300 border-purple-700 text-xs">
                                {p.pendingSubmissions} reading{p.pendingSubmissions > 1 ? 's' : ''} queued
                              </Badge>
                            </>
                          )}
                          <span>·</span>
                          <Calendar className="size-3.5" />
                          <span>{format(new Date(p.requestedAt), 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => creditGems(p)}
                        disabled={crediting === p.id}
                        className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                      >
                        <CheckCircle2 className="size-4 mr-2" />
                        {crediting === p.id ? 'Crediting…' : `Credit ${p.gems} Gems`}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
