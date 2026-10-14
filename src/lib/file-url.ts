// Links to uploaded files. With a width, an image comes back as a smaller WebP copy (see lib/images.ts).
export const fileUrl = (id: number, w?: number) => (w ? `/api/files/${id}?w=${w}` : `/api/files/${id}`);

/** srcset for a photo: the browser picks the smallest copy that is sharp on this screen. */
export const fileSrcSet = (id: number, widths: readonly number[] = [320, 640, 1024, 1600]) =>
  widths.map((w) => `${fileUrl(id, w)} ${w}w`).join(", ");
