/**
 * uploadQueue.ts
 *
 * Offline-first image upload queue service.
 *
 * How it works:
 * 1. When a user picks an image offline, the local file:// URI is saved to
 *    WatermelonDB instantly (icon field) and iconPendingUpload = true.
 * 2. This service monitors network connectivity via NetInfo.
 * 3. When the device comes online, it scans for products with
 *    iconPendingUpload = true and uploads each local image to UploadThing.
 * 4. On success, the icon field is updated to the returned https:// URL
 *    and iconPendingUpload is set to false.
 * 5. The React Query cache is invalidated so all screens automatically refresh.
 *
 * Image removal:
 * - removeProductImage() deletes the file from UploadThing via DELETE /api/uploadthing
 *   and resets the WatermelonDB icon back to the category default emoji.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { uploadFiles, getEndpointUrl } from '../utils/uploadthing';


let isProcessing = false;
let unsubscribeNetInfo: (() => void) | null = null;
let queryInvalidateFn: (() => void) | null = null;

export const setQueryInvalidator = (fn: () => void) => { queryInvalidateFn = fn; };

function extractFileKey(url: string): string | null {
  const match = url.match(/\/f\/([^/?#]+)/);
  return match ? match[1] : null;
}

export async function deleteUploadThingFile(remoteUrl: string): Promise<boolean> {
  const fileKey = extractFileKey(remoteUrl);
  if (!fileKey) return false;

  try {
    const res = await fetch(getEndpointUrl(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileKey }),
    });
    return res.ok;
  } catch (err) {
    console.error('[UploadQueue] Delete error:', err);
    return false;
  }
}

export async function removeProductImage(productId: string): Promise<void> {
  try {
    const db = require('../components/data/db').default;
    const product = await db.get('products').find(productId);
    const currentIcon = product.icon ?? '';

    if (currentIcon.startsWith('http')) {
      await deleteUploadThingFile(currentIcon);
    }

    await db.write(async () => {
      await product.update((p: any) => {
        p.icon = '';
        p.iconPendingUpload = false;
      });
    });

    queryInvalidateFn?.();
    const { syncDatabase } = require('./sync');
    syncDatabase().catch(() => { });
  } catch (err) {
    console.error('[UploadQueue] Remove image error:', err);
  }
}

export async function uploadToUploadThing(localUri: string): Promise<string | null> {
  try {
    const response = await fetch(localUri);
    if (!response.ok) return null;
    const blob = await response.blob();

    const filename = localUri.split('/').pop() || `product-${Date.now()}.jpg`;
    let type = 'image/jpeg';
    if (filename.endsWith('.png')) type = 'image/png';
    else if (filename.endsWith('.webp')) type = 'image/webp';
    else if (filename.endsWith('.gif')) type = 'image/gif';

    const file = Object.assign(new File([blob], filename, { type }), { uri: localUri });

    const result = await uploadFiles('productImageUploader', { files: [file] });
    return result?.[0]?.ufsUrl || result?.[0]?.url || null;
  } catch (err) {
    console.error('[UploadQueue] uploadFiles error:', err);
    return null;
  }
}

export async function processUploadQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const db = require('../components/data/db').default;
    const { Q } = require('@nozbe/watermelondb');

    const pendingProducts = await db.get('products').query(Q.where('icon_pending_upload', true)).fetch();
    if (pendingProducts.length === 0) {
      isProcessing = false;
      return;
    }

    let hasSuccessfulUploads = false;
    for (const product of pendingProducts) {
      const localUri = product.icon ?? '';
      const isLocalUri = localUri.startsWith('file://') || localUri.startsWith('/');

      if (!isLocalUri) {
        await db.write(async () => {
          await product.update((p: any) => { p.iconPendingUpload = false; });
        });
        continue;
      }

      console.log(`[UploadQueue] Uploading: ${product.name}`);
      const remoteUrl = await uploadToUploadThing(localUri);

      if (remoteUrl) {
        await db.write(async () => {
          await product.update((p: any) => {
            p.icon = remoteUrl;
            p.iconPendingUpload = false;
          });
        });
        hasSuccessfulUploads = true;
      }
    }

    queryInvalidateFn?.();
    if (hasSuccessfulUploads) {
      const { syncDatabase } = require('./sync');
      syncDatabase().catch(() => { });
    }
  } catch (err) {
    console.error('[UploadQueue] Queue processing error:', err);
  } finally {
    isProcessing = false;
  }
}

export async function queueImageUpload(productId: string, localUri: string, isOnline: boolean): Promise<void> {
  try {
    const db = require('../components/data/db').default;
    const product = await db.get('products').find(productId);
    await db.write(async () => {
      await product.update((p: any) => {
        p.icon = localUri;
        p.iconPendingUpload = true;
      });
    });

    queryInvalidateFn?.();
    if (isOnline) {
      await processUploadQueue();
    }
  } catch (err) {
    console.error('[UploadQueue] Queue image error:', err);
  }
}

export function startUploadQueueMonitor(): void {
  if (unsubscribeNetInfo) return;
  unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
    const isConnected = state.isConnected && state.isInternetReachable !== false;
    if (isConnected) {
      processUploadQueue();
    }
  });
}

export function stopUploadQueueMonitor(): void {
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
}
