import { ReactNode } from 'react';
import clsx from 'clsx';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  as?: 'div' | 'article' | 'section';
}

export function GlassCard({ children, className, hover = false, glow = false, as: Tag = 'div' }: GlassCardProps) {
  return (
    <Tag
      className={clsx(
        'rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl',
        hover && 'transition-all duration-200 hover:border-vault-orange/30 hover:bg-white/[0.05]',
        glow && 'animate-pulse-border',
        className
      )}
    >
      {children}
    </Tag>
  );
}
