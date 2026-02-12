'use client';

import { useSolPrice } from '@/hooks/useSolPrice';

interface SolPriceDisplayProps {
  detailed?: boolean;
  className?: string;
}

export default function SolPriceDisplay({ detailed = false, className = '' }: SolPriceDisplayProps) {
  const { price, source, age, isValid, loading } = useSolPrice({ fetchOnMount: true, realtime: true });
  
  if (loading && !price) {
    return (
      <div className={`flex items-center gap-2 text-vault-muted ${className}`}>
        <span className="text-xs font-medium">SOL</span>
        <span className="animate-pulse font-mono text-xs">---</span>
      </div>
    );
  }
  
  if (!price) {
    return (
      <div className={`flex items-center gap-2 text-vault-muted ${className}`}>
        <span className="text-xs font-medium">SOL</span>
        <span className="font-mono text-xs">--</span>
      </div>
    );
  }
  
  const formattedPrice = price.toFixed(2);
  const isStale = !isValid;
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-vault-muted">SOL</span>
      <span className={`font-mono text-sm font-medium ${isStale ? 'text-vault-muted' : 'text-vault-green'}`}>
        ${formattedPrice}
      </span>
      {isStale && (
        <span className="text-[10px] text-vault-muted" title="Price may be stale">
          !
        </span>
      )}
      {detailed && source && (
        <span className="hidden text-[10px] text-vault-muted sm:inline">
          via {source}
        </span>
      )}
      {detailed && age > 60 && (
        <span className="hidden text-[10px] text-vault-muted sm:inline">
          {Math.floor(age / 60)}m ago
        </span>
      )}
    </div>
  );
}
