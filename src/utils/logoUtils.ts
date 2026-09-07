/**
 * Utility functions for handling logo URLs, converting Google Drive links,
 * and handling file uploads.
 */

export const DEFAULT_LOGO_URL = 'https://drive.google.com/uc?export=view&id=1CXYEzIMay6FRiYLLww9hjbc9xeMk82xi';
export const LOCAL_STORAGE_LOGO_KEY = 'myg_custom_logo_url_v1';

/**
 * Extracts a Google Drive File ID and converts it to a direct embeddable image URL.
 */
export function parseGoogleDriveLink(url: string): {
  directUrl: string | null;
  isDriveHomeOrFolder: boolean;
  error?: string;
} {
  if (!url || typeof url !== 'string') {
    return { directUrl: null, isDriveHomeOrFolder: false };
  }

  const trimmed = url.trim();

  // Check if it's the generic Google Drive Home or My Drive or Folder link
  if (
    trimmed.includes('drive.google.com/drive/home') ||
    trimmed.includes('drive.google.com/drive/my-drive') ||
    trimmed.includes('drive.google.com/drive/u/') ||
    trimmed.includes('drive.google.com/drive/folders/')
  ) {
    return {
      directUrl: null,
      isDriveHomeOrFolder: true,
      error:
        'El enlace ingresado es la página de inicio o carpeta de Google Drive (/drive/home). Para usar tu imagen, abre el archivo en Drive > clic en "Compartir" > copia el enlace público del archivo, o sube el archivo directamente.'
    };
  }

  // Regex patterns for Google Drive individual files
  // 1. /file/d/FILE_ID/...
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    const fileId = fileDMatch[1];
    return {
      directUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      isDriveHomeOrFolder: false
    };
  }

  // 2. id=FILE_ID
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    const fileId = idParamMatch[1];
    return {
      directUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      isDriveHomeOrFolder: false
    };
  }

  // 3. Direct image link (http/https or data:image)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
    return {
      directUrl: trimmed,
      isDriveHomeOrFolder: false
    };
  }

  return { directUrl: null, isDriveHomeOrFolder: false, error: 'Enlace no reconocido como imagen válida' };
}
