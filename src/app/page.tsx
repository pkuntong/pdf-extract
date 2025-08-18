'use client';

import { useState, useCallback, useEffect } from 'react';
import { Download, FileText, Wifi, WifiOff, Smartphone, RefreshCw, Crown, Zap, BarChart3 } from 'lucide-react';
import { ExtractionResult } from '@/types/extraction';
import { MobileFileUpload } from '@/components/MobileFileUpload';
import { PullToRefresh } from '@/components/PullToRefresh';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';


// Define the BeforeInstallPromptEvent interface
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Home() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInstallPromptVisible, setIsInstallPromptVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPremium] = useState(false); // TODO: Connect to auth/subscription system
  
  const { triggerSuccess, triggerError, triggerImpact } = useHapticFeedback();
  const { isOnline, saveExtraction } = useOfflineStorage();


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

  const handleInstallApp = async () => {
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
  };

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
    triggerImpact();
  }, [triggerImpact]);

  const handleRefresh = useCallback(async () => {
    setExtractedData([]);
    setFiles([]);
    triggerSuccess();
    toast.success('Refreshed!');
  }, [triggerSuccess]);

  const handleExtractPDFs = async () => {
    if (files.length === 0) {
      toast.error('Please select files first');
      return;
    }

    // Check premium limits
    if (!isPremium && files.length > 5) {
      toast.error('Free plan allows up to 5 files. Upgrade to Pro for more!');
      return;
    }

    setLoading(true);
    triggerImpact();

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      // Use enhanced API for premium features, simple for free (more reliable)
      const apiEndpoint = isPremium ? '/api/extract-enhanced' : '/api/extract-simple';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Extraction failed');
      }

      setExtractedData(data.extractions || []);
      
      // Save to offline storage
      await saveExtraction(data.extractions || [], files);

      triggerSuccess();
      toast.success(`Extracted data from ${data.extractions?.length || 0} files!`);
    } catch (error) {
      console.error('Extraction error:', error);
      triggerError();
      toast.error(error instanceof Error ? error.message : 'Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (extractedData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const csvData = extractedData.map(result => ({
      filename: result.filename,
      invoiceNumber: result.invoiceNumber || '',
      vendor: result.vendor || '',
      total: result.total || '',
      date: result.date || '',
      error: result.error || ''
    }));

    const csvContent = [
      'Filename,Invoice Number,Vendor,Total,Date,Error',
      ...csvData.map(row => 
        `"${row.filename}","${row.invoiceNumber}","${row.vendor}","${row.total}","${row.date}","${row.error}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pdf-extraction-results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Data exported successfully!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="container mx-auto px-4 py-8 safe-area-inset">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  PDF Extract Pro
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Extract invoice data from PDFs with AI precision
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Online Status */}
                <div className="flex items-center gap-2 text-sm">
                  {isOnline ? (
                    <><Wifi className="h-4 w-4 text-green-500" /> Online</>
                  ) : (
                    <><WifiOff className="h-4 w-4 text-red-500" /> Offline</>
                  )}
                </div>
                
                {/* Navigation */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard')}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
                <Button
                  variant="premium"
                  size="sm"
                  onClick={() => router.push('/pricing')}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  {isPremium ? 'Premium' : 'Upgrade'}
                </Button>
              </div>
            </div>
          </div>

          {/* Premium Features Banner */}
          {!isPremium && (
            <Card className="mb-8 border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crown className="h-8 w-8 text-yellow-600" />
                    <div>
                      <h3 className="font-semibold text-yellow-800">Unlock Premium Features</h3>
                      <p className="text-yellow-700 text-sm">
                        Bulk processing, advanced extraction, CSV export & more
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="premium" 
                    onClick={() => router.push('/pricing')}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PWA Install Prompt */}
          {isInstallPromptVisible && (
            <Card className="mb-8 border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-8 w-8 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-blue-800">Install PDF Extract Pro</h3>
                      <p className="text-blue-700 text-sm">
                        Add to your home screen for quick access and offline use
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsInstallPromptVisible(false)}
                    >
                      Not now
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleInstallApp}
                    >
                      Install
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Upload PDF Files
                  </CardTitle>
                  <CardDescription>
                    {isPremium 
                      ? 'Upload up to 50 files at once for bulk processing'
                      : 'Upload up to 5 PDFs (2MB each) in free plan'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MobileFileUpload
                    onFilesSelected={handleFilesSelected}
                    disabled={loading}
                    maxFiles={isPremium ? 50 : 5}
                  />
                  
                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Selected files ({files.length}):</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {files.map((file, index) => (
                          <div key={index} className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                            {file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleExtractPDFs}
                    disabled={loading || files.length === 0}
                    loading={loading}
                    className="w-full mt-4"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processing {files.length} file{files.length !== 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Extract Data
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Results Section */}
            <div>
              <div className={extractedData.length > 0 ? 'opacity-100 transition-opacity duration-300' : 'opacity-0 h-0 overflow-hidden transition-all duration-300'}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Extraction Results
                        </CardTitle>
                        <CardDescription>
                          Extracted invoice data from your PDFs
                        </CardDescription>
                      </div>
                      {extractedData.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportCSV}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {extractedData.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No extractions yet</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Upload PDF files to see extracted data here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {extractedData.map((result, index) => (
                          <div
                            key={index}
                            className="border rounded-lg p-4 space-y-2 bg-white dark:bg-gray-800"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm">{result.filename}</h4>
                              {result.error ? (
                                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                  Error
                                </span>
                              ) : (
                                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                  Success
                                </span>
                              )}
                            </div>
                            
                            {result.error ? (
                              <p className="text-sm text-red-600">{result.error}</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="font-medium">Invoice #:</span>
                                  <p className="text-gray-600 dark:text-gray-400">
                                    {result.invoiceNumber || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-medium">Vendor:</span>
                                  <p className="text-gray-600 dark:text-gray-400">
                                    {result.vendor || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-medium">Total:</span>
                                  <p className="text-gray-600 dark:text-gray-400">
                                    {result.total ? `$${result.total}` : 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-medium">Date:</span>
                                  <p className="text-gray-600 dark:text-gray-400">
                                    {result.date || 'N/A'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </PullToRefresh>
      
      <Toaster 
        position="bottom-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}