import { generateReactNativeHelpers } from '@uploadthing/expo';
import Constants from 'expo-constants';
import type { OurFileRouter } from '../app/api/uploadthing+api';

// Clear secret token dynamically to prevent Metro from inlining it into client bundle
if (typeof process !== 'undefined' && process.env) {
  const env = process.env as Record<string, any>;
  delete env['UPLOADTHING_TOKEN'];
}

export function getEndpointUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_UPLOADTHING_URL;
  const debuggerHost = Constants.expoConfig?.hostUri;
  const baseUrl =
    envUrl && !envUrl.includes('localhost')
      ? envUrl
      : debuggerHost
        ? `http://${debuggerHost}`
        : envUrl || 'http://localhost:8081';

  return baseUrl.endsWith('/api/uploadthing') ? baseUrl : `${baseUrl}/api/uploadthing`;
}

export const { useImageUploader, uploadFiles } = generateReactNativeHelpers<OurFileRouter>({
  url: getEndpointUrl(),
});
