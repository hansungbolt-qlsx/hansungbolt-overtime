-- Add employee_name column to material_label_photos
ALTER TABLE material_label_photos
  ADD COLUMN IF NOT EXISTS employee_name VARCHAR(100);
