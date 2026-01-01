'use client';

import { useState, KeyboardEvent, ClipboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function TagInput({ tags, onChange, placeholder = 'Enter keywords...', className = '' }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      removeTag(tags.length - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    // Split by common separators: comma, semicolon, newline, space
    const newTags = pastedText
      .split(/[,;\n\s]+/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0 && !tags.includes(tag));
    
    if (newTags.length > 0) {
      onChange([...tags, ...newTags]);
      setInputValue('');
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="min-h-[120px] px-3 py-2 bg-background border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent">
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="hover:text-primary-hover focus:outline-none"
                aria-label={`Remove ${tag}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="w-full bg-transparent text-foreground placeholder:text-muted focus:outline-none text-sm"
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Press Enter or comma to add. Paste multiple domains separated by commas, spaces, or new lines.
      </p>
    </div>
  );
}