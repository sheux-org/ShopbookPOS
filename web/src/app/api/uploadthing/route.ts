import { createRouteHandler, createUploadthing } from 'uploadthing/next';
import { UTApi } from 'uploadthing/server';

const f = createUploadthing();
const utapi = new UTApi();

const uploadRouter = {
  productImageUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(() => ({ ok: true }))
    .onUploadComplete(async ({ file }) => {
      console.log('[UploadThing] Upload complete:', file.ufsUrl);
      return { url: file.ufsUrl };
    }),
};

export type OurFileRouter = typeof uploadRouter;

export const { GET, POST } = createRouteHandler({ router: uploadRouter });

export async function DELETE(request: Request) {
  try {
    const { fileKey } = (await request.json()) as { fileKey: string };
    if (!fileKey) return Response.json({ error: 'fileKey is required' }, { status: 400 });

    const result = await utapi.deleteFiles(fileKey);
    console.log('[UploadThing] Deleted file:', fileKey, result);
    return Response.json({ success: true, deletedCount: result.deletedCount });
  } catch (err: any) {
    console.error('[UploadThing] Delete failed:', err);
    return Response.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}
