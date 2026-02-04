/**
 * Cloudinary image transformation utility
 * Uses fetch mode to proxy and transform external images (like Basta CDN)
 */

const CLOUD_NAME = "dqcs8uqsq";

type TransformOptions = {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "scale" | "thumb";
  quality?: "auto" | number;
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  aspectRatio?: string; // e.g., "16:10", "1:1"
};

/**
 * Transform an external image URL through Cloudinary
 * @param imageUrl - Original image URL (e.g., from Basta CDN)
 * @param options - Transformation options
 * @returns Cloudinary fetch URL with transformations
 */
export function getOptimizedImageUrl(
  imageUrl: string | undefined,
  options: TransformOptions = {}
): string {
  if (!imageUrl) return "/placeholder.svg";

  // Don't transform if it's already a local/placeholder image
  if (imageUrl.startsWith("/") || imageUrl.includes("placeholder")) {
    return imageUrl;
  }

  const {
    width,
    height,
    crop = "fill",
    quality = "auto",
    format = "auto",
    aspectRatio,
  } = options;

  // Build transformation string
  const transforms: string[] = [];

  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (aspectRatio) transforms.push(`ar_${aspectRatio.replace(":", "_")}`);
  if (crop) transforms.push(`c_${crop}`);
  if (quality) transforms.push(`q_${quality}`);
  if (format) transforms.push(`f_${format}`);

  // Add gravity for smart cropping
  transforms.push("g_auto");

  const transformString = transforms.join(",");

  // Cloudinary fetch expects the raw URL (not encoded)
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transformString}/${imageUrl}`;
}

/**
 * Preset for auction card images (16:10 aspect ratio)
 */
export function getAuctionCardImage(imageUrl: string | undefined): string {
  return getOptimizedImageUrl(imageUrl, {
    width: 800,
    height: 500,
    crop: "fill",
  });
}

/**
 * Preset for auction card thumbnails
 */
export function getAuctionThumbnail(imageUrl: string | undefined): string {
  return getOptimizedImageUrl(imageUrl, {
    width: 400,
    height: 250,
    crop: "fill",
  });
}

/**
 * Preset for lot detail main image
 */
export function getLotDetailImage(imageUrl: string | undefined): string {
  return getOptimizedImageUrl(imageUrl, {
    width: 1200,
    height: 1200,
    crop: "fit",
  });
}

/**
 * Preset for lot gallery thumbnails
 */
export function getLotThumbnail(imageUrl: string | undefined): string {
  return getOptimizedImageUrl(imageUrl, {
    width: 150,
    height: 150,
    crop: "fill",
  });
}
