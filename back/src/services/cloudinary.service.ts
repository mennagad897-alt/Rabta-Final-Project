import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// Ensure Cloudinary is configured
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format?: string;
  [key: string]: any;
}

/**
 * Checks if the file is a document (PDF, Word, Excel, Txt, etc.)
 */
const isDocument = (mimetype: string, originalName: string): boolean => {
  const extension = originalName.split(".").pop()?.toLowerCase();
  const documentExtensions = [
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "txt",
    "csv",
    "ppt",
    "pptx",
  ];
  const documentMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  return (
    documentMimeTypes.includes(mimetype) ||
    (!!extension && documentExtensions.includes(extension))
  );
};

/**
 * Checks if the file is an image (PNG, JPG, JPEG, WEBP, GIF, etc.)
 */
const isImage = (mimetype: string, originalName: string): boolean => {
  const extension = originalName.split(".").pop()?.toLowerCase();
  const imageExtensions = ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"];

  return (
    mimetype.startsWith("image/") ||
    (!!extension && imageExtensions.includes(extension))
  );
};

/**
 * Checks if the file is a video
 */
const isVideo = (mimetype: string, originalName: string): boolean => {
  const extension = originalName.split(".").pop()?.toLowerCase();
  const videoExtensions = ["mp4", "webm", "mov", "avi", "mkv", "qt"];

  return (
    mimetype.startsWith("video/") ||
    (!!extension && videoExtensions.includes(extension))
  );
};

/**
 * Uploads a Multer file buffer to Cloudinary using streamifier.
 * Ensures document formats are stored as 'raw' to prevent corruption.
 */
export const uploadBufferToCloudinary = (
  buffer: Buffer,
  originalName: string,
  mimetype: string
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    // 1. Determine resource type dynamically
    let resourceType: "raw" | "image" | "video" | "auto" = "auto";
    
    if (isDocument(mimetype, originalName)) {
      resourceType = "raw";
    } else if (isImage(mimetype, originalName)) {
      resourceType = "image";
    } else if (isVideo(mimetype, originalName)) {
      resourceType = "video";
    }

    // 2. Generate a clean, unique file name preserving original extension
    const cleanName = originalName.replace(/\s+/g, "_");
    const uniqueFileName = `${Date.now()}-${cleanName}`;

    // 3. Set upload options
    const uploadOptions = {
      folder: "rabta_attachments",
      public_id: uniqueFileName,
      resource_type: resourceType,
    };

    // 4. Pipe buffer into Cloudinary upload stream
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary Upload Stream Error:", error);
          return reject(error);
        }
        if (!result) {
          return reject(new Error("Cloudinary returned empty upload result"));
        }
        resolve(result as CloudinaryUploadResult);
      }
    );

    // Write buffer using streamifier
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};
