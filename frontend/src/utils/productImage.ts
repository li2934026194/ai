const KNOWN_PRODUCT_SKUS = new Set([
  "SKU-00704",
  "BAG-108",
  "FAN-203",
  "COS-052",
  "MNT-405",
  "LED-812",
  "PET-905",
]);

export function getProductImageUrl(sku?: string | null): string | null {
  const clean = (sku || "").trim().toUpperCase();
  if (!clean) return null;
  if (KNOWN_PRODUCT_SKUS.has(clean)) {
    return `/product-images/${clean}.png`;
  }
  return null;
}
