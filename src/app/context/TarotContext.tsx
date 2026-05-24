import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, ReadingRequest, Reading, ReadingCategory, Gender } from '../types';

interface TarotContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isReader: boolean;
  setIsReader: (isReader: boolean) => void;
  requests: ReadingRequest[];
  readings: Reading[];
  addRequest: (request: Omit<ReadingRequest, 'id' | 'createdAt' | 'status'>) => void;
  addReading: (reading: Omit<Reading, 'id' | 'createdAt'>) => void;
  updateRequestStatus: (requestId: string, status: ReadingRequest['status']) => void;
}

const TarotContext = createContext<TarotContextType | undefined>(undefined);

export function TarotProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>({
    id: 'user-1',
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    horoscope: 'Pisces',
    country: 'United States',
    gender: 'female',
    readingsCount: 0,
  });

  const [isReader, setIsReader] = useState(false);
  const [requests, setRequests] = useState<ReadingRequest[]>([
    {
      id: 'req-1',
      userId: 'user-2',
      userName: 'Michael Chen',
      category: 'career',
      question: 'Should I change my current job?',
      userInfo: {
        horoscope: 'Leo',
        country: 'Singapore',
        gender: 'male',
        occupation: 'Software Engineer',
      },
      status: 'pending',
      createdAt: new Date('2026-05-23T10:30:00'),
      isFreeReading: true,
    },
    {
      id: 'req-2',
      userId: 'user-3',
      userName: 'Emma Williams',
      category: 'relationships',
      question: 'What does my romantic future hold?',
      userInfo: {
        horoscope: 'Taurus',
        country: 'United Kingdom',
        gender: 'female',
        occupation: 'Marketing Manager',
      },
      status: 'pending',
      createdAt: new Date('2026-05-23T14:15:00'),
      isFreeReading: false,
    },
  ]);

  const [readings, setReadings] = useState<Reading[]>([]);

  const addRequest = (request: Omit<ReadingRequest, 'id' | 'createdAt' | 'status'>) => {
    const newRequest: ReadingRequest = {
      ...request,
      id: `req-${Date.now()}`,
      status: 'pending',
      createdAt: new Date(),
    };
    setRequests([...requests, newRequest]);

    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        readingsCount: currentUser.readingsCount + 1,
      });
    }
  };

  const addReading = (reading: Omit<Reading, 'id' | 'createdAt'>) => {
    const newReading: Reading = {
      ...reading,
      id: `reading-${Date.now()}`,
      createdAt: new Date(),
    };
    setReadings([...readings, newReading]);
    updateRequestStatus(reading.requestId, 'completed');
  };

  const updateRequestStatus = (requestId: string, status: ReadingRequest['status']) => {
    setRequests(requests.map(req =>
      req.id === requestId
        ? { ...req, status, ...(status === 'completed' ? { completedAt: new Date() } : {}) }
        : req
    ));
  };

  return (
    <TarotContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isReader,
        setIsReader,
        requests,
        readings,
        addRequest,
        addReading,
        updateRequestStatus,
      }}
    >
      {children}
    </TarotContext.Provider>
  );
}

export function useTarot() {
  const context = useContext(TarotContext);
  if (context === undefined) {
    throw new Error('useTarot must be used within a TarotProvider');
  }
  return context;
}
