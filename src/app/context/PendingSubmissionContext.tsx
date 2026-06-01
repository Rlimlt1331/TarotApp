import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface PendingSubmission {
  readingData: {
    requestId: number;
    readerId: string;
    readerName: string;
    cardSpreadImage?: string;
    cardsDrawn: string[];
    aiReadings: Array<{
      agentName: string;
      interpretation: string;
      confidence: number;
    }>;
    harmonizedReading: string;
  };
  timestamp: number;
}

interface PendingSubmissionContextType {
  pendingSubmission: PendingSubmission | null;
  setPendingSubmission: (submission: PendingSubmission | null) => void;
  clearPendingSubmission: () => void;
}

const PendingSubmissionContext = createContext<PendingSubmissionContextType | undefined>(undefined);

export const PendingSubmissionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission | null>(null);

  const clearPendingSubmission = () => {
    setPendingSubmission(null);
  };

  return (
    <PendingSubmissionContext.Provider
      value={{
        pendingSubmission,
        setPendingSubmission,
        clearPendingSubmission,
      }}
    >
      {children}
    </PendingSubmissionContext.Provider>
  );
};

export const usePendingSubmission = () => {
  const context = useContext(PendingSubmissionContext);
  if (!context) {
    throw new Error('usePendingSubmission must be used within PendingSubmissionProvider');
  }
  return context;
};
