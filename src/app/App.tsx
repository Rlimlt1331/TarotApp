import { ReactNode, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PendingSubmissionProvider, usePendingSubmission } from './context/PendingSubmissionContext';
import { useAuth } from './context/AuthContext';
import { Navigation } from './components/Navigation';
import { RequesterPortal } from './components/RequesterPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { MyReadings } from './components/MyReadings';
import { GemHistory } from './components/GemHistory';
import { UserProfile } from './components/UserProfile';
import { AuthModal } from './components/AuthModal';
import { PrivateRoute, AdminRoute } from './components/ProtectedRoutes';
import { Toaster } from './components/ui/sonner';

function HomeRedirect() {
  const { isAdmin, isReader, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <Navigate to={(isAdmin || isReader) ? '/reader' : '/request'} replace />;
}

function RequesterOnlyRoute({ children }: { children: ReactNode }) {
  const { isAdmin, isReader, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAdmin || isReader) {
    return <Navigate to="/reader" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user } = useAuth();
  const { pendingSubmission } = usePendingSubmission();

  useEffect(() => {
    if (user && pendingSubmission) {
      setShowAuthModal(false);
    }
  }, [user, pendingSubmission]);

  const handleShowAuthModal = () => {
    setShowAuthModal(true);
  };

  return (
    <div className="size-full min-h-screen">
      {showProfileSetup ? (
        <UserProfile onComplete={() => setShowProfileSetup(false)} />
      ) : (
        <>
          <Navigation onEditProfile={() => setShowProfileSetup(true)} />
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route
              path="/request"
              element={
                <RequesterOnlyRoute>
                  <RequesterPortal onShowAuthModal={handleShowAuthModal} />
                </RequesterOnlyRoute>
              }
            />
            <Route
              path="/my-readings"
              element={
                <RequesterOnlyRoute>
                  <PrivateRoute>
                  <MyReadings />
                  </PrivateRoute>
                </RequesterOnlyRoute>
              }
            />
            <Route
              path="/gem-history"
              element={
                <RequesterOnlyRoute>
                  <PrivateRoute>
                    <GemHistory />
                  </PrivateRoute>
                </RequesterOnlyRoute>
              }
            />
            <Route
              path="/reader"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
          </Routes>
          <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
        </>
      )}
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PendingSubmissionProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </PendingSubmissionProvider>
    </AuthProvider>
  );
}
