'use client';

import { useState, useRef } from 'react';
import { Upload, File, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export default function FileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file =>
      file.name.endsWith('.csv') || file.name.endsWith('.txt')
    );

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));

    setFiles([...files, ...newFiles]);

    if (e.target) {
      e.target.value = '';
    }
  };

  const handleUpload = async (index: number) => {
    const updatedFiles = [...files];
    updatedFiles[index].status = 'uploading';
    setFiles(updatedFiles);

    // Simulate upload
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      updatedFiles[index].progress = i;
      setFiles([...updatedFiles]);
    }

    updatedFiles[index].status = 'completed';
    setFiles([...updatedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadAll = () => {
    files.forEach((file, index) => {
      if (file.status === 'pending') {
        handleUpload(index);
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">File Upload</h3>
        <p className="text-sm text-muted">Upload CSV or TXT files containing credentials</p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-primary rounded-xl p-8 text-center cursor-pointer transition-colors group"
      >
        <Upload className="w-12 h-12 text-muted group-hover:text-primary mx-auto mb-4 transition-colors" />
        <p className="text-foreground font-medium mb-1">Click to upload files</p>
        <p className="text-sm text-muted">or drag and drop</p>
        <p className="text-xs text-muted mt-2">CSV or TXT files only (max 50MB)</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Uploaded Files ({files.length})</h4>
            <button
              onClick={uploadAll}
              disabled={files.every(f => f.status !== 'pending')}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload All
            </button>
          </div>

          <div className="space-y-2">
            {files.map((fileItem, index) => (
              <div key={index} className="bg-background border border-border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <File className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {fileItem.file.name}
                      </p>
                      <p className="text-xs text-muted">
                        {formatFileSize(fileItem.file.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {fileItem.status === 'pending' && (
                      <button
                        onClick={() => handleUpload(index)}
                        className="px-3 py-1 bg-primary hover:bg-primary-hover text-white rounded text-xs font-medium transition-colors"
                      >
                        Upload
                      </button>
                    )}
                    {fileItem.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    )}
                    {fileItem.status === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-accent" />
                    )}
                    {fileItem.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-danger" />
                    )}
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-danger/10 text-muted hover:text-danger rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {fileItem.status === 'uploading' && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${fileItem.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted mt-1">{fileItem.progress}% uploaded</p>
                  </div>
                )}

                {fileItem.status === 'completed' && (
                  <p className="text-xs text-accent mt-2">Upload completed successfully</p>
                )}

                {fileItem.status === 'error' && (
                  <p className="text-xs text-danger mt-2">{fileItem.error || 'Upload failed'}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
