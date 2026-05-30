import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useTarot } from '../context/TarotContext';
import { useAuth } from '../context/AuthContext';
import { ReadingRequest } from '../types';
import { Calendar, User, MapPin, Star, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { PerformReading } from './PerformReading';
import { AdminDashboard } from './AdminDashboard';

export function ReaderPortal() {
  const { requests } = useTarot();
  const { isAdmin } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<ReadingRequest | null>(null);

  // If user is admin, show the admin dashboard
  if (isAdmin) {
    return <AdminDashboard />;
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processingRequests = requests.filter(r => r.status === 'processing');
  const completedRequests = requests.filter(r => r.status === 'completed');

  if (selectedRequest) {
    return <PerformReading request={selectedRequest} onBack={() => setSelectedRequest(null)} />;
  }

  const categoryColors = {
    relationships: 'bg-pink-500/10 text-pink-700 border-pink-200',
    career: 'bg-blue-500/10 text-blue-700 border-blue-200',
    health: 'bg-green-500/10 text-green-700 border-green-200',
  };

  const renderRequestCard = (request: ReadingRequest) => (
    <Card key={request.id} className="tarot-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              {request.userName}
              {request.isFreeReading && (
                <Badge variant="secondary" className="ml-2">
                  <Sparkles className="size-3 mr-1" />
                  Free Reading
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="size-4" />
                {format(request.createdAt, 'MMM dd, yyyy HH:mm')}
              </span>
              <Badge className={categoryColors[request.category]}>
                {request.category}
              </Badge>
            </CardDescription>
          </div>
          <Badge
            variant={
              request.status === 'pending' ? 'outline' :
              request.status === 'processing' ? 'default' : 'secondary'
            }
          >
            {request.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium mb-2">Question:</p>
          <p className="text-muted-foreground italic">"{request.question}"</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Star className="size-4 text-muted-foreground" />
            <span>{request.userInfo.horoscope}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            <span>{request.userInfo.country}</span>
          </div>
          {request.userInfo.occupation && (
            <div className="flex items-center gap-2 col-span-2">
              <span className="text-muted-foreground">Occupation:</span>
              <span>{request.userInfo.occupation}</span>
            </div>
          )}
        </div>

        {request.userInfo.additionalNotes && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-1">Additional Notes:</p>
            <p className="text-sm text-muted-foreground">{request.userInfo.additionalNotes}</p>
          </div>
        )}

        {request.status === 'pending' && (
          <Button
            onClick={() => setSelectedRequest(request)}
            className="w-full"
          >
            Start Reading
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen p-6 mystical-gradient-subtle">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4 py-8">
          <h1 className="text-5xl gradient-text font-bold">Tarot Reader Portal</h1>
          <p className="text-lg text-muted-foreground">
            Review requests and provide insightful readings
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="tarot-card bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-amber-900 dark:text-amber-100">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-600">{pendingRequests.length}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-blue-900 dark:text-blue-100">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600">{processingRequests.length}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900 dark:text-green-100">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{completedRequests.length}</div>
            </CardContent>
          </Card>
        </div>

        {pendingRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl">Pending Requests</h2>
            <div className="grid gap-4">
              {pendingRequests.map(renderRequestCard)}
            </div>
          </div>
        )}

        {processingRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl">In Progress</h2>
            <div className="grid gap-4">
              {processingRequests.map(renderRequestCard)}
            </div>
          </div>
        )}

        {completedRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl">Completed</h2>
            <div className="grid gap-4">
              {completedRequests.map(renderRequestCard)}
            </div>
          </div>
        )}

        {requests.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No reading requests yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
