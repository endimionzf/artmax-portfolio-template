'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import siteConfigDefault from '@/site.config.json';
import {
  GitHubConfig,
  getSavedGitHubConfig,
  saveGitHubConfig,
  clearGitHubConfig,
  fetchGitHubFile,
  commitGitHubFile,
  verifyGitHubAccess,
  fileToBase64,
  uploadGitHubBinaryFile,
} from '@/utils/github-api';
import {
  ProjectRecord,
  projectsFromCSV,
  projectsToCSV,
} from '@/utils/csv';

export default function EditPage() {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<'config' | 'projects'>('config');

  // GitHub Connection State
  const [ghConfig, setGhConfig] = useState<GitHubConfig>({
    owner: '',
    repo: '',
    branch: 'main',
    token: '',
    pathPrefix: '',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string; link?: string } | null>(null);

  // File states (with SHAs for atomic GitHub commits)
  const [configSha, setConfigSha] = useState<string>('');
  const [configPath, setConfigPath] = useState<string>('site.config.json');
  const [siteConfig, setSiteConfig] = useState<any>(siteConfigDefault);

  const [csvSha, setCsvSha] = useState<string>('');
  const [csvPath, setCsvPath] = useState<string>('public/portfolio/metadata.csv');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);

  // Project Modal State
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [projectIndex, setProjectIndex] = useState<number | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Loading & Upload states
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingProjectImage, setIsUploadingProjectImage] = useState(false);

  // Allow body and html scrolling while on the /edit page
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.height = prevBodyHeight;
    };
  }, []);

  const showStatus = useCallback((type: 'success' | 'error' | 'info', text: string, link?: string) => {
    setStatusMessage({ type, text, link });
    if (type !== 'error') {
      setTimeout(() => setStatusMessage(null), 8000);
    }
  }, []);

  // Load files from GitHub API
  const loadFromGitHub = useCallback(async (cfg: GitHubConfig) => {
    setIsLoadingData(true);
    showStatus('info', 'Connecting to GitHub repository and loading data...');

    try {
      // 1. Verify access
      const repoDetails = await verifyGitHubAccess(cfg);
      setIsConnected(true);
      setShowConfigModal(false);
      saveGitHubConfig(cfg);

      // 2. Fetch site.config.json
      try {
        const configFile = await fetchGitHubFile(cfg, 'site.config.json');
        setConfigSha(configFile.sha);
        setConfigPath(configFile.path);
        const parsed = JSON.parse(configFile.content);
        setSiteConfig(parsed);
      } catch (err: any) {
        console.warn('Could not load site.config.json from GitHub:', err);
      }

      // 3. Fetch metadata.csv
      try {
        const csvFile = await fetchGitHubFile(cfg, 'public/portfolio/metadata.csv');
        setCsvSha(csvFile.sha);
        setCsvPath(csvFile.path);
        const { headers, projects: loadedProjects } = projectsFromCSV(csvFile.content);
        setCsvHeaders(headers);
        setProjects(loadedProjects);
      } catch (err: any) {
        console.warn('Could not load metadata.csv from GitHub:', err);
      }

      showStatus('success', `Connected to ${repoDetails.repoName}! Loaded configuration and projects.`);
    } catch (err: any) {
      setIsConnected(false);
      showStatus('error', `GitHub Connection Failed: ${err.message}`);
    } finally {
      setIsLoadingData(false);
      setIsConnecting(false);
    }
  }, [showStatus]);

  // Initialize from localStorage and preload local data
  useEffect(() => {
    // Preload local portfolio.json if available
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    fetch(`${basePath}/portfolio.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          const mapped: ProjectRecord[] = data.items.map((it: any) => ({
            filename: it.filename || '',
            title: it.title || '',
            description: it.description || '',
            category: it.category || 'video',
            techStack: it.techStack || '',
            role: it.role || '',
            client: it.client || '',
            agency: it.agency || '',
            production: it.production || '',
            director: it.director || '',
            producer: it.producer || '',
            tags: it.tags || '',
            link: it.link || '',
            youtubeId: it.youtubeId || '',
            year: it.year || '',
          }));
          setProjects((prev) => (prev.length === 0 ? mapped : prev));
        }
      })
      .catch(() => {});

    // Check for saved GitHub config
    const saved = getSavedGitHubConfig();
    if (saved && saved.owner && saved.repo && saved.token) {
      setGhConfig(saved);
      loadFromGitHub(saved);
    }
  }, [loadFromGitHub]);

  // Escape key handler for closing modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowConfigModal(false);
        setIsProjectModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    await loadFromGitHub(ghConfig);
  };

  const handleDisconnect = () => {
    clearGitHubConfig();
    setIsConnected(false);
    setGhConfig({
      owner: '',
      repo: '',
      branch: 'main',
      token: '',
      pathPrefix: '',
    });
    showStatus('info', 'Disconnected from GitHub. Local changes will not be committed.');
  };

  // Upload Logo directly to GitHub repository
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isConnected || !ghConfig.token) {
      setShowConfigModal(true);
      showStatus('error', 'Please connect your GitHub repository with a Token before uploading.');
      return;
    }

    setIsUploadingLogo(true);
    showStatus('info', `Uploading ${file.name} to GitHub...`);

    try {
      const base64 = await fileToBase64(file);
      const cleanName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
      const targetPath = `public/${cleanName}`;

      const res = await uploadGitHubBinaryFile(
        ghConfig,
        targetPath,
        base64,
        `feat(branding): upload ${cleanName} via in-browser editor`
      );

      setSiteConfig((prev: any) => ({
        ...prev,
        branding: {
          ...prev.branding,
          logoImage: `/${cleanName}`,
        },
      }));

      showStatus('success', `Uploaded ${cleanName} to GitHub! Click "Commit Configuration" to publish.`, res.htmlUrl);
    } catch (err: any) {
      showStatus('error', `Logo upload failed: ${err.message}`);
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  // Upload Project Poster/Thumbnail directly to GitHub repository
  const handleProjectImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProject) return;

    if (!isConnected || !ghConfig.token) {
      setShowConfigModal(true);
      showStatus('error', 'Please connect your GitHub repository with a Token before uploading.');
      return;
    }

    setIsUploadingProjectImage(true);
    showStatus('info', `Uploading ${file.name} to portfolio media...`);

    try {
      const base64 = await fileToBase64(file);
      const cleanName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
      const ext = cleanName.lastIndexOf('.') !== -1 ? cleanName.substring(cleanName.lastIndexOf('.')) : '';
      const baseFilename = ext ? cleanName.substring(0, cleanName.lastIndexOf('.')) : cleanName;

      const targetPath = `public/portfolio/media/${cleanName}`;

      const res = await uploadGitHubBinaryFile(
        ghConfig,
        targetPath,
        base64,
        `feat(portfolio): upload ${cleanName} via in-browser editor`
      );

      setEditingProject((prev) => (prev ? { ...prev, filename: baseFilename } : null));

      showStatus('success', `Uploaded ${cleanName} to portfolio media! Filename updated to ${baseFilename}.`, res.htmlUrl);
    } catch (err: any) {
      showStatus('error', `Image upload failed: ${err.message}`);
    } finally {
      setIsUploadingProjectImage(false);
      e.target.value = '';
    }
  };

  // Commit site.config.json
  const handleSaveConfig = async () => {
    if (!isConnected || !ghConfig.token) {
      setShowConfigModal(true);
      showStatus('error', 'Please connect your GitHub repository with a Personal Access Token first.');
      return;
    }

    setIsCommitting(true);
    try {
      const content = JSON.stringify(siteConfig, null, 2) + '\n';
      const res = await commitGitHubFile(
        ghConfig,
        configPath,
        content,
        configSha,
        'feat(config): update site branding & text via in-browser editor'
      );

      setConfigSha(res.sha);
      const actionsUrl = `https://github.com/${ghConfig.owner}/${ghConfig.repo}/actions`;
      showStatus(
        'success',
        `Successfully committed configuration! Commit ${res.commitSha.slice(0, 7)} triggered GitHub Actions deployment.`,
        actionsUrl
      );
    } catch (err: any) {
      showStatus('error', `Failed to commit configuration: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Commit metadata.csv
  const handleSaveProjects = async () => {
    if (!isConnected || !ghConfig.token) {
      setShowConfigModal(true);
      showStatus('error', 'Please connect your GitHub repository with a Personal Access Token first.');
      return;
    }

    setIsCommitting(true);
    try {
      const csvContent = projectsToCSV(projects, csvHeaders);
      const res = await commitGitHubFile(
        ghConfig,
        csvPath,
        csvContent,
        csvSha,
        'feat(portfolio): update metadata.csv via in-browser editor'
      );

      setCsvSha(res.sha);
      const actionsUrl = `https://github.com/${ghConfig.owner}/${ghConfig.repo}/actions`;
      showStatus(
        'success',
        `Successfully committed ${projects.length} projects! Commit ${res.commitSha.slice(0, 7)} triggered GitHub Actions deployment.`,
        actionsUrl
      );
    } catch (err: any) {
      showStatus('error', `Failed to commit projects: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Project Modal Actions
  const openNewProjectModal = () => {
    setEditingProject({
      filename: '',
      title: '',
      description: '',
      category: 'video',
      techStack: '',
      role: '',
      client: '',
      agency: '',
      production: '',
      director: '',
      producer: '',
      tags: '',
      link: '',
      youtubeId: '',
      year: new Date().getFullYear().toString(),
    });
    setProjectIndex(null);
    setIsProjectModalOpen(true);
  };

  const openEditProjectModal = (proj: ProjectRecord, index: number) => {
    setEditingProject({ ...proj });
    setProjectIndex(index);
    setIsProjectModalOpen(true);
  };

  const handleSaveProjectModal = () => {
    if (!editingProject) return;
    if (!editingProject.title || !editingProject.filename) {
      alert('Title and Media Filename are required!');
      return;
    }

    const updated = [...projects];
    if (projectIndex !== null && projectIndex >= 0) {
      updated[projectIndex] = editingProject;
    } else {
      updated.unshift(editingProject);
    }
    setProjects(updated);
    setIsProjectModalOpen(false);
    setEditingProject(null);
    setProjectIndex(null);
    showStatus('info', 'Project updated in memory. Click "Commit Projects to GitHub" to publish changes.');
  };

  const handleDeleteProject = (index: number) => {
    if (confirm(`Are you sure you want to remove "${projects[index]?.title || 'this project'}"?`)) {
      const updated = projects.filter((_, i) => i !== index);
      setProjects(updated);
      showStatus('info', 'Project removed. Click "Commit Projects to GitHub" to publish.');
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden w-full bg-[#0a0a0c] text-[#f0f0f5] font-sans selection:bg-[#00f3ff] selection:text-black">
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 md:py-8">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Artmax Studio Editor</h1>
              <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded border border-[#00f3ff]/40 bg-[#00f3ff]/10 text-[#00f3ff]">
                GitHub Cloud Edition
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-400 mt-1">
              // Direct in-browser static editor with 1-click GitHub Actions deployment
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase border border-white/15 bg-white/5 hover:bg-white/10 transition text-zinc-300"
            >
              ← View Site
            </Link>

            {/* GitHub Connection Badge */}
            <button
              onClick={() => setShowConfigModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase border transition ${
                isConnected
                  ? 'border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41] hover:bg-[#00ff41]/20'
                  : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#00ff41] animate-pulse' : 'bg-yellow-400'}`} />
              {isConnected ? `${ghConfig.owner}/${ghConfig.repo} (${ghConfig.branch})` : 'Connect to GitHub'}
            </button>

            {/* Commit Action Buttons */}
            {activeTab === 'config' ? (
              <button
                onClick={handleSaveConfig}
                disabled={isCommitting || isLoadingData}
                className="px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-[#00f3ff] text-black shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:bg-[#55f7ff] transition disabled:opacity-50"
              >
                {isCommitting ? 'Committing...' : 'Commit Configuration'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={openNewProjectModal}
                  className="px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase border border-white/20 bg-white/5 hover:bg-white/15 text-white transition"
                >
                  + Add
                </button>
                <button
                  onClick={handleSaveProjects}
                  disabled={isCommitting || isLoadingData}
                  className="px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-[#00f3ff] text-black shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:bg-[#55f7ff] transition disabled:opacity-50"
                >
                  {isCommitting ? 'Committing...' : 'Commit Projects'}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Status / Alert Bar */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono ${
              statusMessage.type === 'success'
                ? 'bg-[#00ff41]/10 border-[#00ff41]/30 text-[#00ff41]'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-[#00f3ff]/10 border-[#00f3ff]/30 text-[#00f3ff]'
            }`}
          >
            <span>{statusMessage.text}</span>
            {statusMessage.link && (
              <a
                href={statusMessage.link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold hover:text-white"
              >
                View on GitHub ↗
              </a>
            )}
          </div>
        )}

        {/* Main Tabs */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold border transition ${
              activeTab === 'config'
                ? 'bg-[#00f3ff]/15 border-[#00f3ff] text-white shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            Site & Branding Config
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold border transition ${
              activeTab === 'projects'
                ? 'bg-[#00f3ff]/15 border-[#00f3ff] text-white shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            Portfolio Projects ({projects.length})
          </button>
        </div>

        {/* TAB 1: Site & Branding Config */}
        {activeTab === 'config' && (
          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5 md:p-7 backdrop-blur-md flex flex-col gap-8">
            {/* Section 1: Site Metadata & SEO */}
            <section className="flex flex-col gap-4 border-b border-white/10 pb-6">
              <h2 className="text-sm font-mono uppercase tracking-wider text-[#00f3ff] font-bold">
                // 1. Site Metadata & SEO
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Site Title</label>
                  <input
                    type="text"
                    value={siteConfig?.site?.title || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, site: { ...siteConfig.site, title: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Author / Studio</label>
                  <input
                    type="text"
                    value={siteConfig?.site?.author || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, site: { ...siteConfig.site, author: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Meta Description</label>
                <input
                  type="text"
                  value={siteConfig?.site?.description || ''}
                  onChange={(e) => setSiteConfig({ ...siteConfig, site: { ...siteConfig.site, description: e.target.value } })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                />
              </div>
            </section>

            {/* Section 2: Branding & Logo */}
            <section className="flex flex-col gap-4 border-b border-white/10 pb-6">
              <h2 className="text-sm font-mono uppercase tracking-wider text-[#00f3ff] font-bold">
                // 2. Branding & Logo
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Logo Type</label>
                  <select
                    value={siteConfig?.branding?.logoType || 'image'}
                    onChange={(e) => setSiteConfig({ ...siteConfig, branding: { ...siteConfig.branding, logoType: e.target.value } })}
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  >
                    <option value="image">Image (PNG / SVG / WebP)</option>
                    <option value="text">Text Typography</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Logo Text (Typography)</label>
                  <input
                    type="text"
                    placeholder="Artmax Studio"
                    value={siteConfig?.branding?.logoText || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, branding: { ...siteConfig.branding, logoText: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>

              {/* Logo Image Upload & Preview */}
              <div>
                <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Logo Image File</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="/artmax_logo.png"
                    value={siteConfig?.branding?.logoImage || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, branding: { ...siteConfig.branding, logoImage: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                  <label className="cursor-pointer shrink-0 px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase border border-[#00f3ff]/40 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 text-[#00f3ff] transition flex items-center justify-center gap-1.5">
                    <span>{isUploadingLogo ? 'Uploading...' : '📁 Upload New Logo'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                      className="hidden"
                    />
                  </label>
                </div>

                {siteConfig?.branding?.logoImage && (
                  <div className="mt-2.5 flex items-center gap-3 p-2.5 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-[10px] font-mono text-zinc-400">Current Logo:</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={siteConfig.branding.logoImage}
                      alt="Logo preview"
                      className="h-7 max-w-[140px] object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <span className="text-[11px] font-mono text-zinc-300 truncate">{siteConfig.branding.logoImage}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Logo Alt Text</label>
                  <input
                    type="text"
                    placeholder="Studio Logo"
                    value={siteConfig?.branding?.logoAlt || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, branding: { ...siteConfig.branding, logoAlt: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Contact Button Label</label>
                  <input
                    type="text"
                    placeholder="Contact Studio"
                    value={siteConfig?.branding?.contactButtonTitle || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, branding: { ...siteConfig.branding, contactButtonTitle: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Navigation */}
            <section className="flex flex-col gap-4 border-b border-white/10 pb-6">
              <h2 className="text-sm font-mono uppercase tracking-wider text-[#00f3ff] font-bold">
                // 3. Navigation & Journal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Show Blog/Journal Link</label>
                  <select
                    value={siteConfig?.navigation?.showJournalLink ? 'true' : 'false'}
                    onChange={(e) => setSiteConfig({ ...siteConfig, navigation: { ...siteConfig.navigation, showJournalLink: e.target.value === 'true' } })}
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  >
                    <option value="true">Visible</option>
                    <option value="false">Hidden</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Journal Link Text</label>
                  <input
                    type="text"
                    value={siteConfig?.navigation?.journalLinkText || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, navigation: { ...siteConfig.navigation, journalLinkText: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Journal URL</label>
                  <input
                    type="text"
                    value={siteConfig?.navigation?.journalLinkUrl || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, navigation: { ...siteConfig.navigation, journalLinkUrl: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Section 4: Start Screen Overlay */}
            <section className="flex flex-col gap-4 border-b border-white/10 pb-6">
              <h2 className="text-sm font-mono uppercase tracking-wider text-[#00f3ff] font-bold">
                // 4. Start Screen / Intro Overlay
              </h2>
              <div>
                <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Overlay Heading</label>
                <input
                  type="text"
                  value={siteConfig?.startOverlay?.title || ''}
                  onChange={(e) => setSiteConfig({ ...siteConfig, startOverlay: { ...siteConfig.startOverlay, title: e.target.value } })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Intro Quote / Manifesto</label>
                <textarea
                  rows={3}
                  value={siteConfig?.startOverlay?.quote || ''}
                  onChange={(e) => setSiteConfig({ ...siteConfig, startOverlay: { ...siteConfig.startOverlay, quote: e.target.value } })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none resize-vertical"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Explore Button Title</label>
                  <input
                    type="text"
                    value={siteConfig?.startOverlay?.exploreButton?.title || ''}
                    onChange={(e) =>
                      setSiteConfig({
                        ...siteConfig,
                        startOverlay: {
                          ...siteConfig.startOverlay,
                          exploreButton: { ...siteConfig.startOverlay?.exploreButton, title: e.target.value },
                        },
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Audio Prompt Hint</label>
                  <input
                    type="text"
                    value={siteConfig?.startOverlay?.soundHint || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, startOverlay: { ...siteConfig.startOverlay, soundHint: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Section 5: Contact Overlay */}
            <section className="flex flex-col gap-4">
              <h2 className="text-sm font-mono uppercase tracking-wider text-[#00f3ff] font-bold">
                // 5. Contact Sheet & Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Contact Heading</label>
                  <input
                    type="text"
                    value={siteConfig?.contact?.title || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, contact: { ...siteConfig.contact, title: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={siteConfig?.contact?.email || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, contact: { ...siteConfig.contact, email: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={siteConfig?.contact?.phone || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, contact: { ...siteConfig.contact, phone: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: Portfolio Projects */}
        {activeTab === 'projects' && (
          <div>
            {projects.length === 0 ? (
              <div className="bg-zinc-900/40 border border-white/10 rounded-2xl p-12 text-center">
                <p className="text-sm font-mono text-zinc-400 mb-4">No portfolio items loaded yet.</p>
                <button
                  onClick={openNewProjectModal}
                  className="px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase bg-[#00f3ff] text-black"
                >
                  + Add First Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {projects.map((proj, idx) => (
                  <div
                    key={`${proj.filename}-${idx}`}
                    className="bg-zinc-900/60 border border-white/10 hover:border-[#00f3ff]/50 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition group backdrop-blur-sm"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2.5">
                        <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-[#00f3ff] transition line-clamp-1">
                          {proj.title || 'Untitled Project'}
                        </h3>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-white/20 bg-white/5 text-zinc-300 shrink-0">
                          {proj.category || 'video'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
                        {proj.description || 'No description provided.'}
                      </p>

                      <div className="text-[11px] font-mono text-zinc-400 flex flex-col gap-1 mb-3">
                        {proj.filename && <div className="truncate"><span className="text-zinc-400">Media:</span> {proj.filename}</div>}
                        {proj.client && <div className="truncate"><span className="text-zinc-400">Client:</span> {proj.client}</div>}
                        {proj.year && <div><span className="text-zinc-400">Year:</span> {proj.year}</div>}
                      </div>

                      {proj.techStack && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {proj.techStack.split(',').slice(0, 3).map((t, ti) => (
                            <span
                              key={ti}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00f3ff]/10 border border-[#00f3ff]/20 text-[#00f3ff] truncate"
                            >
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
                      <button
                        onClick={() => openEditProjectModal(proj, idx)}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono border border-white/15 bg-white/5 hover:bg-white/15 text-white transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProject(idx)}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* GitHub Setup / Connection Modal */}
      {showConfigModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfigModal(false);
          }}
        >
          <div className="bg-[#141418] border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Connect to GitHub Repository</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Enter your repository info and a Personal Access Token (PAT). Your token stays in your browser&apos;s localStorage and communicates directly with GitHub&apos;s REST API.
            </p>

            <form onSubmit={handleConnect} className="flex flex-col gap-4 text-xs font-mono">
              <div>
                <label className="text-zinc-400 block mb-1">GitHub Owner / Organization</label>
                <input
                  type="text"
                  placeholder="e.g. endimionzf"
                  value={ghConfig.owner}
                  onChange={(e) => setGhConfig({ ...ghConfig, owner: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Repository Name</label>
                <input
                  type="text"
                  placeholder="e.g. artmax-portfolio-template"
                  value={ghConfig.repo}
                  onChange={(e) => setGhConfig({ ...ghConfig, repo: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Branch</label>
                  <input
                    type="text"
                    value={ghConfig.branch}
                    onChange={(e) => setGhConfig({ ...ghConfig, branch: e.target.value })}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Folder Prefix (Optional)</label>
                  <input
                    type="text"
                    placeholder="leave blank if root"
                    value={ghConfig.pathPrefix || ''}
                    onChange={(e) => setGhConfig({ ...ghConfig, pathPrefix: e.target.value })}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-zinc-400">Personal Access Token (PAT)</label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Artmax+Editor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00f3ff] hover:underline"
                  >
                    Generate Token ↗
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={ghConfig.token}
                  onChange={(e) => setGhConfig({ ...ghConfig, token: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none font-mono"
                />
                <span className="text-[10px] text-zinc-400 block mt-1">Requires <b>repo</b> or <b>contents: write</b> permission.</span>
              </div>

              <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                {isConnected ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-rose-400 hover:underline"
                  >
                    Disconnect
                  </button>
                ) : <span />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 rounded-lg border border-white/15 hover:bg-white/10 text-white"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="px-5 py-2 rounded-lg bg-[#00f3ff] text-black font-bold hover:bg-[#55f7ff] transition disabled:opacity-50"
                  >
                    {isConnecting ? 'Verifying...' : 'Connect'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Project Modal */}
      {isProjectModalOpen && editingProject && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsProjectModalOpen(false);
          }}
        >
          <div className="bg-[#141418] border border-white/15 rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto p-6 md:p-7 shadow-2xl my-auto">
            <h2 className="text-lg font-bold text-white mb-5">
              {projectIndex !== null ? 'Edit Project' : 'Add New Project'}
            </h2>

            <div className="flex flex-col gap-4 text-xs font-mono">
              <div>
                <label className="text-zinc-400 block mb-1">Project Title *</label>
                <input
                  type="text"
                  value={editingProject.title}
                  onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                />
              </div>

              {/* Media Filename & Image Upload */}
              <div>
                <label className="text-zinc-400 block mb-1">Media Base Filename *</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="e.g. project_showreel"
                    value={editingProject.filename}
                    onChange={(e) => setEditingProject({ ...editingProject, filename: e.target.value })}
                    required
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                  />
                  <label className="cursor-pointer shrink-0 px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase border border-[#00f3ff]/40 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 text-[#00f3ff] transition flex items-center justify-center gap-1.5">
                    <span>{isUploadingProjectImage ? 'Uploading...' : '📁 Upload Poster'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProjectImageUpload}
                      disabled={isUploadingProjectImage}
                      className="hidden"
                    />
                  </label>
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Uploads image to public/portfolio/media/ and updates filename automatically.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 block mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="video, 3d, or ai"
                    value={editingProject.category}
                    onChange={(e) => setEditingProject({ ...editingProject, category: e.target.value })}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Year</label>
                  <input
                    type="text"
                    value={editingProject.year}
                    onChange={(e) => setEditingProject({ ...editingProject, year: e.target.value })}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editingProject.description}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none resize-vertical"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Tech Stack (comma-separated)</label>
                <input
                  type="text"
                  placeholder="Unreal Engine 5, Houdini, DaVinci"
                  value={editingProject.techStack}
                  onChange={(e) => setEditingProject({ ...editingProject, techStack: e.target.value })}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 block mb-1">Client</label>
                  <input
                    type="text"
                    value={editingProject.client}
                    onChange={(e) => setEditingProject({ ...editingProject, client: e.target.value })}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Role</label>
                  <input
                    type="text"
                    placeholder="Lead Director & VFX"
                    value={editingProject.role}
                    onChange={(e) => setEditingProject({ ...editingProject, role: e.target.value })}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 block mb-1">External Link (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={editingProject.link}
                    onChange={(e) => setEditingProject({ ...editingProject, link: e.target.value })}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">YouTube Video ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="dQw4w9WgXcQ"
                    value={editingProject.youtubeId}
                    onChange={(e) => setEditingProject({ ...editingProject, youtubeId: e.target.value })}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-[#00f3ff] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-white/15 hover:bg-white/10 text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProjectModal}
                  className="px-5 py-2 rounded-lg bg-[#00f3ff] text-black font-bold hover:bg-[#55f7ff] transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
