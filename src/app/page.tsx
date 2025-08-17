'use client';

import { useState, useCallback, useEffect } from 'react';
import { Download, FileText, Wifi, WifiOff, Smartphone, RefreshCw } from 'lucide-react';
import { ExtractionResult } from '@/types/extraction';
import { MobileFileUpload } from '@/components/MobileFileUpload';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { animated, useSpring, useTransition } from '@react-spring/web';

// Type the animated div properly
const AnimatedDiv = animated('div');
import toast, { Toaster } from 'react-hot-toast';

// Define the BeforeInstallPromptEvent interface
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInstallPromptVisible, setIsInstallPromptVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  
  const { triggerSuccess, triggerError, triggerImpact } = useHapticFeedback();
  const { isOnline, saveExtraction, getExtractions } = useOfflineStorage();

  // Define animations at the top level to avoid conditional hook calls
  const headerSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(-20px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 280, friction: 20 },
  });

  const resultsSpring = useSpring({
    opacity: extractedData.length > 0 ? 1 : 0,
    transform: extractedData.length > 0 ? 'translateY(0px)' : 'translateY(20px)',
    config: { tension: 280, friction: 20 },
  });

  // PWA install prompt handling
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallPromptVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (!deferredPrompt) return;
    
    triggerImpact();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      triggerSuccess();
      toast.success('App installed successfully!');
    }
    
    setDeferredPrompt(null);
    setIsInstallPromptVisible(false);
  }, [deferredPrompt, triggerImpact, triggerSuccess]);

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
    triggerImpact();
  }, [triggerImpact]);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) {
      toast.error('Please select PDF files first');
      return;
    }
    
    setLoading(true);
    triggerImpact();
    
    try {
      if (!isOnline) {
        // Offline mode - save files for later processing
        await saveExtraction([], files);
        toast.success('Files saved offline. Will process when online.');
        return;
      }

      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      toast.loading('Processing PDF files...', { id: 'upload' });
      
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setExtractedData(data.extractions);
      
      // Save successful extraction
      await saveExtraction(data.extractions, files);
      
      triggerSuccess();
      toast.success('Data extracted successfully!', { id: 'upload' });
      
    } catch (error) {
      console.error('Error:', error);
      triggerError();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error processing files: ${errorMessage}`, { id: 'upload' });
    } finally {
      setLoading(false);
    }
  }, [files, isOnline, saveExtraction, triggerImpact, triggerSuccess, triggerError]);

  const downloadCSV = useCallback(() => {
    if (extractedData.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    triggerImpact();

    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headers = ['Filename', 'Invoice Number', 'Date', 'Vendor', 'Total Amount', 'Error'];
    const csvContent = [
      headers.join(','),
      ...extractedData.map(row => 
        [
          escapeCSV(row.filename || ''),
          escapeCSV(row.invoiceNumber || ''),
          escapeCSV(row.date || ''),
          escapeCSV(row.vendor || ''),
          escapeCSV(row.total || ''),
          escapeCSV(row.error || '')
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    triggerSuccess();
    toast.success('CSV file downloaded!');
  }, [extractedData, triggerImpact, triggerSuccess]);
  
  const handleRefresh = useCallback(async () => {
    if (files.length > 0) {
      await handleUpload();
    } else {
      // Load recent extractions from offline storage
      const recent = await getExtractions();
      if (recent.length > 0) {
        setExtractedData(recent[0].results);
        toast.success('Loaded recent extractions');
      }
    }
  }, [files, handleUpload, getExtractions]);

  const installPromptTransition = useTransition(isInstallPromptVisible, {
    from: { opacity: 0, transform: 'translateY(-100%)' },
    enter: { opacity: 1, transform: 'translateY(0%)' },
    leave: { opacity: 0, transform: 'translateY(-100%)' },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900 text-white">
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#374151',
            color: '#f3f4f6',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#f3f4f6',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#f3f4f6',
            },
          },
        }}
      />
      
      <PullToRefresh onRefresh={handleRefresh} disabled={loading}>
        <div className="safe-area-inset px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            
            {/* PWA Install Banner */}
            {installPromptTransition((style, item) =>
              item ? (
                <AnimatedDiv style={style} className="mb-4">
                  <div className="bg-blue-600 rounded-xl p-4 flex items-center justify-between shadow-lg">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="h-6 w-6 text-white" />
                      <div>
                        <p className="font-medium text-white">Install App</p>
                        <p className="text-xs text-blue-100">Add to home screen for quick access</p>
                      </div>
                    </div>
                    <button
                      onClick={handleInstallApp}
                      className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium text-sm
                               hover:bg-blue-50 transition-colors active:scale-95 duration-150"
                    >
                      Install
                    </button>
                  </div>
                </AnimatedDiv>
              ) : null
            )}
            
            {/* Online/Offline Status */}
            <div className="mb-6">
              <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium
                            ${isOnline ? 'bg-green-600/20 text-green-400' : 'bg-orange-600/20 text-orange-400'}`}>
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
              </div>
            </div>

            {/* Header */}
            <AnimatedDiv style={headerSpring} className="text-center mb-8 sm:mb-12">
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-2xl bg-blue-600/20 backdrop-blur-sm">
                  <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-blue-400" />
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent">
                PDF Invoice Extractor
              </h1>
              <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
                Upload PDF invoices and get structured data instantly. Works offline too!
              </p>
            </AnimatedDiv>

            {/* Upload Section */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 mb-8 border border-gray-700/50">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2 text-white">Upload Documents</h2>
                <p className="text-sm text-gray-400">Select PDF files to extract invoice data</p>
              </div>
              
              <MobileFileUpload
                onFilesSelected={handleFilesSelected}
                disabled={loading}
                maxFiles={10}
              />

              {files.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
                             disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed 
                             px-6 py-4 rounded-xl font-medium text-lg transition-all duration-200
                             flex items-center justify-center space-x-3 shadow-lg
                             active:scale-[0.98] transform"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-5 w-5" />
                        <span>Extract Data</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Results */}
            {extractedData.length > 0 && (
              <AnimatedDiv
                style={resultsSpring}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-gray-700/50"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
                  <div>
                    <h2 className="text-xl font-bold text-white">Extracted Data</h2>
                    <p className="text-sm text-gray-400">{extractedData.length} invoice{extractedData.length !== 1 ? 's' : ''} processed</p>
                  </div>
                  <button
                    onClick={downloadCSV}
                    className="flex items-center justify-center space-x-2 bg-gradient-to-r from-green-600 to-green-700 
                             hover:from-green-700 hover:to-green-800 px-6 py-3 rounded-xl transition-all
                             duration-200 font-medium shadow-lg active:scale-[0.98] transform"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export CSV</span>
                  </button>
                </div>

                {/* Mobile-optimized results display */}
                <div className="space-y-4 sm:space-y-0">
                  {/* Desktop table view */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-700">
                        <tr className="text-gray-300">
                          <th className="text-left py-3 font-medium">Filename</th>
                          <th className="text-left py-3 font-medium">Invoice #</th>
                          <th className="text-left py-3 font-medium">Date</th>
                          <th className="text-left py-3 font-medium">Vendor</th>
                          <th className="text-left py-3 font-medium">Total</th>
                          <th className="text-left py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedData.map((row, idx) => (
                          <tr key={idx} className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                            row.error ? 'bg-red-900/20' : ''
                          }`}>
                            <td className="py-3 text-gray-400">
                              {row.filename ? (
                                <span title={row.filename} className="truncate block max-w-[150px]">
                                  {row.filename.length > 20 
                                    ? `${row.filename.substring(0, 17)}...` 
                                    : row.filename
                                  }
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-3 text-white font-medium">{row.invoiceNumber || '-'}</td>
                            <td className="py-3 text-white">{row.date || '-'}</td>
                            <td className="py-3 text-white">{row.vendor || '-'}</td>
                            <td className="py-3 text-white font-medium">
                              {row.total ? `$${row.total}` : '-'}
                            </td>
                            <td className="py-3">
                              {row.error ? (
                                <span className="text-red-400 text-xs bg-red-400/10 px-2 py-1 rounded-full" title={row.error}>
                                  Error
                                </span>
                              ) : (
                                <span className="text-green-400 text-xs bg-green-400/10 px-2 py-1 rounded-full">Success</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card view */}
                  <div className="sm:hidden space-y-4">
                    {extractedData.map((row, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border transition-all duration-200 ${
                        row.error 
                          ? 'bg-red-900/20 border-red-500/30' 
                          : 'bg-gray-700/30 border-gray-600/50 hover:bg-gray-700/50'
                      }`}>
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-medium text-white truncate flex-1 mr-2">
                            {row.filename || 'Unknown file'}
                          </h3>
                          <div className={`px-2 py-1 rounded-full text-xs ${
                            row.error ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'
                          }`}>
                            {row.error ? 'Error' : 'Success'}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-400 block">Invoice #</span>
                            <span className="text-white font-medium">{row.invoiceNumber || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Date</span>
                            <span className="text-white">{row.date || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Vendor</span>
                            <span className="text-white truncate">{row.vendor || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Total</span>
                            <span className="text-white font-bold">
                              {row.total ? `$${row.total}` : '-'}
                            </span>
                          </div>
                        </div>
                        
                        {row.error && (
                          <div className="mt-3 p-2 bg-red-500/10 rounded-lg">
                            <p className="text-red-400 text-xs">{row.error}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </AnimatedDiv>
            )}
          </div>
        </div>
      </PullToRefresh>
    </div>
  );
}