/** Utility for asset path prefixing - Trigger deployment */
export const getAssetPath = (path: string) => {
    if (path.startsWith('http') || path.startsWith('//')) return path;

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return encodeURI(normalizedPath);
};
