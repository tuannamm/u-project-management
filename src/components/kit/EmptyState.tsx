import type { ReactNode } from 'react';

// Adapted from front-end-kit/core/empty-state for the local table component.
export function EmptyState({ title }: { size?: 'sm' | 'md'; title: ReactNode }) {
  return <div className="dtx-empty" role="status"><p>{title}</p></div>;
}
