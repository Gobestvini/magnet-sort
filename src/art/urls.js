// The production plugin replaces this resolver with Vite-managed hashed imports.
export const assetUrl = path => `${import.meta.env.BASE_URL}${path}`;
