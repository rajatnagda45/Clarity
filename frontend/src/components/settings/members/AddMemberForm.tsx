'use client';
import { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { useAddMember } from '@/hooks/useWorkspaceMembers';

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer', description: 'Can read documents and run queries' },
  { value: 'editor', label: 'Editor', description: 'Can also upload and run evaluations' },
  { value: 'owner', label: 'Owner', description: 'Full access including billing and members' },
] as const;

export function AddMemberForm() {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor' | 'owner'>('viewer');
  const [error, setError] = useState<string | null>(null);
  const addMember = useAddMember();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = userId.trim();
    if (!trimmed) return;

    try {
      await addMember.mutateAsync({ userId: trimmed, role });
      setUserId('');
      setRole('viewer');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to add member';
      setError(msg.includes('409') || msg.toLowerCase().includes('already') ? 'This user is already a member.' : msg);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 space-y-4"
    >
      <h3 className="text-sm font-semibold text-[#F1F3F9] flex items-center gap-2">
        <UserPlus size={15} className="text-purple-400" />
        Add Member
      </h3>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs text-[#8892AA] font-medium mb-1.5 block">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="user_2abc…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder-[#4A5168] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors"
          />
        </div>

        <div className="sm:w-40">
          <label className="text-xs text-[#8892AA] font-medium mb-1.5 block">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors appearance-none"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#0F1117]">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:self-end">
          <button
            type="submit"
            disabled={!userId.trim() || addMember.isPending}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {addMember.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UserPlus size={14} />
            )}
            Add
          </button>
        </div>
      </div>

      {/* Role description hint */}
      <p className="text-xs text-[#4A5168]">
        {ROLE_OPTIONS.find((o) => o.value === role)?.description}
      </p>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </form>
  );
}
