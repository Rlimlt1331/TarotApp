import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TarotProvider } from './context/TarotContext';
import { AuthProvider } from './context/AuthContext';
import { Navigation } from './components/Navigation';
import { RequesterPortal } from './components/RequesterPortal';
import { ReaderPortal } from './components/ReaderPortal';
import { MyReadings } from './components/MyReadings';
import { UserProfile } from './components/UserProfile';
import { PrivateRoute, AdminRoute } from './components/ProtectedRoutes';
import { Toaster } from './components/ui/sonner';

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
                  <Route path="/" element={<Navigate to="/request" replace />} />
                  <Route path="/request" element={<RequesterPortal />} />
                  <Route
                    path="/my-readings"
                    element={
                      <PrivateRoute>
                        <MyReadings />
                      </PrivateRoute>
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