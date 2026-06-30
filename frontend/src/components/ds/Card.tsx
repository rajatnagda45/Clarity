import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CardElevation = 1 | 2;

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  children: ReactNode;
}

const elevations: Record<CardElevation, string> = {
  1: 'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] shadow-xs',
  2: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-sm',
};

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation = 1, padding = 'md', hoverable = false, children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl',
        elevations[elevation],
        paddings[padding],
        hoverable &&
          'cursor-pointer transition-[border-color,box-shadow] duration-normal ease-default hover:border-[var(--color-border-default)] hover:shadow-md',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn('mb-3', className)} {...props}>
      {children}
    </div>
  );
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

export function CardTitle({ children, className, as: Tag = 'h3', ...props }: CardTitleProps) {
  return (
    <Tag
      className={cn(
        'text-base font-semibold leading-snug text-[var(--color-text-primary)]',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export function CardDescription({ children, className, ...props }: CardDescriptionProps) {
  return (
    <p
      className={cn(
        'mt-0.5 text-sm text-[var(--color-text-secondary)]',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
