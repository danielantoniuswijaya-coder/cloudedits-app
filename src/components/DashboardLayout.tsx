import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Project, UserProfile, ProjectStatus } from '../types';
import EditorDashboard from './EditorDashboard';
import ClientDashboard from './ClientDashboard';
import VideoWorkspace from './VideoWorkspace';
import { Video, LogOut, User, Sparkles, Layers } from 'lucide-react';

interface DashboardLayoutProps {
  currentUser: UserProfile;
  onLogOut: () => void;
}

export default function DashboardLayout({ currentUser, onLogOut }: DashboardLayoutProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to all projects in real-time
  useEffect(() => {
    const projectsRef = collection(db, 'projects');
    
    // Sort in-memory helper to avoid requiring complex combined indices on Firestore
    const sortAndSync = (items: Project[]) => {
      items.sort((a, b) => {
        let dateA = 0;
        if (a.createdAt) {
          if (a.createdAt instanceof Date) {
            dateA = a.createdAt.getTime();
          } else if (typeof a.createdAt === 'object' && 'toDate' in a.createdAt && typeof (a.createdAt as any).toDate === 'function') {
            dateA = (a.createdAt as any).toDate().getTime();
          } else if (typeof a.createdAt === 'object' && 'seconds' in a.createdAt) {
            dateA = (a.createdAt as any).seconds * 1000;
          } else {
            dateA = new Date(a.createdAt as any).getTime();
          }
        }
        
        let dateB = 0;
        if (b.createdAt) {
          if (b.createdAt instanceof Date) {
            dateB = b.createdAt.getTime();
          } else if (typeof b.createdAt === 'object' && 'toDate' in b.createdAt && typeof (b.createdAt as any).toDate === 'function') {
            dateB = (b.createdAt as any).toDate().getTime();
          } else if (typeof b.createdAt === 'object' && 'seconds' in b.createdAt) {
            dateB = (b.createdAt as any).seconds * 1000;
          } else {
            dateB = new Date(b.createdAt as any).getTime();
          }
        }
        return dateB - dateA;
      });

      setProjects(items);
      setLoading(false);

      if (selectedProject) {
        const updated = items.find(p => p.id === selectedProject.id);
        if (updated) {
          setSelectedProject(updated);
        }
      }
    };

    if (currentUser.role === 'Client') {
      const q = query(projectsRef, where('ownerId', '==', currentUser.uid));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items: Project[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as Project);
        });
        sortAndSync(items);
      }, (error) => {
        console.error("Gagal mengambil data proyek klien:", error);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Editor registers two snapshot observers (my projects & open pending ones)
      let activeProjects: Project[] = [];
      let pendingProjects: Project[] = [];

      const updateAllProjects = (activeList: Project[], pendingList: Project[]) => {
        const map = new Map<string, Project>();
        activeList.forEach(p => map.set(p.id, p));
        pendingList.forEach(p => map.set(p.id, p));
        sortAndSync(Array.from(map.values()));
      };

      const qActive = query(projectsRef, where('editorId', '==', currentUser.uid));
      const unsubscribeActive = onSnapshot(qActive, (snapshot) => {
        const items: Project[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as Project);
        });
        activeProjects = items;
        updateAllProjects(activeProjects, pendingProjects);
      }, (error) => {
        console.error("Gagal berlangganan proyek aktif editor:", error);
        updateAllProjects(activeProjects, pendingProjects);
      });

      const qPending = query(projectsRef, where('status', '==', 'Pending'));
      const unsubscribePending = onSnapshot(qPending, (snapshot) => {
        const items: Project[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as Project);
        });
        pendingProjects = items;
        updateAllProjects(activeProjects, pendingProjects);
      }, (error) => {
        console.error("Gagal berlangganan disk diskusi pending:", error);
        updateAllProjects(activeProjects, pendingProjects);
      });

      return () => {
        unsubscribeActive();
        unsubscribePending();
      };
    }
  }, [currentUser.uid, currentUser.role, selectedProject?.id]);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
  };

  const handleBackToDashboard = () => {
    setSelectedProject(null);
  };

  const handleUpdateStatus = async (newStatus: ProjectStatus) => {
    if (!selectedProject) return;
    try {
      const projectRef = doc(db, 'projects', selectedProject.id);
      await updateDoc(projectRef, {
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${selectedProject.id}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onLogOut();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 flex flex-col font-sans">
      
      {/* SaaS Dashboard Navigation Bar - Premium Bento Grid Navigation Header */}
      <nav className="bg-[#0f0f0f]/95 border-b border-white/10 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleBackToDashboard}>
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/20">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider text-white uppercase flex items-center gap-1.5">
              CloudEdits
              <span className="bg-indigo-500/10 text-indigo-400 text-[8px] px-1.5 py-0.2 rounded border border-indigo-500/20 uppercase font-bold tracking-widest hidden sm:inline-block">SaaS Workspace</span>
            </h1>
          </div>
        </div>

        {/* Profile Card & Log Out */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-left hidden sm:flex">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-300 font-bold border border-white/10">
              <User className="w-4 h-4 text-slate-400" />
            </div>
            
            <div className="text-xs">
              <span className="font-bold text-white block max-w-[100px] truncate">{currentUser.name}</span>
              <span className="text-[9px] text-indigo-400 font-medium tracking-wide uppercase block">
                {currentUser.role} • {currentUser.subscription}
              </span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="p-2.5 bg-white/5 border border-white/10 hover:bg-red-955/35 hover:text-red-400 rounded-xl text-slate-400 transition-all active:scale-95 flex items-center gap-1.5"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-semibold hidden md:inline">Log Out</span>
          </button>
        </div>

      </nav>

      {/* Main Container Dashboard */}
      <main className="flex-1 overflow-hidden">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center p-10 space-y-4">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-zinc-500">Menghubungkan ke pusat CloudEdits...</p>
          </div>
        ) : selectedProject ? (
          <VideoWorkspace
            project={selectedProject}
            currentUser={currentUser}
            onBack={handleBackToDashboard}
            onStatusChange={handleUpdateStatus}
          />
        ) : (
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            {currentUser.role === 'Editor' ? (
              <EditorDashboard
                projects={projects}
                currentUser={currentUser}
                onSelectProject={handleSelectProject}
              />
            ) : (
              <ClientDashboard
                projects={projects}
                currentUser={currentUser}
                onSelectProject={handleSelectProject}
              />
            )}
          </div>
        )}
      </main>

    </div>
  );
}
