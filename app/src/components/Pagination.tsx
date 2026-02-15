'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build page numbers: first, last, and neighbors of current page with ellipsis for gaps
  const pages: number[] = [];
  const addPage = (p: number) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) {
      pages.push(p);
    }
  };

  addPage(1);
  for (let i = page - 1; i <= page + 1; i++) addPage(i);
  addPage(totalPages);

  // Insert ellipsis between non-consecutive numbers
  const withEllipsis: (number | 'ellipsis')[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (i > 0 && p - pages[i - 1] > 1) {
      withEllipsis.push('ellipsis');
    }
    withEllipsis.push(p);
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      {/* Page indicator */}
      <div className="text-xs text-vault-dim">
        Page <span className="font-mono text-vault-muted">{page}</span> of{' '}
        <span className="font-mono text-vault-muted">{totalPages}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-vault-muted transition-all ${
            page <= 1
              ? 'pointer-events-none opacity-25'
              : 'border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-vault-text'
          }`}
          aria-label="First page"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-vault-muted transition-all ${
            page <= 1
              ? 'pointer-events-none opacity-25'
              : 'border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-vault-text'
          }`}
          aria-label="Previous page"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-white/[0.06]" />

        {/* Page numbers */}
        {withEllipsis.map((item, i) =>
          item === 'ellipsis' ? (
            <span key={`e${i}`} className="flex h-9 w-6 items-center justify-center text-xs text-vault-dim">
              ...
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-2 font-mono text-xs font-medium transition-all ${
                item === page
                  ? 'bg-vault-accent text-vault-bg shadow-[0_0_12px_rgba(249,115,22,0.2)]'
                  : 'border border-white/[0.06] bg-white/[0.02] text-vault-muted hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-vault-text'
              }`}
            >
              {item}
            </button>
          )
        )}

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-white/[0.06]" />

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-vault-muted transition-all ${
            page >= totalPages
              ? 'pointer-events-none opacity-25'
              : 'border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-vault-text'
          }`}
          aria-label="Next page"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-vault-muted transition-all ${
            page >= totalPages
              ? 'pointer-events-none opacity-25'
              : 'border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-vault-text'
          }`}
          aria-label="Last page"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
