import { MAX_IMAGE_BYTES, MAX_IMAGE_DIM } from '../constants';
import { dataUrlToBlob } from './helpers';

const getDataUrlSizeBytes = (dataUrl) => {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
};

export const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const loadImageFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

export const compressDataUrlIfNeeded = async (dataUrl) => {
  if (getDataUrlSizeBytes(dataUrl) <= MAX_IMAGE_BYTES) return dataUrl;

  const img = await loadImageFromDataUrl(dataUrl);
  const maxDim = Math.max(img.width, img.height);
  const scale = Math.min(1, MAX_IMAGE_DIM / maxDim);
  const targetWidth = Math.max(1, Math.round(img.width * scale));
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  let quality = 0.82;
  let output = canvas.toDataURL('image/jpeg', quality);
  let outputSize = getDataUrlSizeBytes(output);
  let attempts = 0;

  while (outputSize > MAX_IMAGE_BYTES && attempts < 4) {
    quality = Math.max(0.5, quality - 0.12);
    output = canvas.toDataURL('image/jpeg', quality);
    outputSize = getDataUrlSizeBytes(output);
    attempts += 1;
  }

  return output;
};
