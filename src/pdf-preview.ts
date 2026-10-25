import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfPageResult {
  pages: number;
  width: number;
  height: number;
}

export async function renderPdfPage(
  canvas: HTMLCanvasElement,
  data: Uint8Array,
  pageNumber: number,
  scale: number,
): Promise<PdfPageResult> {
  const loadingTask = pdfjsLib.getDocument({ data });
  const document = await loadingTask.promise;
  const page = await document.getPage(Math.max(1, Math.min(document.numPages, pageNumber)));
  const viewport = page.getViewport({ scale });
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const context = canvas.getContext('2d');
  if (!context) {
    await loadingTask.destroy();
    throw new Error('Canvas rendering is unavailable.');
  }
  context.save();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
  }).promise;
  const result = { pages: document.numPages, width: viewport.width, height: viewport.height };
  await loadingTask.destroy();
  return result;
}
