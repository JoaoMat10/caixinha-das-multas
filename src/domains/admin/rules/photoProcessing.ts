export const adminPhotoMaxBytes = 5 * 1024 * 1024;
export const adminPhotoMaxDimension = 1024;
export const adminPhotoQuality = 0.82;

export type AdminPhotoMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

type EncodedPhotoOptions = {
  width: number;
  height: number;
  type: AdminPhotoMimeType;
  quality?: number;
};

export type DecodedAdminPhoto = {
  width: number;
  height: number;
  encode(options: EncodedPhotoOptions): Promise<Blob>;
  close(): void;
};

export type AdminPhotoDecoder = (file: File) => Promise<DecodedAdminPhoto>;

export function constrainAdminPhotoSize(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('Não foi possível ler as dimensões da fotografia.');
  }
  const scale = Math.min(1, adminPhotoMaxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeBrowserPhoto(file: File): Promise<DecodedAdminPhoto> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este browser não permite processar fotografias.');
  }
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  return {
    width: bitmap.width,
    height: bitmap.height,
    encode: ({ width, height, type, quality }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível processar a fotografia.');
      context.drawImage(bitmap, 0, 0, width, height);
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Não foi possível comprimir a fotografia.'));
          },
          type,
          quality,
        );
      });
    },
    close: () => bitmap.close(),
  };
}

function processedPhotoName(name: string, type: AdminPhotoMimeType) {
  const baseName = name.replace(/\.[^.]+$/, '') || 'fotografia';
  const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
  return `${baseName}.${extension}`;
}

export async function processAdminPhoto(
  file: File,
  decode: AdminPhotoDecoder = decodeBrowserPhoto,
) {
  const type = file.type as AdminPhotoMimeType;
  const decoded = await decode(file);
  try {
    const dimensions = constrainAdminPhotoSize(decoded.width, decoded.height);
    const blob = await decoded.encode({
      ...dimensions,
      type,
      quality: type === 'image/png' ? undefined : adminPhotoQuality,
    });
    if (blob.type !== type) {
      throw new Error('O formato da fotografia processada é inválido.');
    }
    if (blob.size > adminPhotoMaxBytes) {
      throw new Error('A fotografia processada não pode exceder 5 MiB.');
    }
    return new File([blob], processedPhotoName(file.name, type), {
      type,
      lastModified: Date.now(),
    });
  } finally {
    decoded.close();
  }
}
