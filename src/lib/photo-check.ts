// On-device photo checks for listings (browser only): size, orientation, light, contrast and sharpness,
// plus a gentle auto-enhance. Nothing leaves the phone until the landlord taps Save.

export type PhotoCheck = { ok: boolean; label: string; tip?: string };
export type PhotoReport = { width: number; height: number; brightness: number; contrast: number; sharpness: number; score: number; checks: PhotoCheck[] };

export const ROOM_TIPS: Record<string, string[]> = {
  exterior: ["Stand across the road so the whole building and gate fit", "Shoot in morning or late-afternoon light, sun behind you", "Close the gate, move cars and rubbish out of view"],
  compound: ["Show parking, the compound and any garden", "Hold the phone level at chest height"],
  living: ["Switch on all lights and open curtains", "Stand in a corner and shoot across the room", "Hold the phone sideways (landscape) and level"],
  kitchen: ["Clear the counters and close cupboards", "Show the sink, cooker area and storage together"],
  bedroom: ["Make the bed and tidy away clothes", "Shoot from the doorway or a corner to show the size", "Include the wardrobe if there is one"],
  bathroom: ["Put the toilet seat down and hang towels neatly", "Show the shower/tub and sink in one shot"],
  dining: ["Tidy the table and chairs", "Shoot from a corner"],
  balcony: ["Show the balcony and the view", "Avoid shooting straight into the sun"],
  view: ["Capture what the tenant will see from the windows"],
  other: ["Keep it bright, level and tidy"],
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/** Measures the photo on a small copy (fast on phones). */
export async function analyse(file: Blob, room: string): Promise<PhotoReport> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth, height = img.naturalHeight;
    const s = Math.min(1, 320 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * s)), h = Math.max(1, Math.round(height * s));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) { const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; gray[j] = y; sum += y; }
    const brightness = sum / gray.length;
    let v = 0; for (const g of gray) v += (g - brightness) ** 2;
    const contrast = Math.sqrt(v / gray.length);
    // Sharpness: variance of the Laplacian.
    let lsum = 0, lsq = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lsum += lap; lsq += lap * lap; n++;
    }
    const sharpness = n ? lsq / n - (lsum / n) ** 2 : 0;
    const portraitOk = room === "bathroom";
    const checks: PhotoCheck[] = [
      { ok: Math.max(width, height) >= 1200, label: Math.max(width, height) >= 1200 ? "Good resolution" : "Low resolution", tip: "Use the main camera, not a screenshot or WhatsApp copy" },
      { ok: width >= height || portraitOk, label: width >= height ? "Landscape" : portraitOk ? "Portrait (fine for bathrooms)" : "Portrait photo", tip: "Turn the phone sideways — listings look best in landscape" },
      { ok: brightness >= 85 && brightness <= 200, label: brightness < 85 ? "Too dark" : brightness > 200 ? "Too bright / washed out" : "Well lit", tip: brightness < 85 ? "Open curtains, switch on lights, or tap Auto-enhance" : "Avoid shooting into windows or the sun" },
      { ok: contrast >= 38, label: contrast >= 38 ? "Good contrast" : "Flat / hazy", tip: "Wipe the lens, or tap Auto-enhance" },
      { ok: sharpness >= 120, label: sharpness >= 120 ? "Sharp" : "Blurry", tip: "Hold still, tap the screen to focus, wipe the lens" },
    ];
    const score = Math.round(
      (Math.min(1, Math.max(width, height) / 1600) * 15) + ((width >= height || portraitOk) ? 15 : 0)
      + (Math.max(0, 1 - Math.abs(brightness - 140) / 90) * 25) + (Math.min(1, contrast / 55) * 15) + (Math.min(1, sharpness / 300) * 30),
    );
    return { width, height, brightness, contrast, sharpness, score: Math.max(0, Math.min(100, score)), checks };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Gentle auto-enhance: lifts exposure and contrast toward a natural target, a touch of saturation,
 * and returns a 1600px JPEG ready to upload.
 */
export async function enhance(file: Blob, r: PhotoReport): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    const gain = Math.max(0.85, Math.min(2.4, 135 / Math.max(1, r.brightness)));
    const con = Math.max(1, Math.min(1.35, 52 / Math.max(1, r.contrast)));
    ctx.filter = `brightness(${gain.toFixed(2)}) contrast(${con.toFixed(2)}) saturate(1.08)`;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.86));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Shrinks for upload without any changes to the look. */
export async function resize(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type Shot = { key: string; room: string; label: string; unitId: number | null; required: boolean };

/** The shot list for a property: the outside, then each unit's rooms based on its bedrooms and bathrooms. */
export function shotList(units: { id: number; label: string; bedrooms: number; bathrooms: number }[], multiUnit: boolean): Shot[] {
  const out: Shot[] = [
    { key: "p-exterior", room: "exterior", label: "Front of the property", unitId: null, required: true },
    { key: "p-compound", room: "compound", label: "Compound / parking", unitId: null, required: false },
  ];
  for (const u of units) {
    const pre = multiUnit ? `${u.label} · ` : "";
    out.push({ key: `${u.id}-living`, room: "living", label: `${pre}${u.bedrooms === 0 ? "Main room" : "Sitting room"}`, unitId: u.id, required: true });
    out.push({ key: `${u.id}-kitchen`, room: "kitchen", label: `${pre}Kitchen`, unitId: u.id, required: false });
    for (let b = 1; b <= u.bedrooms; b++) out.push({ key: `${u.id}-bed${b}`, room: "bedroom", label: `${pre}Bedroom ${u.bedrooms > 1 ? b : ""}`.trim(), unitId: u.id, required: b === 1 });
    for (let b = 1; b <= Math.max(1, u.bathrooms); b++) out.push({ key: `${u.id}-bath${b}`, room: "bathroom", label: `${pre}Bathroom ${u.bathrooms > 1 ? b : ""}`.trim(), unitId: u.id, required: b === 1 });
  }
  return out;
}
