'use client';

import { useState, useCallback, useEffect } from 'react';
import { Download, FileText, Wifi, WifiOff, Smartphone, RefreshCw, Crown, Zap, BarChart3, LogIn } from 'lucide-react';
import { ExtractionResult } from '@/types/extraction';
import { MobileFileUpload } from '@/components/MobileFileUpload';
import { PullToRefresh } from '@/components/PullToRefresh';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { UserMenu } from '@/components/auth/UserMenu';
import toast, { Toaster } from 'react-hot-toast';


// Define the BeforeInstallPromptEvent interface
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Home() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const { isPremium } = useSubscription();
  const [files, setFiles] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInstallPromptVisible, setIsInstallPromptVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ocrMode, setOcrMode] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  
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



  const handleExtractPDFs = async () => {
    if (files.length === 0) {
      toast.error('Please select files first');
      return;
    }

    // Check limits based on OCR mode
    const maxFiles = ocrMode ? 3 : (isPremium ? 50 : 5);
    const maxFileSize = ocrMode ? 10 : (isPremium ? 15 : 10); // MB
    
    if (files.length > maxFiles) {
      toast.error(`${ocrMode ? 'OCR mode' : 'Free plan'} allows up to ${maxFiles} files. ${!isPremium ? 'Upgrade to Pro for more!' : ''}`);
      return;
    }

    // Check file sizes
    const oversizedFiles = files.filter(file => file.size > maxFileSize * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error(`${oversizedFiles.length} file(s) exceed ${maxFileSize}MB limit for ${ocrMode ? 'OCR processing' : 'current plan'}`);
      return;
    }

    setLoading(true);
    setProcessingStatus('Initializing...');
    triggerImpact();

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      // Choose API endpoint based on mode
      let apiEndpoint: string;
      if (ocrMode) {
        apiEndpoint = '/api/extract-ocr';
        setProcessingStatus('Processing with OCR (this may take longer)...');
      } else if (isPremium) {
        apiEndpoint = '/api/extract-enhanced';
        setProcessingStatus('Processing with premium features...');
      } else {
        apiEndpoint = '/api/extract-simple';
        setProcessingStatus('Processing PDFs...');
      }
      
      // Prepare headers
      const headers: HeadersInit = {};
      if (session?.access_token && (isPremium || apiEndpoint.includes('extract-enhanced'))) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Extraction failed');
      }

      setExtractedData(data.extractions || []);
      
      // Save to offline storage
      await saveExtraction(data.extractions || [], files);

      triggerSuccess();
      
      // Enhanced success message for OCR
      if (ocrMode && data.metadata?.ocrProcessed > 0) {
        toast.success(`OCR processed ${data.metadata.ocrProcessed} scanned files! Extracted data from ${data.extractions?.length || 0} total files.`);
      } else {
        toast.success(`Extracted data from ${data.extractions?.length || 0} files!`);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      triggerError();
      toast.error(error instanceof Error ? error.message : 'Extraction failed');
    } finally {
      setLoading(false);
      setProcessingStatus('');
    }
  };

  const handleExportCSV = () => {
    if (extractedData.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Enhanced CSV export with line items
    const csvRows: string[] = [];
    
    // Header row
    csvRows.push('Filename,Invoice Number,Vendor,Date,Subtotal,Tax,Tax Rate,Total,Line Item Description,Line Item Quantity,Line Item Unit Price,Line Item Amount,Error');
    
    extractedData.forEach(result => {
      if (result.error) {
        // For errors, just add one row
        csvRows.push(`"${result.filename || ''}","","","","","","","","","","","","${result.error}"`);
      } else if (result.lineItems && result.lineItems.length > 0) {
        // For invoices with line items, add one row per line item
        result.lineItems.forEach(item => {
          csvRows.push([
            `"${result.filename || ''}"`,
            `"${result.invoiceNumber || ''}"`,
            `"${result.vendor || ''}"`,
            `"${result.date || ''}"`,
            `"${result.subtotal || ''}"`,
            `"${result.tax || ''}"`,
            `"${result.taxRate || ''}"`,
            `"${result.total || ''}"`,
            `"${item.description || ''}"`,
            `"${item.quantity || ''}"`,
            `"${item.unitPrice || ''}"`,
            `"${item.amount || ''}"`,
            `""`
          ].join(','));
        });
      } else {
        // For invoices without line items, add one summary row
        csvRows.push([
          `"${result.filename || ''}"`,
          `"${result.invoiceNumber || ''}"`,
          `"${result.vendor || ''}"`,
          `"${result.date || ''}"`,
          `"${result.subtotal || ''}"`,
          `"${result.tax || ''}"`,
          `"${result.taxRate || ''}"`,
          `"${result.total || ''}"`,
          `"No line items extracted"`,
          `""`,
          `""`,
          `""`,
          `""`
        ].join(','));
      }
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf-extraction-detailed-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const totalLineItems = extractedData.reduce((sum, result) => 
      sum + (result.lineItems?.length || 0), 0);
    
    toast.success(`Detailed CSV exported with ${totalLineItems} line items!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <PullToRefresh>
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
                {user && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard')}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                )}
                
                <Button
                  variant="premium"
                  size="sm"
                  onClick={() => router.push('/pricing')}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  {isPremium ? 'Premium' : 'Upgrade'}
                </Button>

                {/* Auth UI */}
                {authLoading ? (
                  <div className="w-8 h-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                ) : user ? (
                  <UserMenu />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/auth')}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                )}
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

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Extract Invoice Data
              <br />
              <span className="text-4xl md:text-5xl">in Seconds</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              AI-powered PDF extraction that turns your invoices into structured data. 
              No more manual data entry. Perfect for accounting, bookkeeping, and business automation.
            </p>
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="flex items-center gap-2 text-green-600">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>No setup required</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Works offline</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Export to CSV</span>
              </div>
            </div>
          </div>

          {/* Screenshot Section */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">See It In Action</h3>
              <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Upload PDFs, extract data automatically, and export structured results. 
                Our AI handles invoices, receipts, purchase orders, and more.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {/* Screenshot Card 1 - Upload */}
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 h-48 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-800 rounded-xl flex items-center justify-center mb-4 mx-auto">
                      <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h4 className="font-semibold text-lg mb-2">1. Upload PDFs</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Drag & drop or browse files
                    </p>
                  </div>
                </div>
              </Card>

              {/* Screenshot Card 2 - Processing */}
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 h-48 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-800 rounded-xl flex items-center justify-center mb-4 mx-auto">
                      <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h4 className="font-semibold text-lg mb-2">2. AI Processing</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Extract data automatically
                    </p>
                  </div>
                </div>
              </Card>

              {/* Screenshot Card 3 - Results */}
              <Card className="overflow-hidden md:col-span-2 lg:col-span-1">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 h-48 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-xl flex items-center justify-center mb-4 mx-auto">
                      <Download className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h4 className="font-semibold text-lg mb-2">3. Export Data</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Download CSV or JSON
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">Powerful Features</h3>
              <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Everything you need to automate your document processing workflow
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="font-semibold text-lg mb-2">AI-Powered Extraction</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Advanced AI models extract invoice numbers, vendors, totals, dates, and line items with high accuracy.
                </p>
              </Card>

              {/* Feature 2 */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Multiple Formats</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Handle invoices, receipts, purchase orders, contracts, and bank statements with specialized patterns.
                </p>
              </Card>

              {/* Feature 3 */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                  <Download className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Export Options</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Export to CSV, JSON, or integrate with your accounting software via our API endpoints.
                </p>
              </Card>

              {/* Feature 4 */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4">
                  <Smartphone className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Mobile Optimized</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Works perfectly on phones and tablets. Install as a PWA for offline processing and quick access.
                </p>
              </Card>

              {/* Feature 5 */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
                  <WifiOff className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Offline Processing</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Process documents without internet. All data stays local until you choose to sync or export.
                </p>
              </Card>

              {/* Feature 6 */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Analytics Dashboard</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Track processing history, success rates, and spending patterns with detailed analytics and insights.
                </p>
              </Card>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h3>
              <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Start free, upgrade when you need more. No hidden fees, cancel anytime.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Plan */}
              <Card className="relative">
                <CardHeader className="text-center pb-8">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                  </div>
                  <CardTitle className="text-2xl">Free</CardTitle>
                  <CardDescription>Perfect for trying out PDF extraction</CardDescription>
                  <div className="text-4xl font-bold mt-4">$0<span className="text-lg text-gray-500">/month</span></div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">5 PDF extractions per month</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Basic invoice data extraction</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Files up to 2MB each</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Mobile-optimized interface</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Offline storage</span>
                    </li>
                  </ul>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="w-full"
                    onClick={() => {
                      document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Get Started Free
                  </Button>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="relative ring-2 ring-blue-500">
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 text-sm font-semibold rounded-t-lg">
                  Most Popular
                </div>
                <CardHeader className="text-center pb-8 pt-12">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Crown className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-2xl">Pro</CardTitle>
                  <CardDescription>For professionals and small businesses</CardDescription>
                  <div className="text-4xl font-bold mt-4">$9.99<span className="text-lg text-gray-500">/month</span></div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold">100 PDF extractions per month</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Advanced extraction patterns</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Bulk processing (up to 50 files)</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Files up to 15MB each</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Priority processing</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Analytics dashboard</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">Email support</span>
                    </li>
                  </ul>
                  <Button 
                    variant="premium" 
                    size="lg" 
                    className="w-full"
                    onClick={() => router.push('/pricing')}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-8">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Need more than 100 extractions per month?
              </p>
              <Button 
                variant="outline" 
                onClick={() => router.push('/pricing')}
              >
                View All Plans
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div id="upload-section" className="grid lg:grid-cols-2 gap-8">
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
                  {/* OCR Toggle */}
                  <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-800">
                          <svg className="h-4 w-4 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-medium text-purple-800 dark:text-purple-200">OCR Mode</h4>
                          <p className="text-xs text-purple-600 dark:text-purple-300">
                            Extract text from scanned PDFs and images (slower, max 3 files, 10MB each)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setOcrMode(!ocrMode)}
                        disabled={loading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                          ocrMode 
                            ? 'bg-purple-600' 
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            ocrMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <MobileFileUpload
                    onFilesSelected={handleFilesSelected}
                    disabled={loading}
                    maxFiles={ocrMode ? 3 : (isPremium ? 50 : 5)}
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
                    className={`w-full mt-4 ${ocrMode ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                    size="lg"
                  >
                    {loading ? (
                      <div className="flex flex-col items-center">
                        <div className="flex items-center">
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          {ocrMode ? 'OCR Processing' : 'Processing'} {files.length} file{files.length !== 1 ? 's' : ''}...
                        </div>
                        {processingStatus && (
                          <div className="text-xs opacity-80 mt-1">
                            {processingStatus}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {ocrMode ? (
                          <>
                            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Extract with OCR
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Extract Data
                          </>
                        )}
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
                          Export Detailed CSV
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
                              <div className="space-y-4">
                                {/* Basic Invoice Info */}
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
                                    <span className="font-medium">Date:</span>
                                    <p className="text-gray-600 dark:text-gray-400">
                                      {result.date || 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-medium">Total:</span>
                                    <p className="text-gray-600 dark:text-gray-400 font-semibold">
                                      {result.total ? `$${result.total}` : 'N/A'}
                                    </p>
                                  </div>
                                </div>

                                {/* Line Items */}
                                {result.lineItems && result.lineItems.length > 0 && (
                                  <div className="mt-4">
                                    <h5 className="font-medium text-xs mb-2 text-gray-700 dark:text-gray-300">
                                      Line Items ({result.lineItems.length})
                                    </h5>
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 max-h-32 overflow-y-auto">
                                      <div className="space-y-1">
                                        {result.lineItems.map((item, itemIndex) => (
                                          <div key={itemIndex} className="flex justify-between items-start text-xs">
                                            <div className="flex-1 pr-2">
                                              <p className="font-medium text-gray-800 dark:text-gray-200 leading-tight">
                                                {item.description}
                                              </p>
                                              {(item.quantity || item.unitPrice) && (
                                                <p className="text-gray-500 dark:text-gray-400 text-xs">
                                                  {item.quantity && `Qty: ${item.quantity}`}
                                                  {item.quantity && item.unitPrice && ' • '}
                                                  {item.unitPrice && `$${item.unitPrice}`}
                                                </p>
                                              )}
                                            </div>
                                            <div className="text-right">
                                              <p className="font-medium text-gray-800 dark:text-gray-200">
                                                ${item.amount?.toFixed(2) || '0.00'}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Breakdown (if available) */}
                                {(result.subtotal || result.tax || result.taxRate) && (
                                  <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                                    <div className="space-y-1 text-xs">
                                      {result.subtotal && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                                          <span className="text-gray-800 dark:text-gray-200">${result.subtotal}</span>
                                        </div>
                                      )}
                                      {result.tax && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600 dark:text-gray-400">
                                            Tax{result.taxRate && ` (${result.taxRate})`}:
                                          </span>
                                          <span className="text-gray-800 dark:text-gray-200">${result.tax}</span>
                                        </div>
                                      )}
                                      {result.total && (
                                        <div className="flex justify-between font-semibold pt-1 border-t border-gray-200 dark:border-gray-600">
                                          <span className="text-gray-800 dark:text-gray-200">Total:</span>
                                          <span className="text-gray-800 dark:text-gray-200">${result.total}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
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