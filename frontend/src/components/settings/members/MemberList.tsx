'use client';
import { useState } from 'react';
import { Crown, Edit3, Eye, MoreVertical, Trash2, Loader2 } from 'lucide-react';
import { useWorkspaceMembers, useUpdateMemberRole, useRemoveMember } from '@/hooks/useWorkspaceMembers';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ConfirmRemoveDialog } from './ConfirmRemoveDialog';
import type { WorkspaceMember } from '@/types/clarity';
import type { Role } from '@/types/clarity';

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  owner:  <Crown size={12} className="text-amber-400" />,
  editor: <Edit3 size={12} className="text-blue-400" />,
  viewer: <Eye  size={12} className="text-[#8892AA]" />,
};

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

function MemberRow({
  member,
  isCurrentOwner,
  onRemove,
  onRoleChange,
}: {
  member: WorkspaceMember;
  isCurrentOwner: boolean;
  onRemove: (userId: string) => void;
  onRoleChange: (userId: string, role: Role) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const updateRole = useUpdateMemberRole();

  const initials = member.userId.substring(0, 2).toUpperCase();
  const joinedDate = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const handleRoleChange = async (role: Role) => {
    setMenuOpen(false);
    onRoleChange(member.userId, role);
  };

  return (
    <div className="flex items-center justify-between py-3 px-5 hover:bg-white/[0.02] transition-colors group">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium text-[#F1F3F9] font-mono">{member.userId}</p>
          {joinedDate && (
            <p className="text-xs text-[#4A5168]">Joined {joinedDate}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs font-medium text-[#C4CBD9]">
          {ROLE_ICONS[member.role]}
          {ROLE_LABELS[member.role]}
        </span>

        {isCurrentOwner && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-[#4A5168] hover:text-[#F1F3F9] opacity-0 group-hover:opacity-100"
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-40 w-44 bg-[#0F1117] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden py-1">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#4A5168]">
                    Change role
                  </p>
                  {(['owner', 'editor', 'viewer'] as Role[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRoleChange(r)}
                      disabled={r === member.role || updateRole.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#C4CBD9] hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                    >
                      {ROLE_ICONS[r]}
                      {ROLE_LABELS[r]}
                      {r === member.role && <span className="ml-auto text-[10px] text-purple-400">Current</span>}
                    </button>
                  ))}
                  <div className="border-t border-white/[0.06] mt-1 pt-1">
                    <button
                      onClick={() => { setMenuOpen(false); onRemove(member.userId); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <Trash2 size={12} />
                      Remove member
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MemberList() {
  const { data, isLoading, error } = useWorkspaceMembers();
  const { activeWorkspace } = useWorkspace();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const isOwner = activeWorkspace?.role === 'owner';

  const handleRoleChange = async (userId: string, role: Role) => {
    setRoleError(null);
    try {
      await updateRole.mutateAsync({ userId, role });
    } catch {
      setRoleError('Could not update role. You may not be able to demote the last owner.');
    }
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemove) return;
    try {
      await removeMember.mutateAsync(pendingRemove);
    } finally {
      setPendingRemove(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-8 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[#4A5168]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
        <p className="text-sm text-red-400">Failed to load members. Please try again.</p>
      </div>
    );
  }

  const members = data?.members ?? [];

  return (
    <>
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#F1F3F9]">Team Members</h3>
            <p className="text-xs text-[#8892AA] mt-0.5">{data?.total ?? 0} member{data?.total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
              <Crown size={20} className="text-[#4A5168]" />
            </div>
            <p className="text-sm font-medium text-[#F1F3F9] mb-1">No members yet</p>
            <p className="text-xs text-[#8892AA]">Add teammates using the form above to start collaborating.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                isCurrentOwner={isOwner}
                onRemove={setPendingRemove}
                onRoleChange={handleRoleChange}
              />
            ))}
          </div>
        )}

        {roleError && (
          <div className="px-5 py-3 bg-red-500/10 border-t border-red-500/20">
            <p className="text-xs text-red-400">{roleError}</p>
          </div>
        )}
      </div>

      {pendingRemove && (
        <ConfirmRemoveDialog
          userId={pendingRemove}
          onConfirm={handleConfirmRemove}
          onCancel={() => setPendingRemove(null)}
          isLoading={removeMember.isPending}
        />
      )}
    </>
  );
}
