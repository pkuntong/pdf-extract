'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  TrendingUp, 
  Calendar, 
  Crown,
  BarChart3,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ExtractionResult } from '@/types/extraction';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { formatDate } from '@/lib/utils';

interface StoredExtraction {
  id: string;
  timestamp: number;
  results: ExtractionResult[];
  files: Array<{
    name: string;
    size: number;
    type: string;
    data: ArrayBuffer;
  }>;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [extractions, setExtractions] = useState<StoredExtraction[]>([]);
  const [stats, setStats] = useState({
    totalExtractions: 0,
    thisMonth: 0,
    successRate: 0,
    avgProcessingTime: 0
  });
  const { getExtractions } = useOfflineStorage();

  // Check for successful payment
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Welcome to Premium! Your subscription is now active.');
    }
    if (searchParams.get('canceled') === 'true') {
      toast.error('Payment was canceled. You can try again anytime.');
    }
  }, [searchParams]);

  // Load extraction history
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getExtractions();
        setExtractions(data || []);
        
        // Calculate stats
        const now = new Date();
        const thisMonth = data?.filter(item => {
          const itemDate = new Date(item.timestamp || 0);
          return itemDate.getMonth() === now.getMonth() && 
                 itemDate.getFullYear() === now.getFullYear();
        }) || [];
        
        const successful = data?.filter(item => 
          item.results?.some(result => !result.error)
        ) || [];

        setStats({
          totalExtractions: data?.length || 0,
          thisMonth: thisMonth.length,
          successRate: data?.length ? Math.round((successful.length / data.length) * 100) : 0,
          avgProcessingTime: 2.3 // Mock data
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        toast.error('Failed to load dashboard data');
      }
    };

    loadData();
  }, [getExtractions]);

  const handleExportData = () => {
    if (extractions.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Flatten extraction results for CSV
    const csvData = extractions.flatMap(extraction => 
      extraction.results?.map(result => ({
        filename: result.filename,
        date: extraction.timestamp ? formatDate(extraction.timestamp) : 'N/A',
        invoiceNumber: result.invoiceNumber || '',
        vendor: result.vendor || '',
        total: result.total || '',
        extractionDate: result.date || '',
        error: result.error || ''
      })) || []
    );

    const csvContent = [
      'Filename,Extraction Date,Invoice Number,Vendor,Total,Invoice Date,Error',
      ...csvData.map(row => 
        `"${row.filename}","${row.date}","${row.invoiceNumber}","${row.vendor}","${row.total}","${row.extractionDate}","${row.error}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf-extractions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Data exported successfully!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to App
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Crown className="h-8 w-8 text-yellow-500" />
                Premium Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Track your PDF extractions and manage your account
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportData}>
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Extractions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalExtractions}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisMonth}</div>
              <p className="text-xs text-muted-foreground">+12% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground">Extraction accuracy</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Processing</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgProcessingTime}s</div>
              <p className="text-xs text-muted-foreground">Per document</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Extractions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Extractions</CardTitle>
            <CardDescription>
              Your latest PDF extraction results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {extractions.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No extractions yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start by uploading some PDF files to see your extraction history here.
                </p>
                <Button onClick={() => router.push('/')}>
                  Start Extracting
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {extractions.slice(0, 10).map((extraction, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-blue-500" />
                      <div>
                        <h4 className="font-semibold">
                          {extraction.results?.length || 0} files processed
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {extraction.timestamp ? formatDate(extraction.timestamp) : 'Unknown date'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {extraction.results?.filter(r => !r.error).length || 0} successful
                      </div>
                      <div className="text-xs text-gray-500">
                        {extraction.results?.filter(r => r.error).length || 0} errors
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}