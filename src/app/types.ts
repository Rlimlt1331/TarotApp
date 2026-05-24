export type ReadingCategory = 'relationships' | 'career' | 'health';

export type ReadingStatus = 'pending' | 'processing' | 'completed';

export type Gender = 'male' | 'female' | 'prefer-not-to-say';

export interface User {
  id: string;
  name: string;
  email: string;
  horoscope: string;
  country: string;
  gender: Gender;
  dateOfBirth?: string;
  occupation?: string;
  readingsCount: number;
}

export interface ReadingRequest {
  id: string;
  userId: string;
  userName: string;
  category: ReadingCategory;
  question: string;
  userInfo: {
    horoscope: string;
    country: string;
    gender: Gender;
    dateOfBirth?: string;
    occupation?: string;
    additionalNotes?: string;
  };
  status: ReadingStatus;
  createdAt: Date;
  completedAt?: Date;
  isFreeReading: boolean;
}

export interface AIAgentReading {
  agentName: string;
  interpretation: string;
  confidence: number;
}

export interface Reading {
  id: string;
  requestId: string;
  readerId: string;
  readerName: string;
  cardSpreadImage?: string;
  cardsDrawn: string[];
  aiReadings: AIAgentReading[];
  harmonizedReading: string;
  createdAt: Date;
}

export interface SuggestedQuestion {
  category: ReadingCategory;
  question: string;
}
