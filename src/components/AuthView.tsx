import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Video, Shield, User, Check, Sparkles, LogIn, Clock, MessageSquare, Film, Layers, CheckCircle, Zap, ShieldAlert, FileText, ArrowRight, UploadCloud, PlayCircle, HelpCircle, Users, Award, ChevronRight, Mail, Lock } from 'lucide-react';
import { UserRole, SubscriptionPlan, UserProfile } from '../types';

interface AuthViewProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

interface ErrorConfig {
  code: string;
  message: string;
  title: string;
  solutionSteps: string[];
  isIframeIssue: boolean;
  requiredDomains?: string[];
}

export default function AuthView({ onAuthSuccess }: AuthViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorConfig, setErrorConfig] = useState<ErrorConfig | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(text);
    setTimeout(() => setCopiedLabel(null), 2000);
  };
  
  // Phase 2: Role and Plan Selection if User profile does not exist
  const [tempUser, setTempUser] = useState<{ uid: string; email: string; name: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Client');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('Starter');

  // Email/Password Auth State
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('email');
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Sync check: If session user exists but profile is missing, directly show complete profile setup
  React.useEffect(() => {
    const checkSessionAndSync = async () => {
      const activeUser = auth.currentUser;
      if (activeUser && !tempUser) {
        try {
          const userDocRef = doc(db, 'users', activeUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            onAuthSuccess(userSnap.data() as UserProfile);
          } else {
            setTempUser({
              uid: activeUser.uid,
              email: activeUser.email || '',
              name: activeUser.displayName || activeUser.email?.split('@')[0] || 'User'
            });
          }
        } catch (err) {
          console.error("Gagal menyinkronkan sesi aktif:", err);
        }
      }
    };
    checkSessionAndSync();
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email dan password harus diisi.');
      return;
    }
    setLoading(true);
    setError(null);
    setErrorConfig(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (result.user) {
        const uid = result.user.uid;
        // Check Firestore user table
        const userDocRef = doc(db, 'users', uid);
        let userSnap;
        try {
          userSnap = await getDoc(userDocRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${uid}`);
          return;
        }

        if (userSnap && userSnap.exists()) {
          onAuthSuccess(userSnap.data() as UserProfile);
        } else {
          // Send to Setup Profile
          setTempUser({
            uid,
            email: result.user.email || email,
            name: result.user.displayName || email.split('@')[0]
          });
        }
      }
    } catch (err: any) {
      console.error("Firebase Email Sign In Error:", err);
      const code = err?.code || 'unknown';
      let friendlyMessage = 'Gagal masuk. Periksa kembali email dan password Anda.';
      
      if (code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        friendlyMessage = 'Email atau password salah. Silakan coba lagi.';
      } else if (code === 'auth/invalid-email') {
        friendlyMessage = 'Format alamat email tidak valid.';
      } else if (code === 'auth/user-disabled') {
        friendlyMessage = 'Akun ini telah dinonaktifkan.';
      } else if (code === 'auth/too-many-requests') {
        friendlyMessage = 'Terlalu banyak percobaan masuk yang gagal. Silakan coba lagi nanti.';
      } else if (code === 'auth/operation-not-allowed') {
        const title = 'Provider Email/Password Belum Aktif';
        const message = 'Metode masuk menggunakan Email & Password saat ini belum diaktifkan di dalam Firebase Console Anda.';
        const solutionSteps = [
          'Buka Firebase Console (https://console.firebase.google.com) dan pilih proyek Firebase Anda.',
          'Masuk ke menu Authentication (di samping kiri) -> klik tab "Sign-in method".',
          'Klik tombol "Add new provider" (atau aktifkan provider yang sudah ada), pilih "Email/Password".',
          'Pastikan toggle "Email/Password" dalam keadaan AKTIF (Enable), lalu klik tombol "Save".',
          'Segarkan (refresh) aplikasi ini dan coba log in kembali.'
        ];
        setError(message);
        setErrorConfig({
          code,
          message,
          title,
          solutionSteps,
          isIframeIssue: false
        });
        return;
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email || !password) {
      setError('Semua bidang harus diisi.');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal harus terdiri dari 6 karakter.');
      return;
    }
    setLoading(true);
    setError(null);
    setErrorConfig(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        try {
          await updateProfile(result.user, { displayName: fullName });
        } catch (updateErr) {
          console.warn("Gagal memperbarui display name auth:", updateErr);
        }
        
        // Go to Setup Profile
        setTempUser({
          uid: result.user.uid,
          email: result.user.email || email,
          name: fullName
        });
      }
    } catch (err: any) {
      console.error("Firebase Email Sign Up Error:", err);
      const code = err?.code || 'unknown';
      let friendlyMessage = 'Gagal mendaftar akun baru.';
      
      if (code === 'auth/email-already-in-use') {
        friendlyMessage = 'Alamat email ini sudah terdaftar. Silakan pilih menu Masuk.';
      } else if (code === 'auth/invalid-email') {
        friendlyMessage = 'Format alamat email tidak valid.';
      } else if (code === 'auth/weak-password') {
        friendlyMessage = 'Password terlalu lemah. Password minimal harus terdiri dari 6 karakter.';
      } else if (code === 'auth/operation-not-allowed') {
        const title = 'Provider Email/Password Belum Aktif';
        const message = 'Metode pendaftaran menggunakan Email & Password saat ini belum diaktifkan di dalam Firebase Console Anda.';
        const solutionSteps = [
          'Buka Firebase Console (https://console.firebase.google.com) dan pilih proyek Firebase Anda.',
          'Masuk ke menu Authentication (di samping kiri) -> klik tab "Sign-in method".',
          'Klik tombol "Add new provider" (atau aktifkan provider yang sudah ada), pilih "Email/Password".',
          'Pastikan toggle "Email/Password" dalam keadaan AKTIF (Enable), lalu klik tombol "Save".',
          'Segarkan (refresh) aplikasi ini dan coba mendaftar ulang.'
        ];
        setError(message);
        setErrorConfig({
          code,
          message,
          title,
          solutionSteps,
          isIframeIssue: false
        });
        return;
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setErrorConfig(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const uid = result.user.uid;
        const email = result.user.email || '';
        const name = result.user.displayName || 'User';

        // Check Firestore user table
        const userDocRef = doc(db, 'users', uid);
        let userSnap;
        try {
          userSnap = await getDoc(userDocRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${uid}`);
          return;
        }

        if (userSnap && userSnap.exists()) {
          // User already exists, proceed to dashboard
          onAuthSuccess(userSnap.data() as UserProfile);
        } else {
          // New user, show role and plan completion screen
          setTempUser({ uid, email, name });
        }
      }
    } catch (err: any) {
      console.error("Firebase Login Error details:", err);
      const code = err?.code || 'unknown';
      const rawMessage = err?.message || String(err);
      const isInIframe = window.self !== window.top;
      
      let isIframe = isInIframe;
      let title = 'Login Gagal';
      let message = 'Terjadi kesalahan saat otentikasi dengan akun Google.';
      let solutionSteps: string[] = [
        'Silakan buka aplikasi di tab baru jika Anda menggunakan preview tersemat.',
        'Klik tombol login lagi untuk mencoba ulang.'
      ];
      let requiredDomains: string[] = [];

      if (
        code === 'auth/web-storage-unsupported' || 
        code === 'auth/operation-not-supported-in-this-environment' ||
        rawMessage.includes('storage') || 
        rawMessage.includes('iframe')
      ) {
        isIframe = true;
        title = 'Browser Memblokir Penyimpanan (Cookie)';
        message = 'Browser Anda memblokir penulisan cookie / storage pihak ketiga karena aplikasi saat ini berjalan di dalam Iframe preview AI Studio.';
        solutionSteps = [
          'Gunakan tombol "Buka di Tab Baru" di bawah ini. Login di tab baru bebas dari pembatasan iframe.',
          'Buka pengaturan browser Anda, lalu aktifkan "Allow third-party cookies" untuk domain ini.',
          'Gunakan browser Chrome, Edge, atau Firefox versi desktop terbaru.'
        ];
      } else if (code === 'auth/popup-blocked') {
        isIframe = true;
        title = 'Pop-up Diblokir Browser';
        message = 'Browser mendeteksi dan memblokir pop-up jendela Google login.';
        solutionSteps = [
          'Klik tombol "Buka di Tab Baru" di bawah ini agar login berjalan tanpa pop-up blocker.',
          'Periksa sudut kanan atas address bar browser Anda, klik ikon pop-up dan pilih "Selalu izinkan pop-up (Always allow popups)".',
          'Kemudian klik tombol "Masuk dengan Akun Google" kembali.'
        ];
      } else if (code === 'auth/unauthorized-domain' || rawMessage.includes('unauthorized-domain') || rawMessage.includes('authDomain')) {
        title = 'Domain Belum Diizinkan (Unauthorized Domain)';
        message = 'Domain preview aktif saat ini belum didaftarkan di dalam daftar "Authorized Domains" Firebase Console Anda.';
        requiredDomains = [
          window.location.hostname,
          'ais-dev-xoe4crn5oymlq3k6ax25y2-766227357127.asia-east1.run.app',
          'ais-pre-xoe4crn5oymlq3k6ax25y2-766227357127.asia-east1.run.app'
        ];
        solutionSteps = [
          'Buka Firebase Console (https://console.firebase.google.com) dan pilih proyek Firebase Anda.',
          'Masuk ke menu Authentication (samping kiri) -> klik tab Settings -> pilih menu samping "Authorized domains".',
          'Klik tombol "Add domain", lalu masukkan & simpan nama host (domain) di bawah satu per satu.',
          'Segarkan (refresh) halaman aplikasi ini, lalu klik Google Login kembali.'
        ];
      } else if (code === 'auth/popup-closed-by-user') {
        title = 'Popup Ditutup';
        message = 'Proses masuk dihentikan karena jendela masuk Google ditutup sebelum selesai.';
        solutionSteps = [
          'Klik tombol Google Login untuk membuka kembali jendela otentikasi.',
          'Pastikan Anda menyelesaikan langkah-langkah login di dalam pop-up tersebut.'
        ];
      } else {
        setError(rawMessage);
      }

      setErrorConfig({
        code,
        message,
        title,
        solutionSteps,
        isIframeIssue: isIframe,
        requiredDomains: requiredDomains.length > 0 ? requiredDomains : undefined
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser) return;
    setLoading(true);
    setError(null);
    setErrorConfig(null);

    const userProfile: UserProfile = {
      uid: tempUser.uid,
      name: tempUser.name,
      email: tempUser.email,
      role: selectedRole,
      subscription: selectedRole === 'Editor' ? selectedPlan : 'Starter', // Editors must choose sub, Clients get Starter plan
      createdAt: new Date(),
    };

    try {
      const userDocRef = doc(db, 'users', tempUser.uid);
      await setDoc(userDocRef, userProfile);
      onAuthSuccess(userProfile);
    } catch (err: any) {
      console.error("Gagal menyelesaikan pendaftaran profil di Firestore:", err);
      const rawMessage = err?.message || String(err);
      const isInIframe = window.self !== window.top;
      
      let title = 'Gagal Menyimpan Profil';
      let message = 'Terjadi kesalahan saat menyimpan data profil pendaftaran Anda ke database.';
      let solutionSteps: string[] = [
        'Pastikan koneksi internet Anda stabil.',
        'Jika Anda menggunakan browser tersemat di AI Studio Preview, harap buka aplikasi di tab baru.'
      ];

      if (rawMessage.includes('permission-denied') || rawMessage.includes('Missing or insufficient permissions')) {
        title = 'Akses Database Ditolak (Permission Denied)';
        message = 'Aturan Keamanan (Firestore Security Rules) menolak pembuatan informasi pengguna.';
        solutionSteps = [
          'Pastikan Aturan Keamanan terbaru dari file `firestore.rules` telah diunggah ke Firebase Console Anda.',
          'Formulir pendaftaran memerlukan alamat email Anda sesuai data login Firebase Auth.'
        ];
      }

      setError(message);
      setErrorConfig({
        code: err?.code || 'permission-denied',
        message: message,
        title: title,
        solutionSteps: solutionSteps,
        isIframeIssue: isInIframe
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 flex flex-col items-center relative overflow-y-auto overflow-x-hidden font-sans scroll-smooth w-full">
      {/* Dynamic Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-650/10 blur-[150px] pointer-events-none" />
      <div className="absolute middle-[50%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full max-w-6xl px-6 py-5 flex items-center justify-between border-b border-white/5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/20">
            <Video className="w-5 h-5 animate-pulse" />
          </div>
          <div className="text-left">
            <h1 className="text-sm font-black tracking-wider text-white uppercase flex items-center gap-1.5">
              CloudEdits
              <span className="bg-indigo-500/10 text-indigo-400 text-[8px] px-1.5 py-0.2 rounded border border-indigo-500/20 uppercase font-bold tracking-widest hidden sm:inline-block">
                Workspace
              </span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
          <a href="#fitur" className="hover:text-white transition-colors hidden sm:inline">Fitur Utama</a>
          <span className="w-1 h-1 bg-white/10 rounded-full hidden sm:inline"></span>
          <a href="#alur" className="hover:text-white transition-colors hidden sm:inline">Cara Kerja</a>
          <span className="w-1 h-1 bg-white/10 rounded-full hidden sm:inline"></span>
          <a href="#peran" className="hover:text-white transition-colors hidden sm:inline">Peran</a>
          <span className="w-1 h-1 bg-white/10 rounded-full hidden sm:inline"></span>
          <a href="#harga" className="hover:text-white transition-colors">Harga</a>
          <span className="w-1 h-1 bg-white/10 rounded-full"></span>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
      </header>

      {/* Hero Section */}
      <div className="w-full max-w-6xl grid md:grid-cols-12 gap-8 items-center relative z-10 px-6 py-12 md:py-20 border-b border-white/5">
        
        {/* Left Side: SaaS Presentation */}
        <div className="md:col-span-7 flex flex-col justify-center space-y-6 text-left md:pr-8">
          <div className="inline-flex items-center gap-2 bg-[#141414] border border-white/10 px-3 py-1.5 rounded-full text-indigo-400 text-xs font-semibold tracking-wide w-fit">
            <Video className="w-3.5 h-3.5 animate-pulse" />
            Kolaborasikan Setiap Frame Video Secara Instan
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white uppercase leading-none">
            Review Video <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
              Lebih Cepat & Presisi.
            </span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base max-w-xl leading-relaxed">
            Hubungkan editor video profesional dengan klien dalam satu ruang kerja interaktif. Kurangi revisi bolak-balik yang memakan waktu dengan menulis umpan balik presisi tepat di timestamp video.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            <div className="bg-[#141414] p-4 rounded-2xl border border-white/5 shadow-md">
              <span className="text-indigo-400 font-extrabold text-xl block">10x</span>
              <span className="text-[11px] text-slate-400 font-medium">Revisi Lebih Efisien</span>
            </div>
            <div className="bg-[#141414] p-4 rounded-2xl border border-white/5 shadow-md">
              <span className="text-cyan-400 font-extrabold text-xl block">100%</span>
              <span className="text-[11px] text-slate-400 font-medium font-sans">Koneksi Realtime</span>
            </div>
            <div className="bg-[#141414] p-4 rounded-2xl border border-white/5 shadow-md col-span-2 lg:col-span-1">
              <span className="text-emerald-400 font-extrabold text-xl block">4K High-Fi</span>
              <span className="text-[11px] text-slate-400 font-medium font-sans">Kualitas Pratinjau Tinggi</span>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card */}
        <div className="md:col-span-12 lg:col-span-5 bg-[#141414] border border-white/10 rounded-3xl p-8 shadow-2xl relative w-full">
          <div className="absolute top-0 right-0 p-4 text-zinc-805 pointer-events-none">
            <Shield className="w-24 h-24 stroke-[0.4]" />
          </div>

          {!tempUser ? (
            /* Choose Authentication Method Card */
            <div className="relative z-10 flex flex-col justify-center h-full min-h-[350px]">
              <div className="mb-6 text-left">
                <h3 className="text-2xl font-bold text-white font-sans">Mulai Kolaborasi</h3>
                <p className="text-xs text-slate-400 mt-1">Masuk untuk mengelola proyek video Anda</p>
              </div>

              {/* Modern Auth Method Select Tabs */}
              <div className="flex bg-[#0a0a0a]/60 p-1.5 rounded-2xl mb-6 border border-white/5 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('email');
                    setError(null);
                  }}
                  className={`flex-1 text-center py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    authMethod === 'email'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Email & Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('google');
                    setError(null);
                  }}
                  className={`flex-1 text-center py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    authMethod === 'google'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.529-8 7.86-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.745-.079-1.3-.178-1.859H12.24z"/>
                  </svg>
                  Google Sign In
                </button>
              </div>

              {/* Troubleshooting Error Panel */}
              {errorConfig && (
                <div className="bg-[#1c1212] border border-red-900/30 text-left rounded-2xl p-4.5 mb-5 text-xs leading-relaxed font-sans space-y-3.5 shadow-lg">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-red-500/10 rounded-lg text-red-400 border border-red-500/20 shrink-0 mt-0.5">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-[12px]">{errorConfig.title}</h4>
                      <p className="text-slate-400 text-[10.5px] leading-relaxed">{errorConfig.message}</p>
                    </div>
                  </div>

                  {errorConfig.requiredDomains && (
                    <div className="bg-[#0c0808] p-3 rounded-xl border border-red-950/50 space-y-2">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-550 block">Salin Nama Host Ini:</span>
                      <div className="space-y-1.5 font-mono text-[10px] text-red-300">
                        {errorConfig.requiredDomains.map((domain) => (
                          <div key={domain} className="flex items-center justify-between gap-1.5 bg-[#141414]/90 p-1.5 px-2.5 rounded border border-white/5">
                            <span className="truncate select-all">{domain}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(domain)}
                              className="text-[9px] bg-indigo-500/10 hover:bg-indigo-650 hover:text-white px-2 py-0.5 rounded border border-indigo-550/25 text-indigo-400 font-semibold cursor-pointer transition-all active:scale-95 shrink-0"
                            >
                              {copiedLabel === domain ? 'Tersalin ✓' : 'Salin'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 bg-black/15 p-3 rounded-xl border border-white/5">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 block">Langkah Manual:</span>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-0.5">
                      {errorConfig.solutionSteps.map((step, idx) => (
                        <li key={idx} className="leading-relaxed pl-1"><span className="text-slate-400 font-sans">{step}</span></li>
                      ))}
                    </ol>
                  </div>

                  {/* Immediate Action Row */}
                  <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-2.5 px-3 rounded-xl transition-all duration-200 text-center text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <span>🌐 Buka di Tab Baru</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setErrorConfig(null);
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-300 px-3 py-2.5 text-center shrink-0 font-medium transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {error && !errorConfig && (
                <div className="bg-red-950/40 border border-red-900/50 text-red-300 p-3.5 rounded-xl text-xs leading-5 mb-5 text-left font-sans">
                  {error}
                </div>
              )}

              {/* Render Selected Method Form */}
              {authMethod === 'google' ? (
                <div className="space-y-5">
                  <button
                    id="btn-google-login"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-[#181818] hover:bg-neutral-800 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 border border-white/5 hover:border-white/10 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 cursor-pointer text-sm"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-indigo-400 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5 bg-white p-0.5 rounded" viewBox="0 0 24 24" fill="none">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>Masuk dengan Akun Google</span>
                      </>
                    )}
                  </button>

                  {/* Helpful Tips (New Tab button and Iframe notice) */}
                  <div className="mt-5 text-center bg-[#0a0a0a]/60 p-3.5 rounded-2xl border border-white/5 space-y-2.5">
                    <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                      💡 <strong>Kiat Pencadangan Sandbox:</strong> Jika login Google Anda gagal / mentok di browser tersemat, hal ini biasanya disebabkan oleh pembekuan cookies di dalam iframe AI Studio Preview.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="w-full bg-[#181818] hover:bg-neutral-800 text-slate-200 border border-white/5 hover:border-white/10 text-[10px] font-bold py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        🚀 Buka Aplikasi di Tab Baru
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Email/Password Auth Form */
                <form
                  onSubmit={emailMode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                  className="space-y-4 text-left font-sans"
                >
                  {/* Sub-tabs for Email Auth Mode */}
                  <div className="flex border-b border-white/5 mb-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode('signin');
                        setError(null);
                      }}
                      className={`pb-2 text-xs font-extrabold focus:outline-none transition-colors border-b-2 cursor-pointer ${
                        emailMode === 'signin'
                          ? 'border-indigo-500 text-white'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Masuk Ke Akun
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode('signup');
                        setError(null);
                      }}
                      className={`pb-2 text-xs font-extrabold focus:outline-none transition-colors border-b-2 cursor-pointer ${
                        emailMode === 'signup'
                          ? 'border-indigo-500 text-white'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Daftar Baru
                    </button>
                  </div>

                  {/* Full Name field (only for signup) */}
                  {emailMode === 'signup' && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Nama Lengkap</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Masukkan nama lengkap Anda"
                          disabled={loading}
                          className="w-full bg-[#0a0a0a] text-slate-100 placeholder-slate-700 pl-10 pr-4 py-3 rounded-xl border border-white/5 focus:border-indigo-500 transition-colors focus:outline-none text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email Field */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Alamat Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contoh@email.com"
                        disabled={loading}
                        className="w-full bg-[#0a0a0a] text-slate-100 placeholder-slate-700 pl-10 pr-4 py-3 rounded-xl border border-white/5 focus:border-indigo-500 transition-colors focus:outline-none text-xs"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••"
                        disabled={loading}
                        className="w-full bg-[#0a0a0a] text-slate-100 placeholder-slate-700 pl-10 pr-4 py-3 rounded-xl border border-white/5 focus:border-indigo-500 transition-colors focus:outline-none text-xs"
                      />
                    </div>
                    {emailMode === 'signup' && (
                      <p className="text-[9px] text-slate-500">Gunakan minimal 6 karakter.</p>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 border border-indigo-500/15 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider font-bold mt-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{emailMode === 'signin' ? 'Masuk ke Workspace' : 'Mulai Registrasi'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Role & Plan Selection Setup */
            <form onSubmit={handleCompleteSetup} className="relative z-10 space-y-6">
              <div className="text-left">
                <h3 className="text-2xl font-bold text-white">Lengkapi Profil</h3>
                <p className="text-xs text-slate-400 mt-1">Pilih peran Anda (Khusus Editor memerlukan subscription)</p>
              </div>

              {/* Role Selection */}
              <div className="space-y-2 text-left">
                <label className="text-xs text-slate-400 font-medium tracking-wide uppercase">Pilih Peran Anda</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('Client')}
                    className={`p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
                      selectedRole === 'Client'
                        ? 'bg-[#0a0a0a] border-indigo-500 text-white'
                        : 'bg-[#141414] border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <User className="w-5 h-5 mb-2 text-indigo-400" />
                    <span className="font-bold text-sm block font-sans">Klien</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Gratis Kolaborasi</span>
                    {selectedRole === 'Client' && (
                      <Check className="absolute top-3 right-3 w-4 h-4 text-indigo-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('Editor')}
                    className={`p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
                      selectedRole === 'Editor'
                        ? 'bg-[#0a0a0a] border-indigo-500 text-white'
                        : 'bg-[#141414] border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <Video className="w-5 h-5 mb-2 text-indigo-400" />
                    <span className="font-bold text-sm block font-sans">Video Editor</span>
                    <span className="text-[10px] text-indigo-400 block mt-0.5">Berlangganan Paket</span>
                    {selectedRole === 'Editor' && (
                      <Check className="absolute top-3 right-3 w-4 h-4 text-indigo-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* SaaS subscription Plan Selection (only shown for Editor) */}
              {selectedRole === 'Editor' && (
                <div className="space-y-3 text-left">
                  <label className="text-xs text-slate-400 font-medium tracking-wide uppercase block">Pilih Paket Subscription Editor</label>
                  <div className="space-y-2.5">
                    
                    {/* Starter */}
                    <div
                      onClick={() => setSelectedPlan('Starter')}
                      className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                        selectedPlan === 'Starter'
                          ? 'bg-[#0a0a0a] border-indigo-500 text-white'
                          : 'bg-[#141414] border-white/5 text-slate-400 hover:border-white/10'
                      }`}
                    >
                      <div className="text-left">
                        <span className="font-semibold text-xs text-slate-200 block font-sans">Starter Plan</span>
                        <span className="text-[10px] text-slate-400 font-sans">Maksimal 2 proyek aktif, review 1080p</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-indigo-400 font-mono block">$49/bln</span>
                        <span className="text-[9px] text-emerald-400 font-mono block">± Rp 750rb</span>
                      </div>
                    </div>

                    {/* Professional */}
                    <div
                      onClick={() => setSelectedPlan('Professional')}
                      className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                        selectedPlan === 'Professional'
                          ? 'bg-[#0a0a0a] border-indigo-500 text-white'
                          : 'bg-[#141414] border-white/5 text-slate-400 hover:border-white/10'
                      }`}
                    >
                      <div className="text-left">
                        <span className="font-semibold text-xs text-slate-200 block font-sans">Professional Plan</span>
                        <span className="text-[10px] text-slate-400 font-sans">Unlimited proyek aktif, review 4K, AI notes</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-indigo-400 font-mono block">$149/bln</span>
                        <span className="text-[9px] text-emerald-400 font-mono block">± Rp 2.25jt</span>
                      </div>
                    </div>

                    {/* Agency */}
                    <div
                      onClick={() => setSelectedPlan('Agency')}
                      className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                        selectedPlan === 'Agency'
                          ? 'bg-[#0a0a0a] border-indigo-500 text-white'
                          : 'bg-[#141414] border-white/5 text-slate-400 hover:border-white/10'
                      }`}
                    >
                      <div className="text-left">
                        <span className="font-semibold text-xs text-slate-200 block flex items-center gap-1.5 animate-pulse font-sans">
                          Agency Plan
                          <span className="bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded text-[7px] uppercase font-bold tracking-wider">Populer</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">Tim tak terbatas, storage prioritas tinggi, FrameSync</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-indigo-400 font-mono block">$399/bln</span>
                        <span className="text-[9px] text-emerald-400 font-mono block">± Rp 6jt</span>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Loading or Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Selesaikan Setup</span>
                    <Sparkles className="w-4 h-4 text-indigo-200" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Feature Section (Bento Grid) */}
      <section id="fitur" className="w-full max-w-6xl px-6 py-16 md:py-24 border-b border-white/5 relative z-10 text-left">
        <div className="text-center md:text-left mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-sans">FITUR WORKSPACE</span>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight sm:text-4xl font-sans">
            Kenapa CloudEdits Sangat Berbeda?
          </h2>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed font-sans">
            Kami membangun ruang kerja kolaborasi video berstandar industri dengan mengoptimalkan kecepatan review, keterbacaan revisi, dan kenyamanan aset.
          </p>
        </div>

        <div className="grid md:grid-cols-12 gap-5 font-sans">
          {/* Feature 1: Timestamp Commenting */}
          <div className="md:col-span-8 bg-[#141414] border border-white/5 p-6 sm:p-8 rounded-3xl flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-300">
            <div className="space-y-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 w-fit">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase font-sans">Pratinjau dengan Komentar Terikat Waktu</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-sans">
                Tandai titik pasti kesalahan langsung saat video sedang berputar. Setiap komentar dari Klien secara otomatis merekam timestamp video yang akurat (cth. 00:14) berupa titik merah fungsional pada visual scrubber sehingga Editor tidak perlu mencari-cari secara manual.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-white/5 flex flex-wrap gap-2 text-[10px] font-mono text-indigo-400">
              <span>✓ Auto-tag Timestamp</span>
              <span>•</span>
              <span>✓ Timeline Markers</span>
              <span>•</span>
              <span>✓ Jump-to-Frame Click</span>
            </div>
          </div>

          {/* Feature 2: Role Management */}
          <div className="md:col-span-4 bg-[#141414] border border-white/5 p-6 sm:p-8 rounded-3xl flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-300 font-sans">
            <div className="space-y-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 w-fit">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase font-sans">Pembagian Peran Jelas</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-sans mt-1">
                Platform memisahkan kapabilitas kerja untuk hasil terbaik. **Klien** dapat membuat feedback, memantau riwayat penyelesaian revisi, dan menyetujui hasil akhir. **Editor** memegang kendali atas update versi footage, unggah file pendukung, dan penyelesaian tugas revisi.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-[10px] font-mono text-slate-500">
              Keamanan kontrol & alur kerja terstruktur
            </div>
          </div>

          {/* Feature 3: Supports Supporting Attachments */}
          <div className="md:col-span-4 bg-[#141414] border border-white/5 p-6 sm:p-8 rounded-3xl flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-300 font-sans">
            <div className="space-y-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 w-fit">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase font-sans">Penyimpanan File Pendukung</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-sans">
                Di samping video utama, kolaborasi membutuhkan berkas penunjang seperti naskah/script wawancara, logo proyek resolusi tinggi, audio background (BG Music), atau spreadsheet storyboard. Semua dapat diunggah, disimpan, dan diunduh di ruang kerja.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-[10px] font-mono text-indigo-400">
              Simpan script & logo dalam satu proyek
            </div>
          </div>

          {/* Feature 4: Preset footage */}
          <div className="md:col-span-8 bg-[#141414] border border-white/5 p-6 sm:p-8 rounded-3xl flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-300 font-sans">
            <div className="space-y-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 w-fit">
                <Film className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase font-sans">Template Footage Pratinjau Cepat</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-sans">
                Tidak punya file video mentahan saat mendaftar? Tenang! Kami menyertakan 3 Preset Stock Footage Berkualitas Tinggi (Nature Sunset, Cyberpunk City, Retro Neon) yang langsung siap diaplikasikan dengan sekali klik demi fungsionalitas visual yang memuaskan dan praktis digunakan langsung tanpa kendala hardware.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-slate-400 font-sans">
              <span className="truncate">Sunset • Cyberpunk City • Retro Neon Synth</span>
              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-mono shrink-0">STOCK INTEGRATED</span>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section (Cara Kerja) */}
      <section id="alur" className="w-full max-w-6xl px-6 py-16 md:py-24 border-b border-white/5 relative z-10 text-left">
        <div className="text-center md:text-left mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-sans">ALUR KERJA TERPADU</span>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight sm:text-4xl font-sans">
            Bagaimana CloudEdits Bekerja?
          </h2>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed font-sans">
            Hanya butuh 4 langkah mudah dari pendaftaran hingga persetujuan kualitas video beresolusi tinggi.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 font-sans">
          {/* Step 1 */}
          <div className="bg-[#141414]/50 border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/10 transition-all">
            <div className="text-5xl font-black text-white/5 absolute top-2 right-2 group-hover:text-indigo-500/10 transition-colors pointer-events-none">01</div>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mb-4 font-mono">1</div>
            <h4 className="text-sm font-bold text-white uppercase mb-2 font-sans">Registrasi & Peran</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-sans">
              Login sekali klik menggunakan akun Google Anda yang aman lalu pilih peran Anda sebagai **Video Editor** atau **Klien**.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#141414]/50 border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/10 transition-all">
            <div className="text-5xl font-black text-white/5 absolute top-2 right-2 group-hover:text-indigo-500/10 transition-colors pointer-events-none">02</div>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mb-4 font-mono">2</div>
            <h4 className="text-sm font-bold text-white uppercase mb-2 font-sans">Inisiasi Proyek</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-sans">
              Editor atau Klien dapat langsung membuat ruang proyek baru, melengkapinya dengan deskripsi, serta memasukkan file dokumen penunjang.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#141414]/50 border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/10 transition-all">
            <div className="text-5xl font-black text-white/5 absolute top-2 right-2 group-hover:text-indigo-500/10 transition-colors pointer-events-none">03</div>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mb-4 font-mono">3</div>
            <h4 className="text-sm font-bold text-white uppercase mb-2 font-sans">Review & Kunci Frame</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-sans">
              Klien memutar draf video hasil editan, lalu menambahkan ulasan koreksi di waktu yang tepat secara presisi.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-[#141414]/50 border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/10 transition-all">
            <div className="text-5xl font-black text-white/5 absolute top-2 right-2 group-hover:text-indigo-500/10 transition-colors pointer-events-none">04</div>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mb-4 font-mono">4</div>
            <h4 className="text-sm font-bold text-white uppercase mb-2 font-sans">Persetujuan Akhir</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-sans">
              Setelah editor memperbaiki draf dan menandai revisi "Selesai", Klien dapat memberikan persetujuan akhir (Completed) untuk rilis.
            </p>
          </div>
        </div>
      </section>

      {/* Role Comparison Section */}
      <section id="peran" className="w-full max-w-6xl px-6 py-16 md:py-24 border-b border-white/5 relative z-10 text-left">
        <div className="text-center md:text-left mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-sans">DESKRIPSI PERAN</span>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight sm:text-4xl font-sans">
            Perbandingan Hak Akses Pengguna
          </h2>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed font-sans">
            Kami mendedikasikan workspace khusus yang diatur sesuai perannya untuk memastikan efisiensi kolaborasi yang maksimal.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 font-sans">
          {/* Client Role Map */}
          <div className="bg-[#141414] border border-white/5 p-6 sm:p-8 rounded-3xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-650/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                <User className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white uppercase leading-none font-sans">Sebagai Klien</h3>
                <span className="text-[10px] text-slate-500 font-mono block mt-1.5 uppercase tracking-wider">PEMILIK PROYEK & PENGAMBIL KEPUTUSAN</span>
              </div>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed font-sans">
              Klien memantau proyek dari sisi pemilik bisnis atau kreator konten yang membutuhkan video jadi. Anda mendikte kebutuhan estetika dan memeriksa draf editor.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300 font-sans">
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Membuat Proyek Baru & Mengedit Detail Nama/Deskripsi</span>
              </li>
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Menulis Catatan Kritik Frame-by-Frame di Detik Spesifik</span>
              </li>
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Mengunduh Berkas Hasil Produksi dan File Pendukung (Gratis)</span>
              </li>
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Menentukan Tombol "Setujui Hasil Akhir" ketika video dirasa sudah sempurna</span>
              </li>
            </ul>
          </div>

          {/* Editor Role Map */}
          <div className="bg-[#141414] border border-white/5 p-6 sm:p-8 rounded-3xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-650/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                <Video className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white uppercase leading-none font-sans">Sebagai Video Editor</h3>
                <span className="text-[10px] text-slate-500 font-mono block mt-1.5 uppercase tracking-wider">PELAKSANA TEKNIS & PRODUSER KREATIF</span>
              </div>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed font-sans">
              Editor bertanggung jawab membuat manipulasi b-roll, audio, warna, dan transisi. Di platform ini, Anda menyerap feedback klien dan menyelesaikannya secara taktis dengan berlangganan paket.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300 font-sans">
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Membuat Proyek Baru & Menentukan Status Proses (Pending, Editing, Revision)</span>
              </li>
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Mengunggah Berkas Video Draf Hasil Editan Versi Terbaru</span>
              </li>
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Memilih dan Beralih Paket Berlangganan SaaS (Starter, Pro, Agency)</span>
              </li>
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Membaca Serta Menandai Status "Selesai" pada Setiap Kritik Klien</span>
              </li>
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Mengelola dan Mengunggah Dokumen/Script/Audio Pendukung Proyek</span>
              </li>
              <li className="flex items-start gap-2.5 text-left">
                <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Menguji & Mendemonstrasikan Timeline Navigasi Komentar Klien</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing / Daftar Paket Harga Section */}
      <section id="harga" className="w-full max-w-6xl px-6 py-16 md:py-24 border-b border-white/5 relative z-10 text-left">
        <div className="text-center md:text-left mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-sans">PAKET & HARGA BERLANGGANAN</span>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight sm:text-4xl font-sans">
            Investasi Terbaik Hubungan Klien & Editor
          </h2>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed font-sans">
            Pendaftaran bagi pengguna Klien gratis sepenuhnya. Untuk Video Editor profesional, pilih paket langganan yang fleksibel sesuai kebutuhan volume proyek Anda.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 font-sans">
          
          {/* Card 1: Starter */}
          <div className="bg-[#141414] border border-white/5 p-6 sm:p-8 rounded-3xl flex flex-col justify-between hover:border-indigo-500/25 transition-all duration-300 relative group">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">STARTER PLAN</span>
                <h3 className="text-xl font-bold text-white uppercase font-sans mt-1">Freelancer Pemula</h3>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Cocok untuk editor lepas yang baru memulai kolaborasi terstruktur dengan sedikit klien aktif.
                </p>
              </div>

              {/* Price block */}
              <div className="py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white font-mono">$49</span>
                  <span className="text-slate-500 text-xs font-medium font-sans">/ bulan</span>
                </div>
                <div className="text-emerald-400 text-xs font-semibold font-mono mt-1">
                  ± Rp 750.000 <span className="text-[10px] text-slate-500 font-sans font-normal">/bulan</span>
                </div>
              </div>

              <div className="border-t border-white/5 my-4" />

              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Maksimal 2 proyek aktif sekaligus</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>SLA Review Video dalam format 1080p</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Komentar penanda waktu (timestamp)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Penyimpanan aset max 5 Gigabyte</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <button 
                type="button" 
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-250 cursor-pointer text-center"
              >
                Pilih Starter
              </button>
            </div>
          </div>

          {/* Card 2: Professional */}
          <div className="bg-[#141414] border-2 border-indigo-500 p-6 sm:p-8 rounded-3xl flex flex-col justify-between hover:border-indigo-400 transition-all duration-300 relative group shadow-xl shadow-indigo-600/5">
            <div className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-650 border border-indigo-500 text-white font-bold text-[8px] uppercase tracking-widest px-2.5 py-1 rounded-full font-sans shadow-md">
              REKOMENDASI
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest font-mono">PROFESSIONAL PLAN</span>
                <h3 className="text-xl font-bold text-white uppercase font-sans mt-1">Editor Profesional</h3>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Pilihan terbaik untuk editor profesional berkecepatan tinggi yang menangani banyak proyek aktif sekaligus.
                </p>
              </div>

              {/* Price block */}
              <div className="py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white font-mono">$149</span>
                  <span className="text-slate-500 text-xs font-medium font-sans">/ bulan</span>
                </div>
                <div className="text-emerald-400 text-xs font-semibold font-mono mt-1">
                  ± Rp 2.250.000 <span className="text-[10px] text-slate-500 font-sans font-normal">/bulan</span>
                </div>
              </div>

              <div className="border-t border-white/5 my-4" />

              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold text-white">Proyek Aktif Tak Terbatas (Unlimited)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>SLA Review Video resolusi Ultra-HD 4K</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Catatan AI (Smart Notes Auto-complete)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Navigasi frame-by-frame presisi tinggi</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Penyimpanan aset max 25 Gigabyte</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <button 
                type="button" 
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-center shadow-lg shadow-indigo-600/15"
              >
                Pilih Professional
              </button>
            </div>
          </div>

          {/* Card 3: Agency */}
          <div className="bg-[#141414] border border-white/5 p-6 sm:p-8 rounded-3xl flex flex-col justify-between hover:border-indigo-500/25 transition-all duration-300 relative group">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">AGENCY PLAN</span>
                <h3 className="text-xl font-bold text-white uppercase font-sans mt-1">Studio & Tim Produksi</h3>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Solusi korporat untuk tim agensi pemasaran, production house besar, dan jaringan kreator berskala tinggi.
                </p>
              </div>

              {/* Price block */}
              <div className="py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white font-mono">$399</span>
                  <span className="text-slate-500 text-xs font-medium font-sans">/ bulan</span>
                </div>
                <div className="text-emerald-400 text-xs font-semibold font-mono mt-1">
                  ± Rp 6.000.000 <span className="text-[10px] text-slate-500 font-sans font-normal">/bulan</span>
                </div>
              </div>

              <div className="border-t border-white/5 my-4" />

              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Semua kapabilitas Professional</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold text-white">Akun Tim / Kolaborator Tak Terbatas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sesi Kolaborasi Real-Time FrameSync</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Server Upload Prioritas & Bandwidth Ekstra</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Penyimpanan aset prioritas 100 Gigabyte</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <button 
                type="button" 
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-250 cursor-pointer text-center"
              >
                Pilih Agency
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="w-full max-w-6xl px-6 py-16 md:py-24 border-b border-white/5 relative z-10 text-left">
        <div className="text-center md:text-left mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-sans">PERTANYAAN UMUM</span>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight sm:text-4xl font-sans">
            FAQ Terkait Platform
          </h2>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed font-sans">
            Semua hal dasar yang perlu Anda ketahui untuk memaksimalkan CloudEdits SaaS Workspace.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 font-sans">
          <div className="bg-[#141414]/50 border border-white/5 p-6 rounded-2xl text-left">
            <h4 className="text-sm font-bold text-white uppercase mb-2 font-sans">Apakah CloudEdits gratis untuk dicoba?</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-sans mt-1">
              Ya! Masuk (login) dengan akun Google aman. Bagi Klien, platform ini gratis sepenuhnya untuk meninjau, mengunduh, dan menyetujui hasil video. Bagi Video Editor, Anda dapat memilih paket berlangganan fleksibel (Starter, Pro, Agency) guna memproses video dengan performa terbaik.
            </p>
          </div>

          <div className="bg-[#141414]/50 border border-white/5 p-6 rounded-2xl text-left">
            <h4 className="text-sm font-bold text-white uppercase mb-2 font-sans">Bagaimana cara mengunci komentar pada detik video tertentu?</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-sans mt-1">
              Cukup tahan/pause video saat memutar di ruang kerja proyek, ketik masukan revisi atau kritik Anda di kotak umpan balik di sebelah kanan timeline, lalu tekan tombol kirim. Sistem otomatis membaca detik presisi pemutar Anda.
            </p>
          </div>

          <div className="bg-[#141414]/50 border border-white/5 p-6 rounded-2xl text-left">
            <h4 className="text-sm font-bold text-white uppercase mb-2 font-sans">Apakah file pendukung aman disimpan di sini?</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-sans mt-1">
              Tentu. Kami menyimpan data dan dokumen secara terstruktur pada Firebase Cloud Firestore dengan perlindungan hak akses ketat, memastikan hanya kolaborator proyek tersebut yang berhak melihat berkas lampiran.
            </p>
          </div>

          <div className="bg-[#141414]/50 border border-white/5 p-6 rounded-2xl text-left">
            <h4 className="text-sm font-bold text-white uppercase mb-1.5 font-sans">Dapatkah satu proyek menampung banyak file pendukung?</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-sans">
              Sangat bisa. Anda dapat mengunggah file pendukung sebanyak apa pun (seperti script PDF, logo PNG transparan, dokumen brief teks, musik intro, dll.) untuk dikolektifkan bersama kemajuan video.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-6xl px-6 py-12 text-slate-500 text-xs relative z-10 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6 font-sans">
        <div className="space-y-2 text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <div className="p-1 px-1.5 bg-indigo-600 rounded text-white font-bold text-[10px]">CE</div>
            <span className="font-bold text-white uppercase tracking-wider text-[11px] font-sans">CloudEdits Workspace</span>
          </div>
          <p className="font-sans font-mono tracking-tight text-[10px]">© 2026 CloudEdits Inc. Hak Cipta Dilindungi. Dikembangkan menggunakan React & Firebase.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-medium text-slate-400 font-sans">
          <span>Otentikasi Google Terintegrasi</span>
          <span>•</span>
          <span>UI Bento Premium</span>
          <span>•</span>
          <span>Bebas HMR Glitch</span>
        </div>
      </footer>

    </div>
  );
}
