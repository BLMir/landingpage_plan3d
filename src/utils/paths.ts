/** Utility for asset path prefixing - Trigger deployment */
export const getAssetPath = (path: string) => {
    const basePath = '/yourplan3d';
    if (path.startsWith('http') || path.startsWith('//')) return path;

    // Ensure we don't double prefix if the path already starts with basePath
    if (path.startsWith(basePath)) return path;

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return encodeURI(`${basePath}${normalizedPath}`);
};
