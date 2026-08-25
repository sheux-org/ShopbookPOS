import { Q } from '@nozbe/watermelondb';
import database from '../db/database';
import { supabase, syncDatabase } from './sync';

let isProcessing = false;

function extractFileKey(url: string): string | null {
  const match = url.match(/\/f\/([^/?#]+)/);
  return match ? match[1] : null;
}

export async function deleteUploadThingFile(remoteUrl: string): Promise<boolean> {
  if (!remoteUrl) return true;
  try {
    if (remoteUrl.includes('business-logos/')) {
      const parts = remoteUrl.split('business-logos/');
      if (parts[1]) {
        const filePath = decodeURIComponent(parts[1].split('?')[0]);
        await supabase.storage.from('business-logos').remove([filePath]);
        return true;
      }
    }
    const fileKey = extractFileKey(remoteUrl);
    if (fileKey) {
      const res = await fetch('/api/uploadthing', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey }),
      });
      return res.ok;
    }
    return true;
  } catch (err) {
    console.error('[UploadQueue] Delete error:', err);
    return false;
  }
}

export async function uploadToUploadThing(localUri: string): Promise<string | null> {
  try {
    let blob: Blob;
    let contentType = 'image/jpeg';
    let fileExt = 'jpg';

    if (localUri.startsWith('data:')) {
      const parts = localUri.split(';base64,');
      contentType = parts[0].split(':')[1] || 'image/jpeg';
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      blob = new Blob([uInt8Array], { type: contentType });
      if (contentType.includes('png')) fileExt = 'png';
      else if (contentType.includes('webp')) fileExt = 'webp';
      else if (contentType.includes('gif')) fileExt = 'gif';
    } else if (localUri.startsWith('blob:')) {
      const response = await fetch(localUri);
      blob = await response.blob();
      contentType = blob.type || 'image/jpeg';
      if (contentType.includes('png')) fileExt = 'png';
      else if (contentType.includes('webp')) fileExt = 'webp';
      else if (contentType.includes('gif')) fileExt = 'gif';
    } else {
      return null;
    }

    const fileName = `products/prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const { error } = await supabase.storage.from('business-logos').upload(fileName, blob, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error('[UploadQueue] Supabase storage upload error:', error);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('business-logos').getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.error('[UploadQueue] uploadToUploadThing error:', err);
    return null;
  }
}

export async function processUploadQueue(): Promise<void> {
  if (isProcessing) return;
  if (typeof window === 'undefined' || !navigator.onLine) return;
  isProcessing = true;

  try {
    const allProducts = await database.get('products').query().fetch();
    const pendingProducts = allProducts.filter((product: any) => {
      const icon = product.icon ?? '';
      return (
        product.iconPendingUpload === true ||
        icon.startsWith('data:') ||
        icon.startsWith('blob:')
      );
    });
    if (pendingProducts.length === 0) {
      isProcessing = false;
      return;
    }

    let hasSuccessfulUploads = false;
    for (const product of pendingProducts) {
      const localUri = (product as any).icon ?? '';
      const isLocalUri = localUri.startsWith('data:') || localUri.startsWith('blob:');

      if (!isLocalUri) {
        await database.write(async () => {
          await product.update((p: any) => {
            p.iconPendingUpload = false;
          });
        });
        continue;
      }

      console.log(`[UploadQueue] Uploading product image: ${(product as any).name}`);
      const remoteUrl = await uploadToUploadThing(localUri);

      if (remoteUrl) {
        await database.write(async () => {
          await product.update((p: any) => {
            p.icon = remoteUrl;
            p.iconPendingUpload = false;
          });
        });
        hasSuccessfulUploads = true;
      }
    }

    if (hasSuccessfulUploads) {
      // Trigger sync
      syncDatabase();
    }
  } catch (err) {
    console.error('[UploadQueue] Queue processing error:', err);
  } finally {
    isProcessing = false;
  }
}

export function startUploadQueueMonitor(): void {
  if (typeof window === 'undefined') return;

  // Process queue on startup
  processUploadQueue();

  // Watch network status
  window.addEventListener('online', processUploadQueue);
}
