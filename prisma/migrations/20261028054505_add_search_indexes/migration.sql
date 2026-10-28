-- Substring search (ILIKE '%term%') can use trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_name_my_trgm_idx
  ON products USING gin (name_my gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_description_trgm_idx
  ON products USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_variants_sku_trgm_idx
  ON product_variants USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_specifications_value_trgm_idx
  ON product_specifications USING gin (value gin_trgm_ops);

-- Colour filter and colour facet lookups
CREATE INDEX IF NOT EXISTS product_variants_color_lower_idx
  ON product_variants (lower(color));
