/**
 * InstituteOS – Storage Domain Service
 * Wraps Supabase Storage for profile avatars and student documents.
 * Validates file sizes and types before upload.
 * Generates signed URLs for private documents.
 * Falls back to local object URLs for demo / offline mode.
 */

import { supabaseClient, supabaseEnabled } from "./supabase.js";

/* ── constants ────────────────────────────────────────────────────────── */

const AVATAR_BUCKET = "avatars";   // public bucket
const DOCS_BUCKET = "documents";   // private bucket

const MAX_AVATAR_SIZE_MB = 2;
const MAX_DOC_SIZE_MB = 10;
const DOCUMENT_CATEGORIES = new Set(["id_proof", "certificates", "general"]);

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_DOC_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/* ── validation helpers ───────────────────────────────────────────────── */

function validateFile(file, maxMB, allowedTypes) {
  if (!file) throw new Error("No file provided.");

  const maxBytes = maxMB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File is too large. Maximum allowed size is ${maxMB} MB.`);
  }

  if (allowedTypes.size > 0 && !allowedTypes.has(file.type)) {
    const allowed = [...allowedTypes]
      .map((t) => t.split("/")[1].toUpperCase())
      .join(", ");
    throw new Error(`Unsupported file type "${file.type}". Allowed: ${allowed}.`);
  }

  return true;
}

function buildStoragePath(prefix, id, file) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const timestamp = Date.now();
  return `${prefix}/${id}/${timestamp}.${ext}`;
}

/* ── service ──────────────────────────────────────────────────────────── */

export const storageService = {
  /**
   * Upload a student or staff profile avatar.
   * Returns the public URL (avatars bucket is public).
   *
   * @param {string} userId   – Supabase user/student ID for folder path
   * @param {File}   file     – Browser File object
   * @returns {Promise<string>}  public URL
   */
  async uploadAvatar(userId, file) {
    validateFile(file, MAX_AVATAR_SIZE_MB, ALLOWED_IMAGE_TYPES);

    if (supabaseEnabled && supabaseClient) {
      const { data: authData, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !authData?.user?.id) throw new Error("Avatar upload requires a verified Supabase session.");
      const path = buildStoragePath(authData.user.id, "avatar", file);

      const { error } = await supabaseClient.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) throw new Error(`Avatar upload failed: ${error.message}`);

      const { data } = supabaseClient.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(path);

      return data.publicUrl;
    }

    // Offline fallback – return local object URL (not persisted)
    return URL.createObjectURL(file);
  },

  /**
   * Upload a private student document (ID proof, marksheet, etc.).
   * Returns a short-lived signed URL (1 hour).
   *
   * @param {string} studentId
   * @param {File}   file
   * @param {string} [category="general"]  – subfolder: "id_proof" | "certificates" | "general"
   * @returns {Promise<{ path: string, signedUrl: string }>}
   */
  async uploadDocument(studentId, file, category = "general") {
    validateFile(file, MAX_DOC_SIZE_MB, ALLOWED_DOC_TYPES);
    if (typeof studentId !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(studentId)) {
      throw new Error("A valid student ID is required for document storage.");
    }
    if (!DOCUMENT_CATEGORIES.has(category)) {
      throw new Error("Unsupported document category.");
    }

    if (supabaseEnabled && supabaseClient) {
      const path = `${studentId}/${category}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const { error } = await supabaseClient.storage
        .from(DOCS_BUCKET)
        .upload(path, file, {
          cacheControl: "no-store",
          upsert: false,
          contentType: file.type,
        });

      if (error) throw new Error(`Document upload failed: ${error.message}`);

      const { data: signedData, error: signError } = await supabaseClient.storage
        .from(DOCS_BUCKET)
        .createSignedUrl(path, 3600); // 1-hour expiry

      if (signError) throw new Error(`Could not generate download link: ${signError.message}`);

      return { path, signedUrl: signedData.signedUrl };
    }

    // Offline fallback
    return {
      path: `offline/${studentId}/${file.name}`,
      signedUrl: URL.createObjectURL(file),
    };
  },

  /**
   * Generate a fresh signed URL for an existing private document path.
   *
   * @param {string} storagePath – e.g. "student-id/id_proof/1234.pdf"
   * @param {number} [expiresIn=3600]
   * @returns {Promise<string>}
   */
  async getSignedUrl(storagePath, expiresIn = 3600) {
    if (!supabaseEnabled || !supabaseClient) {
      throw new Error("Supabase is not configured. Cannot generate signed URLs offline.");
    }

    const { data, error } = await supabaseClient.storage
      .from(DOCS_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) throw new Error(`Failed to generate signed URL: ${error.message}`);
    return data.signedUrl;
  },

  /**
   * List all documents stored for a student.
   *
   * @param {string} studentId
   * @returns {Promise<Array<{ name, path, updatedAt }>>}
   */
  async listStudentDocuments(studentId) {
    if (!supabaseEnabled || !supabaseClient) return [];

    try {
      const categories = ["id_proof", "certificates", "general"];
      const results = await Promise.all(categories.map(async (category) => {
        const { data, error } = await supabaseClient.storage
          .from(DOCS_BUCKET)
          .list(`${studentId}/${category}`, { sortBy: { column: "updated_at", order: "desc" } });
        if (error) return [];
        return (data || []).map((item) => ({
          name: item.name,
          path: `${studentId}/${category}/${item.name}`,
          updatedAt: item.updated_at,
          size: item.metadata?.size,
        }));
      }));
      return results.flat();
    } catch (err) {
      console.debug("Could not list student documents:", err);
      return [];
    }
  },

  /**
   * Delete a stored file (avatar or document).
   *
   * @param {string} bucket     – AVATAR_BUCKET or DOCS_BUCKET
   * @param {string} storagePath
   */
  async deleteFile(bucket, storagePath) {
    if (![AVATAR_BUCKET, DOCS_BUCKET].includes(bucket) || typeof storagePath !== "string" || !storagePath.trim()) {
      throw new Error("A valid InstituteOS storage bucket and path are required.");
    }
    if (!supabaseEnabled || !supabaseClient) return;

    // The deployed policy set intentionally has no storage DELETE policy.
    // Keep the client from issuing a request until an owner-approved server
    // deletion workflow and matching policy are explicitly designed.
    throw new Error("Storage deletion is disabled until an authorized deletion workflow is configured.");
  },

  // Expose bucket names for callers that need them
  AVATAR_BUCKET,
  DOCS_BUCKET,
};

export default storageService;
