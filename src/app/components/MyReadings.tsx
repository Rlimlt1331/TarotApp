import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useTarot } from '../context/TarotContext';
import { format } from 'date-fns';
import { Calendar, Sparkles, Star } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Reading } from '../types';

export function MyReadings() {
  const { currentUser, requests, readings } = useTarot();
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);

  const myRequests = requests.filter(r => r.userId === currentUser?.id);
  const myReadings = readings.filter(r =>
    myRequests.some(req => req.id === r.requestId)
  );

  const getRequestForReading = (reading: Reading) => {
    return myRequests.find(req => req.id === reading.requestId);
  };

  const categoryColors = {
    relationships: 'bg-pink-500/10 text-pink-700 border-pink-200',
    career: 'bg-blue-500/10 text-blue-700 border-blue-200',
    health: 'bg-green-500/10 text-green-700 border-green-200',
  };

  return (
    <div className="min-h-screen p-6 mystical-gradient-subtle">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4 py-8">
          <h1 className="text-5xl flex items-center justify-center gap-3 gradient-text">
            <Star className="size-10 sparkle text-purple-600" />
            My Readings
          </h1>
          <p className="text-lg text-muted-foreground">
            View your tarot reading history and insights
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="tarot-card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-purple-900 dark:text-purple-100">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-purple-600">{myRequests.length}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900 dark:text-green-100">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{myReadings.length}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-amber-900 dark:text-amber-100">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-600">
                {myRequests.filter(r => r.status !== 'completed').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl">Completed Readings</h2>
          {myReadings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No completed readings yet</p>
              </CardContent>
            </Card>
          ) : (
            myReadings.map((reading) => {
              const request = getRequestForReading(reading);
              if (!request) return null;

              return (
                <Card key={reading.id} className="tarot-card">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="size-5" />
                          {request.question}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-4" />
                            {format(reading.createdAt, 'MMM dd, yyyy')}
                          </span>
                          <Badge className={categoryColors[request.category]}>
                            {request.category}
                          </Badge>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Cards Drawn:</p>
                      <div className="flex flex-wrap gap-2">
                        {reading.cardsDrawn.map((card, idx) => (
                          <Badge key={idx} variant="outline">
                            {card}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Reading Summary:</p>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {reading.harmonizedReading}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setSelectedReading(reading)}
                      className="w-full"
                    >
                      View Full Reading
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl">Pending Requests</h2>
          {myRequests.filter(r => r.status !== 'completed').length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No pending requests</p>
              </CardContent>
            </Card>
          ) : (
            myRequests
              .filter(r => r.status !== 'completed')
              .map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle>{request.question}</CardTitle>
                        <CardDescription className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-4" />
                            {format(request.createdAt, 'MMM dd, yyyy')}
                          </span>
                          <Badge className={categoryColors[request.category]}>
                            {request.category}
                          </Badge>
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{request.status}</Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))
          )}
        </div>
      </div>

      <Dialog open={!!selectedReading} onOpenChange={() => setSelectedReading(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedReading && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="size-5" />
                  Your Tarot Reading
                </DialogTitle>
                <DialogDescription>
                  Read by {selectedReading.readerName} on{' '}
                  {format(selectedReading.createdAt, 'MMMM dd, yyyy')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-3">Cards Drawn:</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedReading.cardsDrawn.map((card, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm">
                        {idx + 1}. {card}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedReading.cardSpreadImage && (
                  <div>
                    <h3 className="font-medium mb-3">Card Spread:</h3>
                    <img
                      src={selectedReading.cardSpreadImage}
                      alt="Card spread"
                      className="w-full rounded-lg border"
                    />
                  </div>
                )}

                <div>
                  <h3 className="font-medium mb-3">Your Reading:</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedReading.harmonizedReading}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium mb-3">AI Insights ({selectedReading.aiReadings.length} agents):</h3>
                  <div className="space-y-2">
                    {selectedReading.aiReadings.map((ai, idx) => (
                      <Card key={idx}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{ai.agentName}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{ai.interpretation}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
