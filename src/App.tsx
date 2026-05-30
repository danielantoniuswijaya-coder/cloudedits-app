import React, { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { UserProfile } from './types';
import AuthView from './components/AuthView';
import DashboardLayout from './components/DashboardLayout';

export default function App() {
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [sessionAuthUser, setSessionAuthUser] = useState<boolean>(false);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setSessionAuthUser(true);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists()) {
            setCurrentUserProfile(userSnap.data() as UserProfile);
          } else {
            // Profil belum lengkap, let AuthView guide them which sets the profile on completion
            setCurrentUserProfile(null);
          }
        } catch (error) {
          console.error("Gagal mengambil data profil:", error);
        }
      } else {
        setSessionAuthUser(false);
        setCurrentUserProfile(null);
      }
      setInitLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (profile: UserProfile) => {
    setCurrentUserProfile(profile);
  };

  const handleLogOut = () => {
    setCurrentUserProfile(null);
    setSessionAuthUser(false);
  };

  if (initLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-slate-200 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs tracking-wider text-slate-500 font-medium">Memuat Layanan CloudEdits...</p>
      </div>
    );
  }

  // If user is authenticated and has fully completed their profile setup, launch workspace dashboard.
  // Otherwise, present the marketing/auth/onboarding portal.
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-sans">
      {currentUserProfile ? (
        <DashboardLayout currentUser={currentUserProfile} onLogOut={handleLogOut} />
      ) : (
        <AuthView onAuthSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}
