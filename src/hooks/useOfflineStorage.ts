'use client';

import { useState, useEffect, useCallback } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ExtractionResult } from '@/types/extraction';

interface PDFExtractorDB extends DBSchema {
  extractions: {
    key: string;
    value: {
      id: string;
      timestamp: number;
      results: ExtractionResult[];
      files: Array<{
        name: string;
        size: number;
        type: string;
        data: ArrayBuffer;
      }>;
    };
    indexes: { 'timestamp': number };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: any;
    };
  };
}

export const useOfflineStorage = () => {
  const [db, setDb] = useState<IDBPDatabase<PDFExtractorDB> | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const initDB = async () => {
      try {
        const database = await openDB<PDFExtractorDB>('pdf-extractor', 1, {
          upgrade(db) {
            // Create extractions store
            if (!db.objectStoreNames.contains('extractions')) {
              const extractionsStore = db.createObjectStore('extractions', {
                keyPath: 'id',
              });
              extractionsStore.createIndex('timestamp', 'timestamp');
            }

            // Create settings store
            if (!db.objectStoreNames.contains('settings')) {
              db.createObjectStore('settings', {
                keyPath: 'key',
              });
            }
          },
        });
        setDb(database);
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
      }
    };

    initDB();

    // Monitor online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveExtraction = useCallback(async (
    results: ExtractionResult[],
    files: File[]
  ): Promise<string> => {
    if (!db) throw new Error('Database not initialized');

    const id = `extraction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Convert files to storable format
    const fileData = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        data: await file.arrayBuffer(),
      }))
    );

    const extraction = {
      id,
      timestamp: Date.now(),
      results,
      files: fileData,
    };

    await db.add('extractions', extraction);
    return id;
  }, [db]);

  const getExtractions = useCallback(async () => {
    if (!db) return [];
    
    const extractions = await db.getAll('extractions');
    return extractions.sort((a, b) => b.timestamp - a.timestamp);
  }, [db]);

  const getExtraction = useCallback(async (id: string) => {
    if (!db) return null;
    return await db.get('extractions', id);
  }, [db]);

  const deleteExtraction = useCallback(async (id: string) => {
    if (!db) return;
    await db.delete('extractions', id);
  }, [db]);

  const clearAllExtractions = useCallback(async () => {
    if (!db) return;
    await db.clear('extractions');
  }, [db]);

  const saveSetting = useCallback(async (key: string, value: any) => {
    if (!db) return;
    await db.put('settings', { key, value });
  }, [db]);

  const getSetting = useCallback(async (key: string) => {
    if (!db) return null;
    const setting = await db.get('settings', key);
    return setting?.value || null;
  }, [db]);

  // Queue for sync when back online
  const queueForSync = useCallback(async (data: any) => {
    if (!db) return;
    
    const queueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      data,
      synced: false,
    };

    // Store in a special queue (using settings store for simplicity)
    await saveSetting(`queue_${queueItem.id}`, queueItem);
  }, [db, saveSetting]);

  return {
    db,
    isOnline,
    saveExtraction,
    getExtractions,
    getExtraction,
    deleteExtraction,
    clearAllExtractions,
    saveSetting,
    getSetting,
    queueForSync,
  };
};