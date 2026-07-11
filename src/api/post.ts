import api from './client';
import { fetchMultipart, buildImageFormData } from '../lib/uploadImage';

export type CreatePost = {
  title: string;
  description?: string;
  images?: string[];
};

export type UpdatePost = Partial<CreatePost>;

/** Local image picked from the device — use with multipart field `images` (matches backend multer). */
export type PostImageFile = {
  uri: string;
  type?: string;
  name?: string;
};

/**
 * Create post with optional photos via fetch-based multipart upload (fixes 413).
 */
export function createPostByResident(
  residentId: string | number,
  data: { title: string; description?: string },
  imageFiles?: PostImageFile[]
) {
  const files = imageFiles?.filter((f) => f?.uri) ?? [];
  if (files.length === 0) {
    return api
      .post(`/post/create-postByRes/${residentId}`, {
        title: data.title,
        description: data.description,
      })
      .then((r) => r.data);
  }

  const fd = buildImageFormData(
    { title: data.title, description: data.description },
    files,
    'images',
  );
  return fetchMultipart(`/post/create-postByRes/${residentId}`, fd);
}

export function fetchAllPosts() {
  return api.get<{ success: boolean; data?: unknown[] }>(`/post/fetch-all`).then((r) => r.data);
}

export function getPostsByResident(residentId: string | number) {
  return api
    .get<{ success: boolean; posts?: unknown[]; total?: number }>(`/post/fetch-by-resident/${residentId}`)
    .then((r) => r.data);
}

export function deletePost(id: string | number) {
  return api.delete(`/post/delete/${id}`).then((r) => r.data);
}

export type UpdatePostMultipart = {
  title: string;
  description?: string;
  /** Existing server paths to keep, in order (e.g. `uploads/post-images/...`). */
  keptRelativePaths: string[];
  newImageFiles: PostImageFile[];
};

/**
 * Update post via POST + multipart so new photos work without huge JSON bodies.
 * Requires backend route `POST /api/post/update-post/:id` (see smart-society routers).
 */
export function updatePostById(postId: string | number, data: UpdatePostMultipart) {
  const newFiles = data.newImageFiles?.filter((f) => f?.uri) ?? [];
  const kept = (data.keptRelativePaths ?? []).filter(Boolean);

  if (newFiles.length === 0) {
    return api
      .post(`/post/update-post/${postId}`, {
        title: data.title,
        description: data.description,
        images: kept,
      })
      .then((r) => r.data);
  }

  const fd = buildImageFormData(
    { title: data.title, description: data.description },
    newFiles,
    'images',
  );
  for (const p of kept) {
    fd.append('images', p);
  }
  return fetchMultipart(`/post/update-post/${postId}`, fd);
}

export function likePostByResident(residentId: string | number, postId: string | number) {
  return api.post(`/post/like-by-resident/${residentId}`, { post_id: postId }).then((r) => r.data);
}

export function fetchLikesByUser(userId: string | number) {
  return api
    .get<{ success: boolean; data?: { post_id?: string | number }[] }>(`/post/check-like/${userId}`)
    .then((r) => r.data);
}
