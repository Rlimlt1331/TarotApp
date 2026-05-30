import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ReadingFeedback } from './ReadingFeedback';

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

export const AdminDashboard: React.FC = () => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchSubmissions();
  }, [token]);

  const fetchSubmissions = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/readings/admin/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setReadings(data);
      } else {
        throw new Error('Failed to fetch submissions');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (selectedReading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button onClick={() => setSelectedReading(null)} className="mb-4">
          ← Back to Submissions
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{selectedReading.title}</CardTitle>
            <CardDescription className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <User className="size-4" />
                {selectedReading.user.name} ({selectedReading.user.email})
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-4" />
                {format(new Date(selectedReading.createdAt), 'MMM dd, yyyy HH:mm')}
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Cards in Reading</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {selectedReading.cards.map((card) => (
                  <div key={card.id} className="text-center p-3 border rounded-lg">
                    <p className="font-medium text-sm">{card.name}</p>
                    <p className="text-xs text-gray-600">{card.position}</p>
                    {card.meaning && (
                      <p className="text-xs text-gray-500 mt-1">{card.meaning}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Interpretation</h3>
              <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm">
                {selectedReading.interpretation}
              </div>
            </div>

            {selectedReading.feedbacks.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">User Feedback</h3>
                {selectedReading.feedbacks.map((feedback) => (
                  <div key={feedback.id} className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={i < feedback.rating ? 'text-yellow-400' : 'text-gray-300'}
                        >
                          ★
                        </span>
                      ))}
                      <span className="text-sm text-gray-600">
                        ({feedback.rating}/5)
                      </span>
                    </div>
                    {feedback.comment && (
                      <p className="text-sm text-gray-700">{feedback.comment}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {format(new Date(feedback.createdAt), 'MMM dd, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">
          Viewing {readings.length} submission{readings.length !== 1 ? 's' : ''}
        </p>
      </div>

      {readings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No submissions yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {readings.map((reading) => (
            <Card
              key={reading.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedReading(reading)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="size-5" />
                      {reading.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span>{reading.user.name}</span>
                      <span className="text-xs">
                        {format(new Date(reading.createdAt), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </CardDescription>
                  </div>
                  {reading.feedbacks.length > 0 && (
                    <Badge variant="secondary">
                      {reading.feedbacks.length} feedback
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {reading.interpretation}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reading.cards.map((card) => (
                    <Badge key={card.id} variant="outline">
                      {card.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
