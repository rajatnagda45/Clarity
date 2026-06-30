import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/cn';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-2xs',
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '';
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

// Deterministic color from name
function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % avatarColors.length;
}

const avatarColors = [
  'bg-[#6366f1] text-white',
  'bg-[#0ea5e9] text-white',
  'bg-[#10b981] text-white',
  'bg-[#f59e0b] text-white',
  'bg-[#ef4444] text-white',
  'bg-[#8b5cf6] text-white',
  'bg-[#ec4899] text-white',
  'bg-[#14b8a6] text-white',
];

export function Avatar({ src, name = '', size = 'md', className }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const base = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none',
    sizeClasses[size],
    className,
  );

  if (src && !imgFailed) {
    return (
      <Image
        src={src}
        alt={name || 'User avatar'}
        width={40}
        height={40}
        className={cn(base, 'object-cover')}
        onError={() => setImgFailed(true)}
        unoptimized
      />
    );
  }

  if (name) {
    const colorClass = avatarColors[getColorIndex(name)];
    return (
      <span aria-label={name} className={cn(base, colorClass)}>
        {getInitials(name)}
      </span>
    );
  }

  // Anonymous fallback
  return (
    <span
      aria-hidden="true"
      className={cn(base, 'bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]')}
    >
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-[55%] w-[55%]" aria-hidden="true">
        <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 9c-3.314 0-6 1.343-6 3v1h12v-1c0-1.657-2.686-3-6-3z" />
      </svg>
    </span>
  );
}

interface AvatarGroupProps {
  avatars: { src?: string | null; name?: string }[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarGroup({ avatars, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;

  const ringSize = size === 'xs' ? 'ring-1' : 'ring-2';

  return (
    <div className={cn('flex -space-x-1.5', className)}>
      {visible.map((a, i) => (
        <Avatar
          key={i}
          src={a.src}
          name={a.name}
          size={size}
          className={cn(
            `${ringSize} ring-[var(--color-bg-surface)]`,
          )}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full font-medium',
            'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
            `${ringSize} ring-[var(--color-bg-surface)]`,
            sizeClasses[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
