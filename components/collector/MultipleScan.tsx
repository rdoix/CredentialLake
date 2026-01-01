'use client';

import { useState } from 'react';
import { Search, Loader2, Plus, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

export default function MultipleScan() {
  const toast = useToast();
  const [keywords, setKeywords] = useState<string[]>(['']);
  const [isScanning, setIsScanning] = useState(false);

  const addKeyword = () => {
    setKeywords([...keywords, '']);
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const updateKeyword = (index: number, value: string) => {
    const updated = [...keywords];
    updated[index] = value;
    setKeywords(updated);
  };

  const handleBulkScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const validKeywords = keywords.filter(k => k.trim());

    if (validKeywords.length === 0) return;

    setIsScanning(true);

    // Simulate API call
    setTimeout(() => {
      setIsScanning(false);
      toast.success('Bulk Scan Started', `Scanning ${validKeywords.length} domains/keywords`);
      setKeywords(['']);
    }, 2000);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        setKeywords(lines);
      }
    } catch (err) {
      toast.error('Clipboard Error', 'Failed to read from clipboard');
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">Multiple Domain/Keyword Scan</h3>
        <p className="text-sm text-muted">Scan multiple domains or keywords in a single batch operation</p>
      </div>

      <form onSubmit={handleBulkScan} className="space-y-4">
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {keywords.map((keyword, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => updateKeyword(index, e.target.value)}
                placeholder={`Domain or keyword ${index + 1}`}
                className="flex-1 px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {keywords.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeKeyword(index)}
                  className="px-3 py-3 bg-danger/10 hover:bg-danger/20 text-danger rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={addKeyword}
            className="flex-1 px-4 py-2 bg-card-hover hover:bg-border text-foreground rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add More
          </button>
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="flex-1 px-4 py-2 bg-card-hover hover:bg-border text-foreground rounded-lg font-medium transition-colors"
          >
            Paste from Clipboard
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Total Targets</p>
            <p className="text-xs text-muted">Domains/keywords to scan</p>
          </div>
          <div className="text-2xl font-bold text-primary">
            {keywords.filter(k => k.trim()).length}
          </div>
        </div>

        <button
          type="submit"
          disabled={isScanning || keywords.filter(k => k.trim()).length === 0}
          className="w-full px-6 py-3 bg-secondary hover:bg-secondary/90 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting Bulk Scan...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Start Bulk Scan
            </>
          )}
        </button>
      </form>
    </div>
  );
}
