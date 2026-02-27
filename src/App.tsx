/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  MapPin, 
  Send, 
  List, 
  LayoutDashboard, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ChevronRight,
  Filter,
  User,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Priority = 'Low' | 'Medium' | 'High';
type Status =
  | 'Submitted'
  | 'In Progress'
  | 'Resolved'
  | 'Resolved (Pending Admin)'
  | 'Closed';
type Role = 'citizen' | 'worker' | 'admin';

interface UserProfile {
  id: string;
  name: string;
  role: Role;
}

interface Complaint {
  id: string;
  category: string;
  description: string;
  photoUrl: string;
  latitude: number;
  longitude: number;
  priority: Priority;
  status: Status;
  workerName?: string;
  createdAt: string;
  area?: string;
  city?: string;
  state?: string;
  ward?: string;
  fullAddress?: string;
  division?: string;
}

interface NotificationRow {
  id: string;
  complaintId: string;
  type: string;
  message: string;
  isRead: number;
  createdAt: string;
}

const CATEGORIES = ['Garbage', 'Water', 'Road', 'Streetlight', 'Sanitation'];

// ✅ GPS helper (place below CATEGORIES, above export default App)
function getGps(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
  });
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'landing' | 'citizen-form' | 'citizen-list' | 'worker' | 'admin'>('landing');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComplaints = async () => {
    try {
      const url =
        user?.role === 'citizen'
          ? `/api/complaints?userId=${encodeURIComponent(user.id)}`
          : user?.role === 'worker'
            ? `/api/complaints?workerName=${encodeURIComponent(user.name)}`
            : '/api/complaints';
      const res = await fetch(url);
      const data = await res.json();
      setComplaints(data);
    } catch (err) {
      console.error('Failed to fetch complaints');
    }
  };

  useEffect(() => {
    if (user && (view === 'citizen-list' || view === 'worker' || view === 'admin')) {
      fetchComplaints();
    }
  }, [view, user]);

  const handleLogin = (userData: UserProfile) => {
    setUser(userData);
    if (userData.role === 'admin') setView('admin');
    else if (userData.role === 'worker') setView('worker');
    else setView('landing');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-black/5 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setView('landing')}
        >
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
          </div>
          <span className="font-bold text-xl tracking-tight">CivicPulse</span>
        </div>
        <div className="flex items-center gap-4">
          {user.role === 'citizen' && (
            <button 
              onClick={() => setView('citizen-list')}
              className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${view === 'citizen-list' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-100'}`}
            >
              My Reports
            </button>
          )}
          {user.role === 'admin' && (
            <button 
              onClick={() => setView('admin')}
              className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${view === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-100'}`}
            >
              Admin Portal
            </button>
          )}
          {user.role === 'worker' && (
            <button
              onClick={() => setView('worker')}
              className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${view === 'worker' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
            >
              Worker Portal
            </button>
          )}
          <div className="h-6 w-px bg-gray-200 mx-2" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-black leading-none">{user.name}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">{user.role}</p>
            </div>
            <button 
              onClick={() => { setUser(null); setView('landing'); }}
              className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-full transition-all"
              title="Logout"
            >
              <ArrowLeft size={18} className="rotate-180" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-20"
            >
              <h1 className="text-5xl font-bold mb-6 tracking-tight">
                Better Cities, <span className="text-emerald-600">Together.</span>
              </h1>
              <p className="text-gray-500 text-lg mb-12 max-w-xl mx-auto">
                Report urban issues in seconds. Our smart system routes your grievance to the right department instantly.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {user.role === 'citizen' && (
                  <button 
                    onClick={() => setView('citizen-form')}
                    className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                  >
                    <AlertCircle size={20} />
                    Report an Issue
                  </button>
                )}
                <button 
                  onClick={() => setView(user.role === 'admin' ? 'admin' : 'citizen-list')}
                  className="bg-white border border-gray-200 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <List size={20} />
                  {user.role === 'admin' ? 'Admin Dashboard' : 'Track Progress'}
                </button>
              </div>
            </motion.div>
          )}

          {view === 'citizen-form' && user.role === 'citizen' && (
            <CitizenForm user={user} onBack={() => setView('landing')} onSuccess={() => setView('citizen-list')} />
          )}

          {view === 'citizen-list' && (
            <CitizenList complaints={complaints} onBack={() => setView('landing')} onDelete={fetchComplaints} />
          )}

          {view === 'worker' && user.role === 'worker' && (
            <WorkerDashboard user={user} complaints={complaints} onUpdate={fetchComplaints} />
          )}

          {view === 'admin' && user.role === 'admin' && (
            <AdminDashboard complaints={complaints} onUpdate={fetchComplaints} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [role, setRole] = useState<Role>('citizen');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

    try {
    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';

    const body =
      mode === 'signup'
        ? { name, email, password, role }     // ✅ include role on signup
        : { email, password, role };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // ✅ avoid "Network error" when response isn't JSON
    let data: any = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (res.ok) {
      onLogin(data);
    } else {
      alert(data?.error || `Auth failed (${res.status})`);
      console.log('Auth error response:', text);
    }
    } catch (err) {
    alert('Network error (server not reachable)');
    console.log(err);
    } finally {
    setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') setMode('signin'); // admin only sign-in
  }, [role]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] p-10 shadow-xl shadow-black/5 border border-black/5 w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-600/20">
            <div className="w-8 h-8 bg-white rounded-full" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">CivicPulse</h1>
          <p className="text-gray-400 mt-2">
            {role === 'admin'
              ? 'Administrator Login'
              : role === 'worker'
                ? (mode === 'signin' ? 'Worker sign in to manage assignments' : 'Create a worker account')
                : (mode === 'signin' ? 'Welcome back!' : 'Join the community')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Role tabs */}
          <div className="flex p-1 bg-gray-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setRole('citizen')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                role === 'citizen' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Citizen
            </button>

            <button
              type="button"
              onClick={() => setRole('worker')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                role === 'worker' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Worker
            </button>

            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                role === 'admin' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Admin
            </button>
          </div>

          {/* Sign in / Sign up toggle for citizen + worker */}
          {(role === 'citizen' || role === 'worker') && (
            <div className="flex justify-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`pb-1 border-b-2 transition-all font-semibold ${
                  mode === 'signin' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`pb-1 border-b-2 transition-all font-semibold ${
                  mode === 'signup' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          <div className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Jane Cooper"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">
                Email Address
              </label>
              <input
                required
                type="email"
                placeholder={
                  role === 'admin'
                    ? 'admin@civicpulse.org'
                    : role === 'worker'
                      ? 'worker@civicpulse.org'
                      : 'jane@example.com'
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">
                Password
              </label>
              <input
                required
                type="password"
                placeholder="••••••••"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : (role === 'admin' ? 'Login as Admin' : (mode === 'signin' ? 'Sign In' : 'Create Account'))}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-50 text-center">
          <p className="text-xs text-gray-400">
            {role === 'admin' ? (
              <span>Authorized personnel only. Access is monitored.</span>
            ) : (
              <span>By continuing, you agree to our <span className="text-black font-semibold cursor-pointer">Terms of Service</span></span>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function CitizenForm({ user, onBack, onSuccess }: { user: UserProfile, onBack: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    userId: user.id,
    category: 'Garbage',
    description: '',
    photoUrl: '',
    latitude: null as number | null,
    longitude: null as number | null
  });

  const [submitting, setSubmitting] = useState(false);

  const [gps, setGps] = useState<{
    status: "idle" | "fetching" | "ready" | "error";
    accuracy?: number;
    error?: string;
  }>({ status: "idle" });

  useEffect(() => {
    let isMounted = true;

    const capture = async () => {
      setGps({ status: "fetching" });
      try {
        const pos = await getGps();
        if (!isMounted) return;

        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));

        setGps({ status: "ready", accuracy: pos.coords.accuracy });
      } catch (e: any) {
        if (!isMounted) return;
        setGps({ status: "error", error: e?.message || "Location permission denied" });
        console.warn("Geolocation blocked or failed", e);
      }
    };

    capture();
    return () => { isMounted = false; };
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.latitude == null || formData.longitude == null) {
      alert("Please allow location access to submit complaint.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        onSuccess();
      } else {
        const errorData = await res.json();
        alert(`Submission failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Submission failed: Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-3xl p-8 shadow-sm border border-black/5"
    >
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-black transition-colors">
        <ArrowLeft size={18} /> Back
      </button>

      <h2 className="text-2xl font-bold mb-8">New Grievance Report</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hidden GPS fields */}
        <input type="hidden" name="latitude" value={formData.latitude ?? ""} />
        <input type="hidden" name="longitude" value={formData.longitude ?? ""} />

        <div>
          <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-gray-400">Issue Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                className={`py-3 px-4 rounded-xl text-sm font-medium border transition-all ${
                  formData.category === cat
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-gray-400">Description</label>
          <textarea
            required
            placeholder="Describe the issue (e.g., 'Large water leak near the main gate')"
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 min-h-[120px] focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-gray-400">Photo Evidence</label>
            <div className="relative group cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 h-40">
              {formData.photoUrl ? (
                <img
                  src={formData.photoUrl}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  alt="Preview"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
                  <Camera size={28} className="text-emerald-600" />
                  <p className="text-sm font-semibold text-gray-700 mt-2">Your report can improve your city.</p>
                  <p className="text-xs text-gray-500 mt-1">Upload a clear photo so the team can act faster.</p>
                </div>
              )}
              <label className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 text-white cursor-pointer">
                <Camera size={32} />
                <span className="text-xs font-bold mt-2">Upload or Take Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-gray-400">Location</label>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-4 h-40">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <MapPin size={24} />
              </div>

              <div>
                <p className="font-semibold text-sm">Auto-Captured</p>

                {gps.status === "fetching" && <p className="text-xs text-gray-500">Capturing location…</p>}

                {gps.status === "ready" && formData.latitude != null && formData.longitude != null && (
                  <>
                    <p className="text-xs text-gray-500">
                      {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1 font-medium">
                      Accuracy: ~{Math.round(gps.accuracy ?? 0)}m
                    </p>
                  </>
                )}

                {gps.status === "error" && (
                  <p className="text-xs text-red-600">{gps.error || "Location permission denied"}</p>
                )}

                <button
                  type="button"
                  className="mt-2 text-xs font-semibold underline text-gray-500 hover:text-black"
                  onClick={async () => {
                    setGps({ status: "fetching" });
                    try {
                      const pos = await getGps();
                      setFormData(prev => ({
                        ...prev,
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                      }));
                      setGps({ status: "ready", accuracy: pos.coords.accuracy });
                    } catch (e: any) {
                      setGps({ status: "error", error: e?.message || "GPS failed" });
                    }
                  }}
                >
                  Retry location
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          disabled={submitting}
          className="w-full bg-black text-white py-5 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
          <Send size={20} />
        </button>
      </form>
    </motion.div>
  );
}

function CitizenList({ complaints, onBack, onDelete }: { complaints: Complaint[], onBack: () => void, onDelete: () => void }) {
  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete report ${id}?`)) return;
    try {
      const res = await fetch(`/api/complaints/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        alert(`Report ${id} deleted successfully`);
        onDelete();
      } else {
        const error = await res.json();
        alert(error.error || 'Delete failed');
      }
    } catch (err) {
      alert('Network error while deleting');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">My Reports</h2>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-black transition-colors">Back to Home</button>
      </div>

      {complaints.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-black/5">
          <p className="text-gray-400">No reports found.</p>
        </div>
      ) : (
        complaints.map(c => (
          <div key={c.id} className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 flex flex-col md:flex-row gap-6 group relative">
            <button 
              onClick={() => handleDelete(c.id)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 transition-all bg-gray-50 rounded-full"
              title="Delete Report"
            >
              <Trash2 size={18} />
            </button>
            <img 
              src={c.photoUrl} 
              className="w-full md:w-32 h-32 object-cover rounded-2xl" 
              alt="Report"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{c.category}</span>
                  <h3 className="font-bold text-lg mt-1">{c.id}</h3>
                </div>
                <PriorityBadge priority={c.priority} />
              </div>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{c.description}</p>
              <div className="flex flex-wrap gap-4 items-center text-xs text-gray-400">
                <div className="flex items-center gap-1"><Clock size={14} /> {new Date(c.createdAt).toLocaleDateString()}</div>
                <div className="flex items-center gap-1">
                  <MapPin size={14} />
                  {c.area ? `${c.area}, ${c.city}` : `${c.latitude.toFixed(2)}, ${c.longitude.toFixed(2)}`}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Ward: {c.ward || "—"} • Division: {c.division || "—"}
                </p>
              </div>
            </div>
            <div className="md:w-48 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center">
              <StatusTimeline status={c.status} />
            </div>
          </div>
        ))
      )}
    </motion.div>
  );
}

function AdminDashboard({ complaints, onUpdate }: { complaints: Complaint[], onUpdate: () => void }) {
  const [filter, setFilter] = useState<Status | 'All'>('All');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const fetchNotifications = async () => {
  try {
    const res = await fetch('/api/admin/notifications?unread=1');
    const data = await res.json();
    setNotifications(data);
  } catch (e) {
    console.error('Failed to fetch notifications');
  }
  };

  useEffect(() => {
    fetchNotifications();
    const t = setInterval(fetchNotifications, 5000); // demo polling
    return () => clearInterval(t);
  }, []);


  const filtered = filter === 'All' ? complaints : complaints.filter(c => c.status === filter);

  const updateComplaint = async (id: string, updates: Partial<Complaint>) => {
    try {
      await fetch(`/api/complaints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      onUpdate();
      if (selected?.id === id) setSelected({ ...selected, ...updates } as Complaint);
    } catch (err) {
      alert('Update failed');
    }
  };

  const decideResolution = async (
    complaintId: string,
    decision: 'approve' | 'reject',
    notificationId?: string
  ) => {
    try {
      await fetch(`/api/admin/complaints/${encodeURIComponent(complaintId)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
    
      if (notificationId) {
        await fetch(`/api/admin/notifications/${encodeURIComponent(notificationId)}/read`, {
          method: 'PATCH',
        });
      }
    
      await fetchNotifications();
      onUpdate();
      // refresh selected view
      if (selected?.id === complaintId) {
        setSelected(prev => (prev ? ({ ...prev } as Complaint) : prev));
      }
    } catch (err) {
      alert('Decision failed');
    }
};

  const markNotificationRead = async (notificationId: string) => {
    try {
      await fetch(`/api/admin/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'PATCH',
      });
      await fetchNotifications();
    } catch {
      alert('Failed to mark notification as read');
    }
  };

  const deleteComplaint = async (id: string) => {
    if (!confirm(`Are you sure you want to delete report ${id}?`)) return;
    try {
      const res = await fetch(`/api/complaints/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        alert(`Report ${id} deleted successfully`);
        onUpdate();
        if (selected?.id === id) setSelected(null);
      } else {
        const error = await res.json();
        alert(error.error || 'Delete failed');
      }
    } catch (err) {
      alert('Network error while deleting');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">

        {/* ✅ Notifications Panel */}
        <div className="bg-white rounded-3xl border border-black/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Admin Notifications</h3>
            <span className="text-xs text-gray-400">Unread: {notifications.length}</span>
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400">No new notifications.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map(n => (
                <div key={n.id} className="border border-gray-100 rounded-2xl p-4">
                  <p className="text-sm text-gray-700">{n.message}</p>
                  <div className="mt-3 flex gap-2">
                    {n.type === 'RESOLVED_PENDING' ? (
                      <>
                        <button
                          onClick={() => decideResolution(n.complaintId, 'approve', n.id)}
                          className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Approve & Close
                        </button>
                        <button
                          onClick={() => decideResolution(n.complaintId, 'reject', n.id)}
                          className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => markNotificationRead(n.id)}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-800 text-white hover:bg-black"
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Service Dashboard</h2>
          <div className="flex gap-2">
            {['All', 'Submitted', 'In Progress', 'Resolved (Pending Admin)', 'Resolved', 'Closed'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === s ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-black/5 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">ID / Category</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Priority</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr 
                  key={c.id} 
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected?.id === c.id ? 'bg-emerald-50/50' : ''}`}
                  onClick={() => setSelected(c)}
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm">{c.id}</div>
                    <div className="text-xs text-gray-400">{c.category}</div>
                  </td>
                  <td className="px-6 py-4">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                      c.status === 'Closed' ? 'bg-black text-white' :
                      c.status === 'Resolved (Pending Admin)' ? 'bg-yellow-100 text-yellow-700' :
                      c.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => setSelected(selected?.id === c.id ? null : c)}
                        className={`p-2 rounded-lg transition-colors ${selected?.id === c.id ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-gray-100 text-gray-400'}`}
                      >
                        <ChevronRight size={18} />
                      </button>
                      <button 
                        onClick={() => deleteComplaint(c.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-300 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:col-span-1">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div 
              key={selected.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 sticky top-24"
            >
              <h3 className="font-bold text-xl mb-6">Complaint Details</h3>
              <img 
                src={selected.photoUrl} 
                className="w-full h-48 object-cover rounded-2xl mb-6 border border-gray-100" 
                alt="Evidence"
                referrerPolicy="no-referrer"
              />
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Description</label>
                  <p className="text-sm text-gray-600 mt-1">{selected.description}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Assigned Worker</label>
                  <input 
                    type="text"
                    placeholder="Enter worker name"
                    className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-black"
                    value={selected.workerName || ''}
                    onChange={(e) => updateComplaint(selected.id, { workerName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selected.status === 'Resolved (Pending Admin)' ? (
                  <>
                    <button
                      onClick={() => decideResolution(selected.id, 'approve')}
                      className="bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                    >
                      Approve & Close
                    </button>
                    <button
                      onClick={() => decideResolution(selected.id, 'reject')}
                      className="bg-red-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-700 transition-all"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => updateComplaint(selected.id, { status: 'In Progress' })}
                      className="bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                    >
                      Start Work
                    </button>
                    <button
                      onClick={() => updateComplaint(selected.id, { status: 'Resolved' })}
                      className="bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                    >
                      Resolve
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="bg-gray-50 rounded-3xl p-8 border border-dashed border-gray-200 text-center text-gray-400 text-sm">
              Select a complaint to view details and take action
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function WorkerDashboard({ user, complaints, onUpdate }: { user: UserProfile; complaints: Complaint[]; onUpdate: () => void }) {
  const [filter, setFilter] = useState<Status | 'All'>('All');
  const [selected, setSelected] = useState<Complaint | null>(null);

  const filtered = filter === 'All' ? complaints : complaints.filter(c => c.status === filter);

  const updateStatus = async (id: string, status: Status) => {
    try {
      await fetch(`/api/complaints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, workerName: user.name })
      });
      onUpdate();
      if (selected?.id === id) setSelected({ ...selected, status, workerName: user.name } as Complaint);
    } catch (err) {
      alert('Update failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold">Worker Dashboard</h2>
            <p className="text-xs text-gray-400 mt-1">
              Showing jobs assigned to: <span className="font-semibold text-black">{user.name}</span>
            </p>
          </div>

          <div className="flex gap-2">
            {['All', 'Submitted', 'In Progress', 'Resolved (Pending Admin)', 'Resolved', 'Closed'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === s ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-black/5 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">ID / Category</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Priority</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr
                  key={c.id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected?.id === c.id ? 'bg-blue-50/60' : ''}`}
                  onClick={() => setSelected(c)}
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm">{c.id}</div>
                    <div className="text-xs text-gray-400">{c.category}</div>
                  </td>
                  <td className="px-6 py-4"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                      c.status === 'Closed' ? 'bg-black text-white' :
                      c.status === 'Resolved (Pending Admin)' ? 'bg-yellow-100 text-yellow-700' :
                      c.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setSelected(selected?.id === c.id ? null : c)}
                      className={`p-2 rounded-lg transition-colors ${selected?.id === c.id ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-400'}`}
                      title="View"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400">
                    No assigned jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:col-span-1">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 sticky top-24"
            >
              <h3 className="font-bold text-xl mb-6">Job Details</h3>

              <img
                src={selected.photoUrl}
                className="w-full h-48 object-cover rounded-2xl mb-6 border border-gray-100"
                alt="Evidence"
                referrerPolicy="no-referrer"
              />

              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Description</label>
                  <p className="text-sm text-gray-600 mt-1">{selected.description}</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Assigned Worker</label>
                  <p className="text-sm font-semibold mt-1">{selected.workerName || user.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateStatus(selected.id, 'In Progress')}
                  className="bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                >
                  Start Work
                </button>

                <button
                  onClick={() => updateStatus(selected.id, 'Resolved')}
                  className="bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                >
                  Mark Resolved
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="bg-gray-50 rounded-3xl p-8 border border-dashed border-gray-200 text-center text-gray-400 text-sm">
              Select a job to view details and update status
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const colors = {
    High: 'bg-red-100 text-red-700 border-red-200',
    Medium: 'bg-orange-100 text-orange-700 border-orange-200',
    Low: 'bg-gray-100 text-gray-600 border-gray-200'
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[priority]}`}>
      {priority}
    </span>
  );
}

function StatusTimeline({ status }: { status: Status }) {
  const steps: Status[] = ['Submitted', 'In Progress', 'Resolved (Pending Admin)', 'Closed'];
  const normalized =
  status === 'Resolved' ? 'Resolved (Pending Admin)' : status;

const currentIdx = steps.indexOf(normalized as Status);

  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
            idx <= currentIdx ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 text-gray-300'
          }`}>
            {idx <= currentIdx ? <CheckCircle2 size={12} /> : <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />}
          </div>
          <span className={`text-[11px] font-bold ${idx <= currentIdx ? 'text-black' : 'text-gray-300'}`}>{step}</span>
        </div>
      ))}
    </div>
  );
}
