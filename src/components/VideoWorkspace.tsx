import React, { useRef, useState, useEffect } from 'react';
import { Project, Revision, Attachment } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Play, Pause, Clock, Send, CheckCircle, RefreshCw, FileVideo, Download, FileText, Paperclip, Plus, Trash2 } from 'lucide-react';

interface VideoWorkspaceProps {
  project: Project;
  currentUser: { uid: string; name: string; role: 'Editor' | 'Client' };
  onBack: () => void;
  onStatusChange: (newStatus: 'Pending' | 'Editing' | 'Revision' | 'Completed') => void;
}

const PRESET_VIDEOS = [
  { name: "Cinematic Coffee B-Roll", url: "https://assets.mixkit.co/videos/preview/mixkit-pouring-hot-coffee-into-a-cup-42323-large.mp4" },
  { name: "Cyberpunk Tokyo Night", url: "https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-look-of-tokyo-streets-at-night-42261-large.mp4" },
  { name: "Aerial Drone Forest", url: "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-a-dense-forest-and-lake-32943-large.mp4" }
];

export default function VideoWorkspace({ project, currentUser, onBack, onStatusChange }: VideoWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [commentText, setCommentText] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState('00:00');
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Load revisions subcollection
  useEffect(() => {
    const revisionsRef = collection(db, 'projects', project.id, 'revisions');
    const q = query(revisionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Revision[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Revision);
      });
      setRevisions(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `projects/${project.id}/revisions`);
    });

    return () => unsubscribe();
  }, [project.id]);

  // Sync playback time formatting
  const formatTime = (timeInSeconds: number) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setCurrentTimeFormatted(formatTime(videoRef.current.currentTime));
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const jumpToTime = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length === 2 && videoRef.current) {
      const seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Submit revision comment bound to timestamp
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingRevision(true);
    const timeFormatted = currentTimeFormatted;

    const newRevision: Omit<Revision, 'id'> = {
      projectId: project.id,
      comment: commentText.trim(),
      timestamp: timeFormatted,
      userId: currentUser.uid,
      userName: currentUser.name,
      userRole: currentUser.role,
      status: 'open',
      createdAt: new Date()
    };

    try {
      const revisionsRef = collection(db, 'projects', project.id, 'revisions');
      await addDoc(revisionsRef, newRevision);
      setCommentText('');

      // If status is "Editing" or "Completed", bump status back to "Revision" automatically when client adds a revision
      if (currentUser.role === 'Client' && (project.status === 'Editing' || project.status === 'Completed')) {
        await onStatusChange('Revision');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `projects/${project.id}/revisions`);
    } finally {
      setSubmittingRevision(false);
    }
  };

  // Resolve revision feedback
  const handleToggleResolve = async (revision: Revision) => {
    const nextStatus = revision.status === 'open' ? 'resolved' : 'open';
    try {
      const revRef = doc(db, 'projects', project.id, 'revisions', revision.id);
      await updateDoc(revRef, { status: nextStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}/revisions/${revision.id}`);
    }
  };

  // Simulate High Performance File upload using Local Object URLs or simple text storage
  // Allows loading actual high resolution MP4s from editor browser tab to live preview
  const handleVideoUploadSimulation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const objectUrl = URL.createObjectURL(file);

    try {
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, {
        videoUrl: objectUrl,
        videoName: file.name,
        status: 'Revision', // Move to revision once project editor uploads next draft
        updatedAt: new Date()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
    } finally {
      setUploadingFile(false);
    }
  };

  // Add Attachments (supporting files/assets)
  const handleAttachmentUploadSimulation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    // Mimic supporting file storage
    const fakeAttachment: Attachment = {
      name: file.name,
      url: window.URL.createObjectURL(file), // Local downloadable URL
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toLocaleDateString('id-ID'),
      uploadedBy: currentUser.name
    };

    const nextAttachments = [...(project.attachments || []), fakeAttachment];

    try {
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, {
        attachments: nextAttachments,
        updatedAt: new Date()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleApplyPresetVideo = async (url: string, name: string) => {
    try {
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, {
        videoUrl: url,
        videoName: name,
        updatedAt: new Date()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
    }
  };

  // Clean supporting files
  const handleDeleteAttachment = async (index: number) => {
    if (!project.attachments) return;
    const nextAttachments = [...project.attachments];
    nextAttachments.splice(index, 1);

    try {
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, {
        attachments: nextAttachments,
        updatedAt: new Date()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
    }
  };

  // Project progress percent
  const openRevisions = revisions.filter(r => r.status === 'open').length;
  const resolvedRevisions = revisions.filter(r => r.status === 'resolved').length;
  const totalRevisions = revisions.length;
  const resolutionPercentage = totalRevisions > 0 ? Math.round((resolvedRevisions / totalRevisions) * 100) : 100;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-slate-200">
      
      {/* Workspace Header Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 p-5 gap-4 bg-[#0a0a0a]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 bg-[#141414] border border-white/10 rounded-xl hover:bg-white/5 hover:text-white transition-all text-xs font-semibold"
          >
            ← Kembali ke Dashboard
          </button>
          <div className="text-left">
            <h2 className="text-lg font-bold tracking-tight text-white uppercase">{project.name}</h2>
            <p className="text-slate-400 text-xs truncate max-w-sm">{project.description}</p>
          </div>
        </div>

        {/* Project Status Management Ribbon */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status Proyek:</span>
          
          <select
            value={project.status}
            onChange={(e) => onStatusChange(e.target.value as any)}
            disabled={currentUser.role !== 'Editor'}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border bg-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              project.status === 'Pending' ? 'text-amber-400 border-amber-900/40 bg-amber-950/20' :
              project.status === 'Editing' ? 'text-blue-400 border-blue-900/40 bg-blue-950/20' :
              project.status === 'Revision' ? 'text-indigo-400 border-indigo-900/40 bg-indigo-950/20' :
              'text-emerald-400 border-emerald-950/40 bg-[#0a0a0a]'
            }`}
          >
            <option value="Pending">🟡 Pending</option>
            <option value="Editing">🔵 Editing</option>
            <option value="Revision">🟣 Revision</option>
            <option value="Completed">🟢 Completed</option>
          </select>

          {/* Quick client approval */}
          {currentUser.role === 'Client' && project.status !== 'Completed' && (
            <button
              onClick={() => onStatusChange('Completed')}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all"
            >
              Setujui Hasil Akhir ✓
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Grid (Left Panel: Video & Attachments, Right Panel: Timeline Comment Box & Feedback List) */}
      <div className="grid lg:grid-cols-12 flex-1 overflow-hidden min-h-0 bg-[#0a0a0a]">
        
        {/* Playback & reference workspace column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col p-5 overflow-y-auto space-y-6 bg-[#0a0a0a]">
          
          {/* Main FrameVideo Player Card - Bento Box style */}
          <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative group">
            {project.videoUrl ? (
              <div className="relative aspect-video bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={project.videoUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={togglePlayback}
                  className="w-full h-full max-h-[500px]"
                  playsInline
                />
                
                {/* Visual marker lines over layout container */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col gap-2">
                  
                  {/* Timeline Scrubber Slider with revision markers */}
                  <div className="relative w-full h-2 bg-white/20 rounded-full cursor-pointer">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => {
                        const targetTime = parseFloat(e.target.value);
                        if (videoRef.current) {
                          videoRef.current.currentTime = targetTime;
                          setCurrentTime(targetTime);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 pointer-events-auto cursor-pointer"
                    />
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-75 relative"
                      style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-indigo-400 border border-white rounded-full shadow" />
                    </div>

                    {/* Timeline Revision Dot Markers */}
                    {revisions.map((rev) => {
                      const parts = rev.timestamp.split(':');
                      if (parts.length === 2 && duration > 0) {
                        const seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                        const percent = (seconds / duration) * 100;
                        if (percent <= 100) {
                          return (
                            <div
                              key={rev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                jumpToTime(rev.timestamp);
                              }}
                              className={`absolute top-0 w-2.5 h-2.5 -translate-x-1/2 rounded-full cursor-pointer border hover:scale-125 transition-all ${
                                rev.status === 'resolved'
                                  ? 'bg-[#141414] border-slate-500'
                                  : 'bg-rose-500 border-rose-300 shadow shadow-rose-500/20'
                              }`}
                              style={{ left: `${percent}%` }}
                              title={`Revision at ${rev.timestamp}: ${rev.comment}`}
                            />
                          );
                        }
                      }
                      return null;
                    })}
                  </div>

                  {/* Playback controllers overlay */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={togglePlayback}
                        className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <span className="text-xs font-mono text-slate-300">
                        {currentTimeFormatted} / {formatTime(duration)}
                      </span>
                    </div>
                    {project.videoName && (
                      <span className="text-[10px] text-slate-400 truncate max-w-[200px] font-mono">
                        {project.videoName}
                      </span>
                    )}
                  </div>

                </div>
              </div>
            ) : (
              /* No video yet placeholder view  */
              <div className="aspect-video bg-black flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="p-4 bg-[#0a0a0a] border border-white/5 rounded-full text-slate-500">
                  <FileVideo className="w-10 h-10 stroke-[1.2]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-300">Belum ada video terunggah</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Silakan upload video hasil editan versi terbaru di bawah ini untuk memulai proses review.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Preset Stock Videos Options - Bento Box Style */}
          <div className="bg-[#141414] border border-white/5 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">Preset Template Footage Mini</h4>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_VIDEOS.map((vid, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPresetVideo(vid.url, vid.name)}
                  className={`px-3 py-2 text-[10px] font-medium border rounded-lg text-left truncate transition-all ${
                    project.videoUrl === vid.url
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-[#0a0a0a] border-white/5 hover:border-white/10 text-slate-400'
                  }`}
                >
                  🎬 {vid.name}
                </button>
              ))}
            </div>
          </div>

          {/* Editor: Upload Draft controls */}
          {currentUser.role === 'Editor' && (
            <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide font-sans">Upload File Hasil Editan</h4>
                  <p className="text-[10px] text-slate-400">Upload draft video terbaru langsung dari laptop Anda</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold tracking-wide transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {uploadingFile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Pilih Video Baru</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUploadSimulation}
                className="hidden"
              />
            </div>
          )}

          {/* Supporting Attachments Section - Bento Box Style */}
          <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-400" />
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">File Pendukung ({project.attachments?.length || 0})</h4>
              </div>
              
              <button
                onClick={() => attachmentInputRef.current?.click()}
                className="text-[10px] bg-[#0a0a0a] border border-white/10 px-2.5 py-1 rounded-lg hover:bg-white/5 text-slate-300 font-semibold cursor-pointer"
              >
                + Tambah File
              </button>
              <input
                ref={attachmentInputRef}
                type="file"
                onChange={handleAttachmentUploadSimulation}
                className="hidden"
              />
            </div>

            {/* List attached files */}
            {project.attachments && project.attachments.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {project.attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#0a0a0a] p-3 rounded-xl border border-white/5"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="p-1.5 bg-[#141414] rounded border border-white/5 text-slate-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate text-left">
                        <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                        <p className="text-[8px] text-slate-500 truncate">
                          Oleh {file.uploadedBy} • {file.uploadedAt}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <a
                        href={file.url}
                        download={file.name}
                        onClick={(e) => {
                          // Prevent actual download frame crash but support sandbox mechanics
                        }}
                        className="p-1.5 bg-[#141414] border border-white/5 hover:bg-white/5 rounded-md text-slate-300"
                        title="Download file pendukung"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteAttachment(idx)}
                        className="p-1.5 bg-[#141414] border border-white/5 hover:bg-red-95/30 hover:text-red-400 rounded-md text-slate-400"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">Belum ada file pendukung (seperti aset gambar, audio, script, atau logo).</p>
            )}
          </div>

        </div>

        {/* Revision Sidebar / Panel (4 cols) */}
        <div className="lg:col-span-4 border-l border-white/10 flex flex-col h-full bg-[#141414]">
          
          {/* Progress panel */}
          <div className="p-4 border-b border-white/10 bg-[#141414]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Penyelesaian Revisi</span>
              <span className="text-xs font-mono font-bold text-indigo-400">{resolutionPercentage}%</span>
            </div>
            <div className="w-full bg-[#0a0a0a] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${resolutionPercentage}%` }}
              />
            </div>
            <div className="flex gap-4 text-[9px] text-slate-500 font-mono mt-2 justify-center">
              <span>🎯 Total: {totalRevisions}</span>
              <span className="text-indigo-400">🔴 Pending: {openRevisions}</span>
              <span className="text-emerald-400">🟢 Selesai: {resolvedRevisions}</span>
            </div>
          </div>

          {/* Feedback list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-left">Daftar Revisi Proyek</h3>
            
            {revisions.length > 0 ? (
              revisions.map((rev) => (
                <div
                  key={rev.id}
                  onClick={() => jumpToTime(rev.timestamp)}
                  className={`p-3.5 rounded-xl border transition-all text-left group cursor-pointer ${
                    rev.status === 'resolved'
                      ? 'bg-[#0a0a0a]/50 border-white/5 text-slate-500 opacity-60'
                      : 'bg-[#0a0a0a] border-white/5 hover:border-indigo-500/20 text-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); jumpToTime(rev.timestamp); }}
                      className="inline-flex items-center gap-1.5 bg-[#141414] border border-white/5 px-2 py-0.5 rounded text-[10px] font-mono hover:bg-neutral-800 transition-all text-indigo-400"
                    >
                      <Clock className="w-3 h-3 text-indigo-400" />
                      <span>{rev.timestamp}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleResolve(rev);
                      }}
                      className={`p-1 rounded border transition-all ${
                        rev.status === 'resolved'
                          ? 'bg-emerald-950 border-emerald-900 text-emerald-400'
                          : 'bg-[#141414] border-white/5 hover:bg-[#1c1c1e] text-slate-400'
                      }`}
                      title={rev.status === 'resolved' ? "Tandai Belum Selesai" : "Selesaikan Revisi"}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs mt-2.5 leading-relaxed break-words font-medium">{rev.comment}</p>

                  <div className="flex items-center justify-between border-t border-white/5 mt-3 pt-2 text-[9px] text-slate-500">
                    <span className="font-semibold block truncate max-w-[120px]">
                      👤 {rev.userName} <span className="text-[7px] text-indigo-400 block sm:inline">({rev.userRole})</span>
                    </span>
                    <span>
                      {rev.createdAt?.toDate ? rev.createdAt.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-650 pt-16">
                <p className="text-xs">Belum ada catatan revisi.</p>
                <p className="text-[9px] mt-1 max-w-xs text-zinc-500">
                  Klien dapat memutar video dan mengetik pesan di bawah untuk memasukkan penunjuk revisi yang akurat di timeline.
                </p>
              </div>
            )}
          </div>

          {/* Footer Timeline Comment Maker */}
          <form onSubmit={handleSubmitComment} className="p-4 border-t border-white/10 bg-[#141414]">
            <div className="flex items-center justify-between text-[10px] mb-2 font-mono text-slate-400">
              <span>Timestamp Terkunci:</span>
              <span className="font-bold text-indigo-400 bg-[#0a0a0a] border border-white/5 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3" /> {currentTimeFormatted}
              </span>
            </div>

            <div className="relative">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Tulis kritik b-roll, transisi, audio, warna..."
                className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl py-2.5 pl-3 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-16"
              />
              <button
                type="submit"
                disabled={submittingRevision || !commentText.trim()}
                className="absolute right-2.5 bottom-2.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
}
