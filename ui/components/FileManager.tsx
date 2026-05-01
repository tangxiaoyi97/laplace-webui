import React, { useState, useEffect, useRef } from 'react';
import { Folder, FileText, UploadCloud, Trash2, Edit, Save, ArrowUp, Download, X } from 'lucide-react';
import type { FileItem } from '../types.ts';
import { fetchScoped, postScoped } from '../lib/api.ts';
import { Button, Card, Eyebrow, SectionHeader } from './primitives.tsx';
import { useConfirm } from './confirm.tsx';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
    currentServerId: string | null;
}

export default function FileManager({ notify, currentServerId }: Props) {
    const confirm = useConfirm();
    const [path, setPath] = useState('/');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [editingFile, setEditingFile] = useState<{ path: string; content: string; serverId: string } | null>(null);
    const [editorSaving, setEditorSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Each fetch starts a new generation; stale responses from older generations are dropped.
    const generationRef = useRef(0);

    // Wipe per-server state when the focused server changes.
    useEffect(() => {
        setPath('/');
        setFiles([]);
        setEditingFile(null);
    }, [currentServerId]);

    useEffect(() => {
        if (!currentServerId) return;
        const myGen = ++generationRef.current;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await fetchScoped(`/files/list?path=${encodeURIComponent(path)}`, currentServerId);
                const response = await res.json();
                if (cancelled || generationRef.current !== myGen) return;
                if (res.ok && response.success && Array.isArray(response.data)) {
                    setFiles(response.data.sort((a: any, b: any) => (a.isDirectory === b.isDirectory ? 0 : a.isDirectory ? -1 : 1)));
                } else {
                    setFiles([]);
                    notify?.('Failed to list files', 'error');
                }
            } catch {
                if (!cancelled && generationRef.current === myGen) {
                    notify?.('Network error', 'error');
                    setFiles([]);
                }
            } finally {
                if (!cancelled && generationRef.current === myGen) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [path, currentServerId]);

    const refreshCurrentDir = () => { generationRef.current++; setPath((p) => p); };

    const handleFolderClick = (name: string) => setPath(path === '/' ? `/${name}` : `${path}/${name}`);
    const handleUp = () => {
        if (path === '/') return;
        const parts = path.split('/').filter(Boolean);
        parts.pop();
        setPath(parts.length === 0 ? '/' : '/' + parts.join('/'));
    };

    const handleEdit = async (filePath: string) => {
        if (!currentServerId) return;
        try {
            const res = await fetchScoped(`/files/content?path=${encodeURIComponent(filePath)}`, currentServerId);
            const response = await res.json();
            if (response.success) setEditingFile({ path: filePath, content: response.data.content, serverId: currentServerId });
            else notify?.(response.error || 'Read failed', 'error');
        } catch { notify?.('Failed to read file', 'error'); }
    };

    const handleSave = async () => {
        if (!editingFile) return;
        // Defensive: if the focused server changed while editing, don't write to the wrong server.
        if (editingFile.serverId !== currentServerId) {
            notify?.('You switched servers while editing. Re-open the file to save changes.', 'error');
            setEditingFile(null);
            return;
        }
        setEditorSaving(true);
        try {
            const res = await postScoped('/files/write', editingFile.serverId, {
                path: editingFile.path,
                content: editingFile.content,
            });
            const response = await res.json();
            if (res.ok && response.success) {
                setEditingFile(null);
                refreshCurrentDir();
                notify?.('Saved', 'success');
            } else notify?.(response.error || 'Save failed', 'error');
        } catch { notify?.('Network error', 'error'); }
        finally { setEditorSaving(false); }
    };

    const handleDelete = async (filePath: string) => {
        if (!currentServerId) return;
        const ok = await confirm({
            title: `Delete "${filePath}"?`,
            message: 'This removes the file from the server directory. Cannot be undone.',
            danger: true,
            confirmLabel: 'Delete',
        });
        if (!ok) return;
        try {
            const res = await postScoped('/files/delete', currentServerId, { path: filePath });
            const response = await res.json();
            if (res.ok && response.success) { refreshCurrentDir(); notify?.('Deleted', 'success'); }
            else notify?.(response.error || 'Delete failed', 'error');
        } catch { notify?.('Delete error', 'error'); }
    };

    const handleDownload = async (filePath: string) => {
        try {
            const response = await fetchScoped(`/files/download?path=${encodeURIComponent(filePath)}`, currentServerId);
            if (!response.ok) throw new Error('failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filePath.split('/').pop() || 'download.bin';
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } catch { notify?.('Download failed', 'error'); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);
        if (currentServerId) formData.append('serverId', currentServerId);
        try {
            const res = await fetchScoped('/files/upload', currentServerId, { method: 'POST', body: formData });
            const response = await res.json();
            if (res.ok && response.success) { notify?.('Uploaded', 'success'); refreshCurrentDir(); }
            else notify?.(response.error || 'Upload failed', 'error');
        } catch { notify?.('Upload error', 'error'); }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '—';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    return (
        <div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

            <SectionHeader
                eyebrow="Operations"
                title="Files"
                lead="Browse, edit, and upload files inside the active server directory. Path traversal and symlink escapes are blocked."
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" size="md" onClick={handleUp} disabled={path === '/'}>
                            <ArrowUp size={14} /> Up
                        </Button>
                        <Button size="md" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                            <UploadCloud size={14} /> Upload
                        </Button>
                    </div>
                }
            />

            <Card tone="cream" padded className="mb-5 flex items-center gap-3">
                <Eyebrow>Path</Eyebrow>
                <span className="font-mono text-[13px] text-[color:var(--color-ink)]">/{path === '/' ? '' : path.replace(/^\//, '')}</span>
            </Card>

            <Card tone="canvas" padded={false} className="overflow-hidden">
                {!currentServerId ? (
                    <div className="text-center py-16 text-[14px] text-[color:var(--color-muted)]">Pick a server to browse its files.</div>
                ) : loading && files.length === 0 ? (
                    <div className="flex items-center justify-center gap-3 py-16 text-[14px] text-[color:var(--color-muted)]">
                        <div className="w-4 h-4 rounded-full border-2 border-[color:var(--color-primary)] border-r-transparent animate-spin" />
                        <span>Loading files for {currentServerId}…</span>
                    </div>
                ) : files.length === 0 ? (
                    <div className="text-center py-16 text-[14px] text-[color:var(--color-muted)]">Directory is empty.</div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-[color:var(--color-hairline)]">
                                <th className="px-5 py-3 eyebrow text-[10px] font-medium">Name</th>
                                <th className="px-5 py-3 eyebrow text-[10px] font-medium w-28">Size</th>
                                <th className="px-5 py-3 eyebrow text-[10px] font-medium w-44">Modified</th>
                                <th className="px-5 py-3 w-32"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map((file, idx) => (
                                <tr key={idx} className="group border-b border-[color:var(--color-hairline-soft)] last:border-0 hover:bg-[color:var(--color-surface-soft)]">
                                    <td className="px-5 py-3">
                                        <button
                                            onClick={() => file.isDirectory ? handleFolderClick(file.name) : handleEdit(file.path)}
                                            className="flex items-center gap-3 text-left w-full"
                                        >
                                            {file.isDirectory ? (
                                                <Folder size={16} className="text-[color:var(--color-accent-ochre)]" />
                                            ) : (
                                                <FileText size={16} className="text-[color:var(--color-muted)]" />
                                            )}
                                            <span className={`text-[14px] ${file.isDirectory ? 'text-[color:var(--color-ink)] font-medium' : 'text-[color:var(--color-body)]'}`}>{file.name}</span>
                                        </button>
                                    </td>
                                    <td className="px-5 py-3 text-[12.5px] font-mono text-[color:var(--color-muted)]">{formatSize(file.size)}</td>
                                    <td className="px-5 py-3 text-[12.5px] text-[color:var(--color-muted)]">{new Date(file.lastModified).toLocaleString()}</td>
                                    <td className="px-5 py-3">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!file.isDirectory && (
                                                <>
                                                    <button onClick={() => handleDownload(file.path)} className="p-1.5 text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]" title="Download">
                                                        <Download size={14} />
                                                    </button>
                                                    <button onClick={() => handleEdit(file.path)} className="p-1.5 text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]" title="Edit">
                                                        <Edit size={14} />
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={() => handleDelete(file.path)} className="p-1.5 text-[color:var(--color-muted)] hover:text-[color:var(--color-error)]" title="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            {editingFile && (
                <div className="fixed inset-0 z-50 bg-[color:var(--color-canvas)] flex flex-col animate-fade-in">
                    <div className="flex items-center justify-between px-10 h-16 border-b border-[color:var(--color-hairline)]">
                        <div className="flex items-center gap-3 min-w-0">
                            <FileText size={16} className="text-[color:var(--color-primary)]" />
                            <span className="font-mono text-[13px] text-[color:var(--color-ink)] truncate">{editingFile.path}</span>
                            <span className="font-mono text-[11px] text-[color:var(--color-muted)] shrink-0">@ {editingFile.serverId}</span>
                            {editingFile.serverId !== currentServerId ? (
                                <span className="text-[11px] text-[color:var(--color-error)] shrink-0">⚠ focus changed — Save will refuse</span>
                            ) : null}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="md" onClick={() => setEditingFile(null)}>
                                <X size={14} /> Cancel
                            </Button>
                            <Button size="md" onClick={handleSave} loading={editorSaving} disabled={editingFile.serverId !== currentServerId}>
                                <Save size={14} /> Save
                            </Button>
                        </div>
                    </div>
                    <textarea
                        value={editingFile.content}
                        onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                        spellCheck={false}
                        className="flex-1 w-full p-10 font-mono text-[13px] leading-relaxed bg-[color:var(--color-canvas)] text-[color:var(--color-ink)] focus:outline-none resize-none"
                    />
                </div>
            )}
        </div>
    );
}
