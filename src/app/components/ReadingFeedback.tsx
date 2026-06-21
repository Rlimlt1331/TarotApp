import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { API_URL } from '../config/api';

interface Feedback {
  id: number;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

interface ReadingFeedbackProps {
  submissionId: number;
}

export const ReadingFeedback: React.FC<ReadingFeedbackProps> = ({ submissionId }) => {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      fetchFeedback();
    }
  }, [submissionId, token]);

  const fetchFeedback = async () => {
    try {
      const response = await fetch(
        `${API_URL}/submissions/${submissionId}/feedback`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setFeedback(data);
          setRating(data.rating);
          setComment(data.comment || '');
        }
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    if (!rating) {
      toast.error('Please select a rating');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/submissions/${submissionId}/feedback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rating, comment }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFeedback(data);
        toast.success('Feedback saved successfully!');
      } else {
        throw new Error('Failed to save feedback');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!feedback) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/submissions/${submissionId}/feedback`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        setFeedback(null);
        setRating(0);
        setComment('');
        toast.success('Feedback deleted');
      } else {
        throw new Error('Failed to delete feedback');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete feedback');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div>Loading feedback...</div>;
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="font-semibold">Your Feedback</h3>

      <div>
        <label className="block text-sm font-medium mb-2">Accuracy Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-colors"
            >
              <Star
                size={24}
                className={
                  star <= (hoveredRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }
              />
            </button>
          ))}
        </div>
        {rating > 0 && <p className="text-sm text-gray-600 mt-1">{rating} out of 5</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Comments</label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts on the accuracy of this reading..."
          rows={4}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={loading} className="flex-1">
          {feedback ? 'Update Feedback' : 'Submit Feedback'}
        </Button>
        {feedback && (
          <Button
            onClick={handleDelete}
            disabled={loading}
            variant="destructive"
          >
            Delete
          </Button>
        )}
      </div>

      {feedback && (
        <div className="bg-gray-50 p-3 rounded text-sm">
          <p className="text-gray-600">
            Last updated: {new Date(feedback.updatedAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
};
