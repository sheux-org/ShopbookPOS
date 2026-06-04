import { genUploader } from 'uploadthing/client';
import type { OurFileRouter } from '../app/api/uploadthing/route';

export const { uploadFiles } = genUploader<OurFileRouter>({
  url:
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/uploadthing`
      : 'http://localhost:3000/api/uploadthing',
});
