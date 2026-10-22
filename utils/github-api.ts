/**
 * GitHub REST API Client for In-Browser Content Management
 * Allows reading and committing site configuration and portfolio CSV directly from the browser.
 */

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  pathPrefix?: string; // e.g. "immersive-web" if nested, or empty
}

export interface GitHubFileResult {
  content: string;
  sha: string;
  path: string;
}

const STORAGE_KEY = 'artmax_github_cms_config';

export function getSavedGitHubConfig(): GitHubConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveGitHubConfig(config: GitHubConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearGitHubConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// UTF-8 safe base64 encoding
export function toBase64Utf8(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// UTF-8 safe base64 decoding
export function fromBase64Utf8(base64: string): string {
  const clean = base64.replace(/\s/g, '');
  return decodeURIComponent(escape(atob(clean)));
}

/**
 * Fetch a file's content and its SHA from GitHub
 */
export async function fetchGitHubFile(
  config: GitHubConfig,
  filePath: string
): Promise<GitHubFileResult> {
  const targetPath = config.pathPrefix ? `${config.pathPrefix}/${filePath}` : filePath;
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${targetPath}?ref=${encodeURIComponent(config.branch)}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token.trim()}`;
  }

  const res = await fetch(url, { headers, cache: 'no-store' });

  if (!res.ok) {
    if (res.status === 404 && config.pathPrefix) {
      // Try fallback to root path if prefixed failed
      const fallbackUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${filePath}?ref=${encodeURIComponent(config.branch)}`;
      const fallbackRes = await fetch(fallbackUrl, { headers, cache: 'no-store' });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        return {
          content: fromBase64Utf8(data.content),
          sha: data.sha,
          path: filePath,
        };
      }
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    content: fromBase64Utf8(data.content),
    sha: data.sha,
    path: targetPath,
  };
}

/**
 * Commit a file update directly to GitHub
 */
export async function commitGitHubFile(
  config: GitHubConfig,
  filePath: string,
  content: string,
  sha: string,
  commitMessage: string
): Promise<{ sha: string; commitSha: string; htmlUrl: string }> {
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${filePath}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.token.trim()}`,
  };

  const body = {
    message: commitMessage,
    content: toBase64Utf8(content),
    sha: sha,
    branch: config.branch,
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `GitHub commit failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    sha: data.content.sha,
    commitSha: data.commit.sha,
    htmlUrl: data.commit.html_url,
  };
}

/**
 * Test credentials by querying repo details
 */
export async function verifyGitHubAccess(config: GitHubConfig): Promise<{ defaultBranch: string; repoName: string }> {
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token.trim()}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Cannot access repository: ${res.status}`);
  }

  const data = await res.json();
  return {
    defaultBranch: data.default_branch || 'main',
    repoName: data.full_name,
  };
}

/**
 * Convert a browser File object to a base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1] || res;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a binary file (image, logo, poster) directly to GitHub repository
 */
export async function uploadGitHubBinaryFile(
  config: GitHubConfig,
  targetPath: string,
  base64Content: string,
  commitMessage: string
): Promise<{ sha: string; htmlUrl: string }> {
  const fullPath = config.pathPrefix ? `${config.pathPrefix}/${targetPath}` : targetPath;
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${fullPath}`;

  let existingSha: string | undefined;
  try {
    const existing = await fetchGitHubFile(config, targetPath);
    existingSha = existing.sha;
  } catch {
    // New file
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.token.trim()}`,
  };

  const body: Record<string, any> = {
    message: commitMessage,
    content: base64Content,
    branch: config.branch,
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `GitHub upload failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    sha: data.content?.sha || '',
    htmlUrl: data.commit?.html_url || '',
  };
}

