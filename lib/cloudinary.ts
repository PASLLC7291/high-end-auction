/**
 * Cloudinary image transformation utility
 * Uses fetch mode to proxy and transform external images (like Basta CDN)
 */

const DEFAULT_CLOUD_NAME = "dqcs8uqsq";

function getCloudName(): string | null {
  const name =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    DEFAULT_CLOUD_NAME;
  return name?.trim() ? name.trim() : null;
}

function isCloudinaryDisabled(): boolean {
  const value = process.env.NEXT_PUBLIC_DISABLE_CLOUDINARY;
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

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

  // Allow disabling Cloudinary entirely (falls back to the upstream image URL).
  if (isCloudinaryDisabled()) {
    return imageUrl;
  }

  const cloudName = getCloudName();
  if (!cloudName) {
    return imageUrl;
  }

  // Avoid double-proxying Cloudinary URLs.
  if (imageUrl.includes("res.cloudinary.com/")) {
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

  // Add gravity for smart cropping where supported
  if (crop === "fill" || crop === "thumb") {
    transforms.push("g_auto");
  }

  const transformString = transforms.join(",");

  // Encode remote URL (Cloudinary fetch treats it as part of the path).
  const encodedRemote = encodeURIComponent(imageUrl);

  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformString}/${encodedRemote}`;
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
