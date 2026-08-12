import type { CSSProperties } from 'react';

interface StripedThumbProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const SIZE_CLASS: Record<string, string> = { sm: 'thumb--sm', md: 'thumb--md', lg: 'thumb--lg', xl: '' };

export function StripedThumb({ size = 'xl', label, className, style }: StripedThumbProps) {
  const classes = ['thumb', SIZE_CLASS[size], className].filter(Boolean).join(' ');
  return (
    <div className={classes} style={style}>
      {label && <div className="thumb__label">{label}</div>}
    </div>
  );
}
