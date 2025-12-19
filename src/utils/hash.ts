import crypto from 'crypto';

export const generateCacheKey = (method: string, params: any[] = []): string => {
  // Ensure deterministic stringify by handling undefined/null and sorting keys if params were an object (JSON-RPC usually uses arrays, but robust handling is good)
  // However, JSON-RPC 2.0 params can be array or object.
  // For simplicity and speed, we'll JSON.stringify.
  // In a robust production system, we might want 'json-stable-stringify' or similar if object key order varies.
  // Standard JSON.stringify is usually "good enough" for standard RPC clients that serialize consistently.
  
  const payload = JSON.stringify({ method, params });
  return crypto.createHash('sha256').update(payload).digest('hex');
};
