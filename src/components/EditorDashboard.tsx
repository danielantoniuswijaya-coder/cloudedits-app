import React, { useState } from 'react';
import { Project, UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Briefcase, Clock, CheckCircle, Flame, Search, ArrowUpRight, Check } from 'lucide-react';

interface EditorDashboardProps {
  projects: Project[];
  currentUser: UserProfile;
  onSelectProject: (project: Project) => void;
}

export default function EditorDashboard({ projects, currentUser, onSelectProject }: EditorDashboardProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Filter projects relative to this editor and general pending projects
  const editorProjects = projects.filter(p => p.editorId === currentUser.uid);
  const pendingProjects = projects.filter(p => !p.editorId || p.status === 'Pending');
  
  // Combine all accessible projects for listing
  const allAccessibleProjects = projects.filter(p => p.editorId === currentUser.uid || p.status === 'Pending');

  const filteredProjects = allAccessibleProjects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.ownerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Claim process
  const handleClaimProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid opening workspace immediately
    try {
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        editorId: currentUser.uid,
        editorEmail: currentUser.email,
        editorName: currentUser.name,
        status: 'Editing',
        updatedAt: new Date()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  // Recharts Analytics
  const getChartData = () => {
    const counts = { Pending: 0, Editing: 0, Revision: 0, Completed: 0 };
    allAccessibleProjects.forEach((p) => {
      if (counts[p.status] !== undefined) {
        counts[p.status]++;
      }
    });
    return [
      { status: 'Pending', count: counts.Pending, fill: '#F59E0B' },
      { status: 'Editing', count: counts.Editing, fill: '#3B82F6' },
      { status: 'Revisi', count: counts.Revision, fill: '#8B5CF6' },
      { status: 'Completed', count: counts.Completed, fill: '#10B981' }
    ];
  };

  const chartData = getChartData();
  const totalMyProjects = editorProjects.length;
  const completedMyProjects = editorProjects.filter(p => p.status === 'Completed').length;
  const inProgressMyProjects = totalMyProjects - completedMyProjects;

  return (
    <div className="space-y-6 text-left">
      
      {/* Upper Cards Tracker */}
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dashboard Editor</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Card 1 */}
        <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Proyek Tersedia</span>
            <span className="text-2xl font-bold text-amber-500 font-mono">{pendingProjects.length}</span>
          </div>
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Proyek Saya</span>
            <span className="text-2xl font-bold text-white font-mono">{totalMyProjects}</span>
          </div>
          <div className="p-2.5 bg-white/5 text-slate-300 rounded-xl border border-white/5">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Sedang Dikerjakan</span>
            <span className="text-2xl font-bold text-indigo-400 font-mono">{inProgressMyProjects}</span>
          </div>
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Selesai Diarsip</span>
            <span className="text-2xl font-bold text-emerald-400 font-mono">{completedMyProjects}</span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Projects List on Left, Status chart on Right */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Project List (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Controls: Search, Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#141414] p-3.5 rounded-2xl border border-white/5">
            <div className="relative w-full flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama proyek atau klien..."
                className="w-full bg-[#0a0a0a] border border-white/10 pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={() => setStatusFilter('All')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  statusFilter === 'All'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-[#0a0a0a] border-white/5 hover:border-white/10 text-slate-400'
                }`}
              >
                Semua
              </button>
              {['Pending', 'Editing', 'Revision', 'Completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    statusFilter === status
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-[#0a0a0a] border-white/5 hover:border-white/10 text-slate-400'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* List display */}
          {filteredProjects.length > 0 ? (
            <div className="space-y-3.5">
              {filteredProjects.map((proj) => {
                const isClaimedByMe = proj.editorId === currentUser.uid;
                const isPending = !proj.editorId && proj.status === 'Pending';
                
                return (
                  <div
                    key={proj.id}
                    onClick={() => onSelectProject(proj)}
                    className="group bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 cursor-pointer transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow hover:border-indigo-500/30"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        
                        {/* Status badge */}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          proj.status === 'Pending' ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' :
                          proj.status === 'Editing' ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' :
                          proj.status === 'Revision' ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20' :
                          'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        }`}>
                          {proj.status}
                        </span>

                        {/* Owner priority SaaS badge */}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono border ${
                          proj.subscriptionType === 'Starter' ? 'text-slate-400 border-white/10 bg-[#0a0a0a]' :
                          proj.subscriptionType === 'Professional' ? 'text-cyan-450 border-cyan-800/10 bg-cyan-950/20' :
                          'text-amber-400 border-amber-550/20 bg-amber-950/10 font-bold'
                        }`}>
                          👑 {proj.subscriptionType}
                        </span>

                        {/* Associated status indicator */}
                        {isClaimedByMe && (
                          <span className="bg-indigo-500/10 text-indigo-400 text-[9px] px-2 py-0.5 rounded border border-indigo-500/20">
                            Milik Saya
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                        {proj.name}
                      </h4>
                      <p className="text-slate-400 text-xs line-clamp-1">
                        {proj.description || 'Tidak ada deskripsi'}
                      </p>

                      <div className="flex flex-wrap text-[10px] text-slate-500 gap-x-4 gap-y-1 font-mono">
                        <span>👤 Klien: <strong className="text-slate-400">{proj.ownerName}</strong></span>
                        {proj.videoName && <span className="text-slate-400">🎬 {proj.videoName}</span>}
                      </div>
                    </div>

                    {/* Work Action buttons */}
                    <div className="flex items-center gap-2 shrink-0 justify-end pt-2 sm:pt-0">
                      {isPending ? (
                        <button
                          id={`btn-claim-${proj.id}`}
                          onClick={(e) => handleClaimProject(proj.id, e)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1"
                        >
                          <span>Klaim Proyek</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 group-hover:text-white font-medium bg-[#0a0a0a] px-2.5 py-1.5 rounded-lg border border-white/5 group-hover:border-white/10">
                          <span>Buka Ruang Kerja</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#141414] rounded-2xl border border-white/5 p-12 text-center text-slate-500">
              <p className="text-xs font-semibold">Tidak ada proyek yang sesuai pencarian</p>
              <p className="text-[10px] mt-1 text-slate-500">Coba ubah filter atau lakukan pencarian lain.</p>
            </div>
          )}
        </div>

        {/* Analytics Section (4 cols) */}
        <div className="lg:col-span-4 bg-[#141414] border border-white/5 rounded-2xl p-5 space-y-5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-3">Status Distribusi</h4>
          
          {/* Bar Chart Container */}
          <div className="h-48 w-full select-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="status" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', fontSize: 10 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center bg-[#0a0a0a] p-2.5 rounded-lg border border-white/5 text-[10px]">
              <span className="text-slate-500 font-mono">Starter Quota Limit</span>
              <span className="text-slate-300 font-bold uppercase">Maks 2 Aktif / Klien</span>
            </div>
            <div className="flex justify-between items-center bg-[#0a0a0a] p-2.5 rounded-lg border border-white/5 text-[10px]">
              <span className="text-slate-500 font-mono">SLA Delivery Prioritas</span>
              <span className="text-amber-400 font-bold uppercase">Agency Pro (48 Jam)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
