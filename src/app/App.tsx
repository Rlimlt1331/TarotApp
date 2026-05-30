import { ReactNode, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TarotProvider } from './context/TarotContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { Navigation } from './components/Navigation';
import { RequesterPortal } from './components/RequesterPortal';
import { ReaderPortal } from './components/ReaderPortal';
import { MyReadings } from './components/MyReadings';
import { UserProfile } from './components/UserProfile';
import { PrivateRoute, AdminRoute } from './components/ProtectedRoutes';
import { Toaster } from './components/ui/sonner';

function HomeRedirect() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <Navigate to={isAdmin ? '/reader' : '/request'} replace />;
}

function RequesterOnlyRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAdmin) {
    return <Navigate to="/reader" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  return (
    <AuthProvider>
      <TarotProvider>
        <BrowserRouter>
          <div className="size-full min-h-screen bg-background">
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
                        <RequesterPortal />
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
                    path="/reader"
                    element={
                      <AdminRoute>
                        <ReaderPortal />
                      </AdminRoute>
                    }
                  />
                </Routes>
              </>
            )}
            <Toaster />
          </div>
        </BrowserRouter>
      </TarotProvider>
    </AuthProvider>
  );
}
