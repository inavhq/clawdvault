'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build page numbers: first, last, and neighbors of current page with ellipsis for gaps
  const pages: (number | 'ellipsis')[] = [];
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
    const p = pages[i] as number;
    if (i > 0 && p - (pages[i - 1] as number) > 1) {
      withEllipsis.push('ellipsis');
    }
    withEllipsis.push(p);
  }

  const btnBase =
    'flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-xs font-medium transition-all';
  const btnInactive =
    'border border-white/[0.06] bg-white/[0.02] text-vault-muted hover:border-white/[0.1] hover:text-vault-text';
  const btnActive = 'bg-vault-accent text-vault-bg';
  const btnDisabled = 'pointer-events-none opacity-30';

  return (
    <div className="mt-6 flex items-center justify-center gap-1.5">
      {/* Prev */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={`${btnBase} ${btnInactive} ${page <= 1 ? btnDisabled : ''}`}
        aria-label="Previous page"
      >
        &lt;
      </button>

      {withEllipsis.map((item, i) =>
        item === 'ellipsis' ? (
          <span key={`e${i}`} className="px-1 text-xs text-vault-dim">
            ...
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            className={`${btnBase} ${item === page ? btnActive : btnInactive}`}
          >
            {item}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={`${btnBase} ${btnInactive} ${page >= totalPages ? btnDisabled : ''}`}
        aria-label="Next page"
      >
        &gt;
      </button>
    </div>
  );
}
