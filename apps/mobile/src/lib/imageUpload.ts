type PickedImage = {
  base64?: string | null;
  mimeType?: string | null;
};

export function imageUploadBody(asset: PickedImage): { bytes: ArrayBuffer; contentType: string } {
  const base64 = asset.base64?.replace(/\s/g, '') ?? '';
  if (!base64) throw new Error('Could not read the photo. Try choosing it again.');
  const bytes = base64ToArrayBuffer(base64);
  if (bytes.byteLength === 0) throw new Error('That photo was empty. Try another one.');
  const contentType = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
  return { bytes, contentType };
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
