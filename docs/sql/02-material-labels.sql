-- Tem NVL: bảng lưu metadata ảnh tem do tổ trưởng HD upload
-- File ảnh lưu trong Supabase Storage bucket "material-labels" (tạo tay qua Dashboard)

CREATE TABLE IF NOT EXISTS material_label_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_date date NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_label_photos_date
  ON material_label_photos (label_date);

ALTER TABLE material_label_photos ENABLE ROW LEVEL SECURITY;
