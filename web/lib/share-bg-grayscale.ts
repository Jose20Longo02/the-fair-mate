/**
 * Generates a grayscale + brightness/contrast version of the share background image
 * as a data URL. Used so html2canvas captures the gray look (it ignores CSS filter).
 */

const SHARE_BG_PATH = "/images/share-bg-fluid.png";
const BRIGHTNESS = 0.82;
const CONTRAST = 1.1;

export function getShareBgGrayscaleDataUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2d context not available"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;
          gray = ((gray / 255 - 0.5) * CONTRAST + 0.5) * 255;
          gray = gray * BRIGHTNESS;
          gray = Math.max(0, Math.min(255, Math.round(gray)));
          data[i] = data[i + 1] = data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Failed to load share background image"));
    img.src = typeof window !== "undefined" ? `${window.location.origin}${SHARE_BG_PATH}` : SHARE_BG_PATH;
  });
}
