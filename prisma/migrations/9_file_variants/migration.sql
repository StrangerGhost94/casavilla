-- Smaller copies of uploaded images, so cards and thumbnails don't download full-size photos.
CREATE TABLE "file_variants" (
  "file_id" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "mime_type" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  CONSTRAINT "file_variants_pkey" PRIMARY KEY ("file_id", "width"),
  CONSTRAINT "file_variants_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
