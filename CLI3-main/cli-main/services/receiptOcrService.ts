interface TesseractProgress {
  status?: string;
  progress?: number;
}

interface TesseractResult {
  data?: {
    text?: string;
  };
}

const TESSERACT_CDN_URL = 'https://esm.sh/tesseract.js@5.1.1';

export const readReceiptImageText = async (
  image: File,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const tesseract = await import(/* @vite-ignore */ TESSERACT_CDN_URL) as {
    recognize?: (
      image: File,
      language?: string,
      options?: { logger?: (message: TesseractProgress) => void }
    ) => Promise<TesseractResult>;
  };

  if (!tesseract.recognize) {
    throw new Error('No se pudo cargar el lector OCR.');
  }

  const result = await tesseract.recognize(image, 'spa+eng', {
    logger: (message) => {
      if (typeof message.progress === 'number') {
        onProgress?.(Math.round(message.progress * 100));
      }
    }
  });

  const text = result.data?.text?.trim() ?? '';
  if (!text) {
    throw new Error('No se ha detectado texto en la imagen.');
  }

  return text;
};
