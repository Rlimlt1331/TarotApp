import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

export interface PendingSubmission {
  readingData: {
    category: string;
    question: string;
    horoscope: string;
    gender: string;
  };
  timestamp: number;
}

interface PendingSubmissionContextType {
  pendingSubmission: PendingSubmission | null;
  setPendingSubmission: (submission: PendingSubmission | null) => void;
  clearPendingSubmission: () => void;
}

const STORAGE_KEY = 'tarot_pending_submission';

const PendingSubmissionContext = createContext<PendingSubmissionContextType | undefined>(undefined);

export const PendingSubmissionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pendingSubmission, setPendingSubmissionState] = useState<PendingSubmission | null>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setPendingSubmission = useCallback((submission: PendingSubmission | null) => {
    setPendingSubmissionState(submission);
    try {
      if (submission) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(submission));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* non-fatal */ }
  }, []);

  const clearPendingSubmission = useCallback(() => {
    setPendingSubmissionState(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
  }, []);

  return (
    <PendingSubmissionContext.Provider value={{ pendingSubmission, setPendingSubmission, clearPendingSubmission }}>
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
