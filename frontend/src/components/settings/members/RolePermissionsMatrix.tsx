'use client';
import { Check, Minus } from 'lucide-react';

const PERMISSIONS = [
  { label: 'View documents',        owner: true,  editor: true,  viewer: true  },
  { label: 'Upload documents',      owner: true,  editor: true,  viewer: false },
  { label: 'Delete documents',      owner: true,  editor: false, viewer: false },
  { label: 'Run AI queries',        owner: true,  editor: true,  viewer: true  },
  { label: 'Manage members',        owner: true,  editor: false, viewer: false },
  { label: 'Manage billing',        owner: true,  editor: false, viewer: false },
  { label: 'Access API keys',       owner: true,  editor: false, viewer: false },
  { label: 'View eval metrics',     owner: true,  editor: true,  viewer: true  },
  { label: 'Run evaluations',       owner: true,  editor: true,  viewer: false },
];

function Cell({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <div className="flex items-center justify-center">
      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <Check size={11} className="text-emerald-400" />
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center">
      <Minus size={14} className="text-[#4A5168]" />
    </div>
  );
}

export function RolePermissionsMatrix() {
  return (
    <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-[#F1F3F9]">Role Permissions</h3>
        <p className="text-xs text-[#8892AA] mt-0.5">What each role can do in this workspace</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left px-5 py-3 text-xs font-semibold text-[#8892AA] uppercase tracking-wider">
              Permission
            </th>
            {(['Owner', 'Editor', 'Viewer'] as const).map((role) => (
              <th
                key={role}
                className="text-center px-4 py-3 text-xs font-semibold text-[#8892AA] uppercase tracking-wider w-24"
              >
                {role}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((row, i) => (
            <tr
              key={row.label}
              className={`border-b border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
            >
              <td className="px-5 py-3 text-[#C4CBD9] text-sm">{row.label}</td>
              <td className="px-4 py-3"><Cell allowed={row.owner} /></td>
              <td className="px-4 py-3"><Cell allowed={row.editor} /></td>
              <td className="px-4 py-3"><Cell allowed={row.viewer} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
