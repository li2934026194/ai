/**
 * 商品图片地址：完全来自数据库返回的 image_url 字段。
 * 后端把它指向 /api/v1/product-images/{sku}.png，接口从 MinIO 读真实商品图。
 * 不再使用前端写死的 SKU 白名单——图片与商品在数据库层面绑定。
 */
export function getProductImageUrl(imageUrl?: string | null): string | null {
  const url = (imageUrl || "").trim();
  return url.length > 0 ? url : null;
}
