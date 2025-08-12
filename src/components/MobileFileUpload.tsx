'use client';

import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Camera, FolderOpen, X, FileText } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { animated, useSpring, useSprings } from '@react-spring/web';

const AnimatedDiv = animated('div');

interface MobileFileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}

export const MobileFileUpload: React.FC<MobileFileUploadProps> = ({
  onFilesSelected,
  disabled = false,
  maxFiles = 10,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const { triggerSelection, triggerImpact, triggerError } = useHapticFeedback();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      triggerError();
      return;
    }

    triggerSelection();
    const newFiles = [...selectedFiles, ...acceptedFiles].slice(0, maxFiles);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  }, [selectedFiles, maxFiles, onFilesSelected, triggerSelection, triggerError]);

  const { getRootProps, getInputProps, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles,
    disabled,
    onDragEnter: () => {
      setIsDragActive(true);
      triggerSelection();
    },
    onDragLeave: () => setIsDragActive(false),
  });

  const removeFile = useCallback((index: number) => {
    triggerImpact();
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  }, [selectedFiles, onFilesSelected, triggerImpact]);

  const handleCameraCapture = useCallback(() => {
    if (cameraInputRef.current) {
      triggerSelection();
      cameraInputRef.current.click();
    }
  }, [triggerSelection]);

  const handleFileInput = useCallback(() => {
    if (fileInputRef.current) {
      triggerSelection();
      fileInputRef.current.click();
    }
  }, [triggerSelection]);

  const handleCameraFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onDrop(files, []);
    }
  }, [onDrop]);

  // Animation for drag state
  const dropzoneSpring = useSpring({
    scale: isDragActive ? 1.02 : 1,
    backgroundColor: isDragActive ? '#1e40af20' : '#374151',
    borderColor: isDragActive ? '#3b82f6' : isDragReject ? '#ef4444' : '#6b7280',
    config: { tension: 300, friction: 20 },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Springs for each selected file item to avoid calling hooks inside a loop
  const itemSprings = useSprings(
    selectedFiles.length,
    selectedFiles.map(() => ({
      from: { opacity: 0, scale: 0.95 },
      to: { opacity: 1, scale: 1 },
      config: { tension: 400, friction: 30 },
    }))
  );

  return (
    <div className="space-y-4">
      {/* Main dropzone */}
      <AnimatedDiv
        {...getRootProps()}
        style={dropzoneSpring}
        className={`
          relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}
          ${isDragReject ? 'border-red-500 bg-red-500/10' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 rounded-full bg-blue-600/20">
            <Upload className="h-8 w-8 text-blue-400" />
          </div>
          
          <div className="space-y-2">
            <p className="text-lg font-medium text-white">
              {isDragActive ? 'Drop your PDFs here' : 'Upload PDF Files'}
            </p>
            <p className="text-sm text-gray-400">
              Drag and drop or tap to select PDF files
            </p>
            <p className="text-xs text-gray-500">
              Maximum {maxFiles} files • PDF format only
            </p>
          </div>
        </div>

        {/* Loading overlay */}
        {disabled && (
          <div className="absolute inset-0 bg-gray-900/50 rounded-xl flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        )}
      </AnimatedDiv>

      {/* Mobile action buttons */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        <button
          onClick={handleFileInput}
          disabled={disabled}
          className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 
                   disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg 
                   font-medium transition-all duration-200 active:scale-95"
        >
          <FolderOpen className="h-4 w-4" />
          <span>Browse</span>
        </button>
        
        <button
          onClick={handleCameraCapture}
          disabled={disabled}
          className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 
                   disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg 
                   font-medium transition-all duration-200 active:scale-95"
        >
          <Camera className="h-4 w-4" />
          <span>Scan</span>
        </button>
      </div>

      {/* Hidden inputs for mobile */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        onChange={handleCameraFiles}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept=".pdf,application/pdf,image/*"
        capture="environment"
        onChange={handleCameraFiles}
        className="hidden"
      />

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-300">
            Selected Files ({selectedFiles.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <AnimatedDiv
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg
                         border border-gray-600"
                style={itemSprings[index]}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed
                           active:scale-90 transition-transform duration-150"
                >
                  <X className="h-4 w-4" />
                </button>
              </AnimatedDiv>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};