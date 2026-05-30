import React, { useState, useEffect } from 'react';
import { Project, UserProfile, Revision } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Search, PlusCircle, ArrowUpRight, Crown, Sparkles, AlertCircle, FileVideo, Video, Eye, Check, Clock, Send, MessageSquare, X, CheckSquare, Square, CheckCircle } from 'lucide-react';

interface ClientDashboardProps {
  projects: Project[];
  currentUser: UserProfile;
  onSelectProject: (project: Project) => void;
}

const FOOTAGE_PRESETS = [
  { name: "Coffee Loop", url: "https://assets.mixkit.co/videos/preview/mixkit-pouring-hot-coffee-into-a-cup-42323-large.mp4" },
  { name: "Tokonatsu Neon", url: "https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-look-of-tokyo-streets-at-night-42261-large.mp4" }
];

export default function ClientDashboard({ projects, currentUser, onSelectProject }: ClientDashboardProps) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [initialFootageIdx, setInitialFootageIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Revision & Review states for Client Dashboard
  const [allRevisions, setAllRevisions] = useState<Record<string, Revision[]>>({});
  const [selectedProjectForRevision, setSelectedProjectForRevision] = useState<Project | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [useTimestamp, setUseTimestamp] = useState(false);
  const [timestampMinutes, setTimestampMinutes] = useState('00');
  const [timestampSeconds, setTimestampSeconds] = useState('00');
  const [submittingQuickRevision, setSubmittingQuickRevision] = useState(false);

  // Filter client's specific projects
  const clientProjects = projects.filter(p => p.ownerId === currentUser.uid);

  // Sync revisions for all client projects in real-time
  useEffect(() => {
    if (clientProjects.length === 0) return;

    const unsubscribers = clientProjects.map(proj => {
      const revRef = collection(db, 'projects', proj.id, 'revisions');
      const q = query(revRef, orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snapshot) => {
        const items: Revision[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Revision);
        });
        setAllRevisions(prev => ({
          ...prev,
          [proj.id]: items
        }));
      }, (error) => {
        console.error(`Gagal melacak revisi untuk proyek ${proj.id}:`, error);
      });
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [clientProjects.map(p => p.id).join(',')]);

  const handleAddQuickRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectForRevision || !newCommentText.trim()) return;

    setSubmittingQuickRevision(true);
    const timestampStr = useTimestamp 
      ? `${timestampMinutes.padStart(2, '0')}:${timestampSeconds.padStart(2, '0')}` 
      : 'Umum';

    const newRevision: Omit<Revision, 'id'> = {
      projectId: selectedProjectForRevision.id,
      comment: newCommentText.trim(),
      timestamp: timestampStr,
      userId: currentUser.uid,
      userName: currentUser.name,
      userRole: currentUser.role,
      status: 'open',
      createdAt: new Date()
    };

    try {
      const revisionsRef = collection(db, 'projects', selectedProjectForRevision.id, 'revisions');
      await addDoc(revisionsRef, newRevision);
      
      // Update project status to Revision automatically if Klien sends a comment
      if (selectedProjectForRevision.status === 'Editing' || selectedProjectForRevision.status === 'Completed' || selectedProjectForRevision.status === 'Pending') {
        const projRef = doc(db, 'projects', selectedProjectForRevision.id);
        await updateDoc(projRef, {
          status: 'Revision',
          updatedAt: new Date()
        });
        
        // Update local object status representation in case they change it multiple times
        setSelectedProjectForRevision(prev => prev ? { ...prev, status: 'Revision' } : null);
      }

      setNewCommentText('');
      setUseTimestamp(false);
      setTimestampMinutes('00');
      setTimestampSeconds('00');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `projects/${selectedProjectForRevision.id}/revisions`);
    } finally {
      setSubmittingQuickRevision(false);
    }
  };

  const handleToggleResolveInDashboard = async (projId: string, revision: Revision) => {
    const nextStatus = revision.status === 'open' ? 'resolved' : 'open';
    try {
      const revRef = doc(db, 'projects', projId, 'revisions', revision.id);
      await updateDoc(revRef, { status: nextStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projId}/revisions/${revision.id}`);
    }
  };

  const filteredProjects = clientProjects.filter((p) => {
    return p.name.toLowerCase().includes(search.toLowerCase()) || 
           p.editorName.toLowerCase().includes(search.toLowerCase());
  });

  // Verify subscription limits
  // Starter limit: Max 2 projects
  const activeProjectsCount = clientProjects.filter(p => p.status !== 'Completed').length;
  const isLimitReached = currentUser.subscription === 'Starter' && activeProjectsCount >= 2;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    if (isLimitReached) {
      setErrorMsg("Batas Paket Starter Terpenuhi! Silakan tingkatkan langganan Anda ke Professional atau Agency untuk membuat proyek tanpa batas.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const newProject: Omit<Project, 'id'> = {
      name: projectName.trim(),
      description: projectDesc.trim(),
      status: 'Pending',
      ownerId: currentUser.uid,
      ownerEmail: currentUser.email,
      ownerName: currentUser.name,
      editorId: '',
      editorEmail: '',
      editorName: '',
      videoUrl: FOOTAGE_PRESETS[initialFootageIdx].url, // Use preset reference as starting template
      videoName: FOOTAGE_PRESETS[initialFootageIdx].name,
      subscriptionType: currentUser.subscription,
      createdAt: new Date(),
      updatedAt: new Date(),
      attachments: []
    };

    try {
      const projectsCollection = collection(db, 'projects');
      await addDoc(projectsCollection, newProject);
      
      // Clean inputs
      setProjectName('');
      setProjectDesc('');
      setShowAddModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'projects');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* SaaS subscription Plan Banner Card - Sleek Bento Grid Banner */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 p-4 text-zinc-800 pointer-events-none opacity-10">
          <Crown className="w-40 h-40 stroke-[0.4]" />
        </div>

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border border-indigo-500/20">
            <Crown className="w-3.5 h-3.5 text-indigo-400" />
            Paket {currentUser.subscription}
          </div>
          <h2 className="text-xl font-bold text-white uppercase tracking-wide">
            {currentUser.subscription === 'Starter' ? 'Proyek Terbatas (Starter)' : 'Proyek Berlangganan Professional'}
          </h2>
          <p className="text-slate-400 text-xs max-w-xl">
            {currentUser.subscription === 'Starter' 
              ? 'Anda berada di lisensi Starter. Maksimal 2 proyek aktif sekaligus. Upgrade ke Professional untuk kolaborasi unlimited.' 
              : 'Nikmati workspace tak terbatas, review instan dengan integrasi rendering 4K, dan file attachment prioritas.'
            }
          </p>
        </div>

        <div className="relative z-10 shrink-0 flex items-center gap-3">
          <div className="bg-[#0a0a0a] border border-white/5 px-4 py-3 rounded-xl text-left">
            <span className="text-[10px] text-slate-500 font-bold block uppercase font-mono">Proyek Berjalan</span>
            <span className="text-lg font-bold text-white font-mono">
              {activeProjectsCount} <span className="text-slate-600 text-xs font-normal">/ {currentUser.subscription === 'Starter' ? '2' : '∞'}</span>
            </span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Kirim Proyek Baru</span>
          </button>
        </div>
      </div>

      {/* Main List Workspace Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Daftar Proyek Anda</h3>

        {/* Search controls */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama proyek atau editor..."
            className="w-full bg-[#141414] border border-white/10 pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Project cards grids - Styled beautifully in Bento block grid */}
        {filteredProjects.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((proj) => {
              return (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj)}
                  className="group bg-[#141414] hover:bg-[#161616] border border-white/5 hover:border-indigo-500/30 rounded-2xl p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between min-h-[260px] shadow"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        proj.status === 'Pending' ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' :
                        proj.status === 'Editing' ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' :
                        proj.status === 'Revision' ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20' :
                        'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                      }`}>
                        {proj.status}
                      </span>
                      <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    </div>

                    <div className="text-left">
                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">{proj.name}</h4>
                      <p className="text-slate-400 text-[11px] line-clamp-2 mt-1 leading-relaxed">
                        {proj.description || 'Tidak ada deskripsi'}
                      </p>
                    </div>

                    {/* Live Revision Stats on Dashboard card */}
                    {(() => {
                      const revs = allRevisions[proj.id] || [];
                      const openCount = revs.filter(r => r.status === 'open').length;
                      const resolvedCount = revs.filter(r => r.status === 'resolved').length;
                      
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className={`text-[9px] font-semibold font-sans px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            openCount > 0 
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/10' 
                              : 'bg-zinc-800/80 text-zinc-400 border border-white/5'
                          }`}>
                            <MessageSquare className="w-2.5 h-2.5" />
                            {openCount} Ulasan Aktif
                          </span>
                          {resolvedCount > 0 && (
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-md font-semibold font-sans">
                              ✓ {resolvedCount} Selesai
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-3 mt-4">
                    <div className="border-t border-white/5 pt-3" />

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <div className="text-left">
                        <span className="block text-[8px] text-slate-500 uppercase">Editor ditugaskan</span>
                        <span className="font-semibold text-slate-300 block truncate max-w-[130px]">
                          {proj.editorName ? `🎬 ${proj.editorName}` : '🔍 Menunggu Editor...'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="block text-[8px] text-slate-500 uppercase">Penyelesaian</span>
                        <span className="font-semibold text-slate-300">{proj.status === 'Completed' ? 'Selesai 100%' : 'Sedang Ditinjau'}</span>
                      </div>
                    </div>

                    {/* Integrated CTA Buttons */}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(proj);
                        }}
                        className="flex-1 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20 hover:border-indigo-600 transition-all duration-200 cursor-pointer text-center flex items-center justify-center gap-1 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" /> Workspace
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProjectForRevision(proj);
                        }}
                        className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-slate-200 border border-white/5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-center flex items-center justify-center gap-1 active:scale-95"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-rose-400" /> Ulasan {allRevisions[proj.id]?.length > 0 ? `(${allRevisions[proj.id].length})` : ''}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#141414] rounded-2xl border border-white/5 p-12 text-center text-slate-500">
            <Video className="w-8 h-8 text-slate-600 mx-auto stroke-[1.2] mb-3" />
            <p className="text-xs font-semibold">Belum membuat proyek video</p>
            <p className="text-[10px] mt-1 text-slate-500">Klik tombol "Kirim Proyek Baru" di atas untuk mengirimkan rekaman awal Anda.</p>
          </div>
        )}
      </div>

      {/* Modern create project modal overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs font-sans">
          <div className="bg-[#141414] border border-white/10 p-6 rounded-2xl max-w-sm w-full relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-lg font-bold text-white">Daftarkan Proyek Baru</h3>
              <p className="text-xs text-slate-400 mt-1">Kirimkan rincian instruksi editing kepada editor kami.</p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-[10px] leading-relaxed text-red-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nama Proyek Video</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Video Promosi Produk Kopi Mayora"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/10 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Deskripsi & Intruksi Editing</label>
                <textarea
                  required
                  placeholder="e.g. Tolong potong adegan membuang biji kopi, tambahkan transisi zoom-in, berikan color grading vintage."
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/10 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 rounded-lg h-24 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Initial reference footage templates options */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Footage Referensi Awal</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {FOOTAGE_PRESETS.map((p, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setInitialFootageIdx(idx)}
                      className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                        initialFootageIdx === idx
                          ? 'bg-[#0a0a0a] border-indigo-500 text-white'
                          : 'bg-[#0a0a0a] border-white/5 text-slate-400 hover:border-white/10'
                      }`}
                    >
                      <FileVideo className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                      <span className="text-[10px] font-medium truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 bg-[#0a0a0a] border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-semibold rounded-lg transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || isLimitReached}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Memposting...' : 'Kirim Proyek'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Revision / Review Modal */}
      {selectedProjectForRevision && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-xs font-sans">
          <div className="bg-[#141414] border border-white/10 p-6 rounded-3xl max-w-2xl w-full relative space-y-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div className="text-left space-y-1">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">PUSAT ULASAN & REVISI</span>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  {selectedProjectForRevision.name}
                </h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Tulis ulasan umum atau detail instruksi revisi video Anda. Semua catatan langsung terkirim secara real-time ke Editor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProjectForRevision(null)}
                className="p-1.5 bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Scroll Grid */}
            <div className="grid md:grid-cols-12 gap-6 overflow-y-auto pr-1 min-h-0">
              
              {/* Left Column: Revision list */}
              <div className="md:col-span-7 flex flex-col space-y-3 overflow-y-auto max-h-[45vh] md:max-h-[50vh] pr-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">
                  Daftar Ulasan & Revisi Anda ({allRevisions[selectedProjectForRevision.id]?.length || 0})
                </h4>

                {allRevisions[selectedProjectForRevision.id]?.length > 0 ? (
                  <div className="space-y-2.5">
                    {allRevisions[selectedProjectForRevision.id].map((rev) => (
                      <div
                        key={rev.id}
                        className={`p-3.5 rounded-xl border text-left transition-all relative ${
                          rev.status === 'resolved'
                            ? 'bg-[#0a0a0a]/40 border-white/5 opacity-60 text-slate-500'
                            : 'bg-[#0a0a0a] border-white/10 text-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${
                            rev.timestamp === 'Umum'
                              ? 'bg-zinc-800 text-zinc-400 border border-white/5'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10'
                          }`}>
                            ⚡ {rev.timestamp === 'Umum' ? 'Ulasan Umum' : `Time: ${rev.timestamp}`}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleResolveInDashboard(selectedProjectForRevision.id, rev)}
                            className={`px-2 py-0.5 rounded border text-[9px] font-bold font-sans flex items-center gap-1 transition-all ${
                              rev.status === 'resolved'
                                ? 'bg-emerald-950 border-emerald-900 text-emerald-400'
                                : 'bg-[#141414] border-white/5 hover:bg-neutral-800 text-slate-400'
                            }`}
                            title={rev.status === 'resolved' ? "Tandai Belum Diselesaikan" : "Selesaikan Revisi"}
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>{rev.status === 'resolved' ? 'Selesai' : 'Tandai Selesai'}</span>
                          </button>
                        </div>

                        <p className="text-xs mt-2.5 leading-relaxed font-sans font-medium break-words">{rev.comment}</p>

                        <div className="flex items-center justify-between border-t border-white/5 mt-3 pt-2 text-[8px] text-slate-500 font-mono">
                          <span>👤 {rev.userName} ({rev.userRole})</span>
                          <span>
                            {rev.createdAt?.toDate 
                              ? rev.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                              : 'Baru saja'
                            }
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                    <MessageSquare className="w-8 h-8 text-slate-600 stroke-[1.2]" />
                    <p className="text-xs font-semibold">Belum Ada Catatan Revisi</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs">
                      Proyek ini belum memiliki ulasan aktif. Tulis ulasan pertama Anda menggunakan form di samping kanan.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Add revision form */}
              <div className="md:col-span-5 bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl space-y-4">
                <div className="text-left">
                  <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                    Ajukan Ulasan Baru
                  </h4>
                  <p className="text-[9px] text-slate-500">Kirim feedback visual, koreksi transisi, atau rincian suara.</p>
                </div>

                <form onSubmit={handleAddQuickRevision} className="space-y-3.5">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Metode Koreksi</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUseTimestamp(false)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-bold border transition-all ${
                          !useTimestamp
                            ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                            : 'bg-[#141414] border-white/5 text-slate-400'
                        }`}
                      >
                        Ulasan Umum
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseTimestamp(true)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-bold border transition-all ${
                          useTimestamp
                            ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                            : 'bg-[#141414] border-white/5 text-slate-400'
                        }`}
                      >
                        Penanda Waktu
                      </button>
                    </div>
                  </div>

                  {useTimestamp && (
                    <div className="p-3 bg-[#141414] border border-white/5 rounded-xl text-left space-y-1.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" /> Tentukan Waktu Video
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <span className="text-[8px] text-slate-500 block mb-0.5">Menit</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            required
                            value={timestampMinutes}
                            onChange={(e) => setTimestampMinutes(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-white/5 px-2 py-1 rounded text-xs font-mono text-center text-white"
                          />
                        </div>
                        <span className="text-slate-500 text-xs font-mono mt-3">:</span>
                        <div className="flex-1">
                          <span className="text-[8px] text-slate-500 block mb-0.5">Detik</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            required
                            value={timestampSeconds}
                            onChange={(e) => setTimestampSeconds(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-white/5 px-2 py-1 rounded text-xs font-mono text-center text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 text-left">
                    <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Catatan / Ulasan</label>
                    <textarea
                      required
                      placeholder="e.g. Tolong ganti musik latar belakang di bagian awal agar terdengar lebih dramatis, dan koreksi warna pada menit pertama."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="w-full bg-[#141414] border border-white/5 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 rounded-lg h-24 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingQuickRevision || !newCommentText.trim()}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 disabled:opacity-50"
                  >
                    {submittingQuickRevision ? (
                      <span>Mengirim...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Kirim Ulasan</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Info status tag */}
                <div className="p-2.5 rounded-lg bg-[#141414] border border-white/5 text-[9px] text-slate-400 leading-relaxed text-left">
                  📌 Mengirim ulasan akan memperbarui status proyek ke <span className="text-indigo-400 font-bold">Revision</span> agar editor tahu bahwa mereka perlu melakukan penyuntingan lebih lanjut.
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-white/5 pt-4 flex justify-between items-center text-[10px] text-slate-500">
              <span>CloudEdits Smart Review Synergist</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectForRevision(null);
                  onSelectProject(selectedProjectForRevision);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all duration-200"
              >
                Buka Di Player Studio →
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
