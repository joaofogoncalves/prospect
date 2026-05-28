// Trigger a browser download for an in-memory Blob. Shared by the PNG, CSV, and
// JSON export paths.
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Export a single Recharts chart (the `<svg>` inside `container`) as a PNG.
//
// Recharts is pure vector + text, so there are no cross-origin raster images to
// taint the canvas. The chart's colors must already be concrete strings (see
// useChartColors) — `var(--x)` references would resolve to nothing once the SVG
// is detached. We fill the canvas with the theme surface first so dark-mode
// charts don't land on a transparent (then black) background, and scale by the
// device pixel ratio so the export is crisp on HiDPI displays.
export async function exportChartPng(
  container: HTMLElement,
  filename: string,
  background: string,
): Promise<void> {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("No chart to export.");

  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  // ResponsiveContainer sizes the SVG via CSS; a serialized clone needs explicit
  // attributes (and a namespace) to render in a detached Image.
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.style.fontFamily = "'Geist Variable', sans-serif";

  const xml = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(
    new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to render chart image."));
      img.src = svgUrl;
    });

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (pngBlob) downloadBlob(filename, pngBlob);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
