'use client';

import { useState } from 'react';

interface OrganizationsPaginationProps {
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function OrganizationsPagination({
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: OrganizationsPaginationProps) {
  const [jumpToPage, setJumpToPage] = useState('');
  
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(jumpToPage);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpToPage('');
    }
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
      {/* Left: Show per page selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted font-medium">Show:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 cursor-pointer hover:bg-card-hover"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={75}>75</option>
          <option value={100}>100</option>
        </select>
      </div>

      {/* Center: Page navigation */}
      <nav aria-label="Page navigation" className="flex items-center gap-3 flex-wrap justify-center">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrevious}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground bg-background hover:bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
            title="Previous Page"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <span key={`ellipsis-${index}`} className="px-1.5 py-1.5 text-xs text-muted">
                    ...
                  </span>
                );
              }
              
              const pageNum = page as number;
              const isActive = pageNum === currentPage;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-w-[32px] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isActive
                      ? 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                      : 'text-foreground bg-background hover:bg-card-hover'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground bg-background hover:bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
            title="Next Page"
          >
            Next
          </button>
        </div>

        {/* Jump to page */}
        <form onSubmit={handleJumpToPage} className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <label htmlFor="jumpToPage" className="text-xs font-medium text-muted shrink-0">
              Go to
            </label>
            <input
              id="jumpToPage"
              type="text"
              placeholder={currentPage.toString()}
              value={jumpToPage}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setJumpToPage(value);
              }}
              className="w-10 px-1.5 py-1.5 bg-background border border-border rounded-lg text-foreground text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 placeholder:text-muted hover:bg-card-hover"
            />
            <span className="text-xs font-medium text-muted">page</span>
          </div>
        </form>
      </nav>

      {/* Right: Results count */}
      <div className="text-xs text-muted font-medium whitespace-nowrap">
        Showing <span className="font-semibold text-foreground">{startItem}</span> to{' '}
        <span className="font-semibold text-foreground">{endItem}</span> of{' '}
        <span className="font-semibold text-foreground">{total}</span> {total === 1 ? 'organization' : 'organizations'}
      </div>
    </div>
  );
}

