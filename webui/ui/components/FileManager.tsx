import React, { useState, useEffect, useRef } from 'react';
import { Folder, FileText, MoreVertical, UploadCloud, Search, Trash2, Edit, X, Save, FileCode, ArrowUp, Loader2, Download } from 'lucide-react';
import type { FileItem } from '../types.ts';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const API_BASE = 'http://localhost:11228/api/files';

export default function FileManager({ notify }: Props) {
  const [path, setPath] = useState('/');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [editingFile, setEditingFile] = useState<{path: string, content: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTokenHeader = () => `laplace@${localStorage.getItem('laplace_token') || ''}`;

  const fetchFiles = async (p: string) => {
      setLoading(true);
      try {
          const encodedPath = encodeURIComponent(p);
          const res = await fetch(`${API_BASE}/list?path=${encodedPath}`, {
              headers: { 'x-auth-token': getTokenHeader() }
          });
          const response = await res.json();
          if (res.ok && response.success && Array.isArray(response.data)) {
              setFiles(response.data.sort((a: any,b: any) => (a.isDirectory === b.isDirectory ? 0 : a.isDirectory ? -1 : 1)));
          } else {
              setFiles([]);
              notify?.('Failed to list files', 'error');
          }
      } catch (e) {
          console.error(e);
          notify?.('Network error', 'error');
          setFiles([]);
      }
      setLoading(false);
  };

  useEffect(() => {
      fetchFiles(path);
  }, [path]);

  const handleFolderClick = (folderName: string) => {
    const newPath = path === '/' ? `/${folderName}` : `${path}/${folderName}`;
    setPath(newPath);
  };

  const handleUp = () => {
      if (path === '/') return;
      const parts = path.split('/').filter(Boolean);
      parts.pop();
      const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
      setPath(newPath);
  };

  const handleEdit = async (filePath: string) => {
      try {
          const res = await fetch(`${API_BASE}/content?path=${encodeURIComponent(filePath)}`, {
              headers: { 'x-auth-token': getTokenHeader() }
          });
          const response = await res.json();
          if (!response.success) {
              notify?.(response.error || 'Read failed', 'error');
          } else {
              setEditingFile({ path: filePath, content: response.data.content });
          }
      } catch (e) {
          notify?.('Failed to read file', 'error');
      }
  };

  const handleSave = async () => {
      if (!editingFile) return;
      try {
          const res = await fetch(`${API_BASE}/write`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-auth-token': getTokenHeader() },
              body: JSON.stringify({ path: editingFile.path, content: editingFile.content })
          });
          const response = await res.json();
          if (res.ok && response.success) {
              setEditingFile(null);
              fetchFiles(path); 
              notify?.('File saved successfully', 'success');
          } else {
              notify?.(response.error || 'Failed to save file', 'error');
          }
      } catch (e) {
          notify?.('Network error during save', 'error');
      }
  };

  const handleDelete = async (filePath: string) => {
      if (!confirm(`Are you sure you want to delete ${filePath}? This cannot be undone.`)) return;
      try {
          const res = await fetch(`${API_BASE}/delete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-auth-token': getTokenHeader() },
              body: JSON.stringify({ path: filePath })
          });
          const response = await res.json();
          if (res.ok && response.success) {
            fetchFiles(path);
            notify?.('Deleted successfully', 'success');
          } else {
            notify?.(response.error || 'Delete failed', 'error');
          }
      } catch (e) {
          notify?.('Delete error', 'error');
      }
  };

  const handleDownload = (filePath: string) => {
      // NOTE: For browser downloads via new tab, auth headers are hard. 
      // We rely on cookie authentication for thisGET request which also defaults to 'laplace' type on backend.
      window.open(`${API_BASE}/download?path=${encodeURIComponent(filePath)}`, '_blank');
  };

  const triggerUpload = () => {
      if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);

      try {
          const res = await fetch(`${API_BASE}/upload`, {
              method: 'POST',
              headers: { 'x-auth-token': getTokenHeader() },
              body: formData
          });
          const response = await res.json();
          if (res.ok && response.success) {
              notify?.('File uploaded successfully', 'success');
              fetchFiles(path);
          } else {
              notify?.(response.error || 'Upload failed', 'error');
          }
      } catch (err) {
          notify?.('Network error uploading file', 'error');
      }
      
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return '-';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {/* Toolbar */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
        <div className="flex items-center space-x-3 overflow-hidden">
            <button 
                onClick={handleUp} 
                disabled={path === '/'}
                className="p-2 bg-gray-100 rounded-lg text-gray-500 hover:bg-laplace-primary hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-gray-100 disabled:hover:text-gray-500"
            >
                <ArrowUp size={18} />
            </button>
            <div className="flex items-center text-sm font-medium bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-gray-400 mr-2 select-none">/ root</span>
                <span className="text-laplace-darker font-mono">{path === '/' ? '' : path}</span>
            </div>
        </div>

        <div className="flex items-center space-x-3">
            <button 
                onClick={triggerUpload}
                disabled={uploading}
                className="flex items-center space-x-2 px-4 py-2 bg-laplace-primary text-white rounded-lg text-xs font-bold hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {uploading ? <Loader2 className="animate-spin" size={14} /> : <UploadCloud size={14} />}
                <span>{uploading ? 'Uploading...' : 'Upload'}</span>
            </button>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="animate-spin text-laplace-primary" size={32} />
                <span className="text-gray-400 text-sm">Loading files...</span>
            </div>
        ) : files.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-gray-400">
                 <Folder size={48} className="mb-2 text-gray-200" />
                 <p>Directory is empty</p>
             </div>
        ) : (
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-xs font-bold text-gray-400 uppercase border-b border-gray-100">
                        <th className="p-4 font-bold">Name</th>
                        <th className="p-4 font-bold w-32">Size</th>
                        <th className="p-4 font-bold w-48">Last Modified</th>
                        <th className="p-4 w-24 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {files.map((file, idx) => (
                        <tr key={idx} className="group hover:bg-laplace-bg transition-colors border-b border-gray-50 last:border-0">
                            <td className="p-4">
                                <div className="flex items-center cursor-pointer select-none" onClick={() => file.isDirectory && handleFolderClick(file.name)}>
                                    {file.isDirectory ? (
                                        <Folder className="text-yellow-400 mr-3 fill-yellow-400" size={20} />
                                    ) : (
                                        <FileText className="text-gray-400 mr-3" size={20} />
                                    )}
                                    <span className={`font-medium ${file.isDirectory ? 'text-laplace-darker' : 'text-gray-600'}`}>
                                        {file.name}
                                    </span>
                                </div>
                            </td>
                            <td className="p-4 text-gray-400 font-mono text-xs">{formatSize(file.size)}</td>
                            <td className="p-4 text-gray-400 text-xs">{new Date(file.lastModified).toLocaleDateString()}</td>
                            <td className="p-4 text-right">
                            <div className="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!file.isDirectory && (
                                    <>
                                        <button onClick={() => handleDownload(file.path)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title="Download">
                                            <Download size={16} />
                                        </button>
                                        <button onClick={() => handleEdit(file.path)} className="p-1.5 text-gray-400 hover:text-laplace-primary transition-colors" title="Edit">
                                            <Edit size={16} />
                                        </button>
                                    </>
                                )}
                                <button onClick={() => handleDelete(file.path)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>

      {/* Editor Modal */}
      {editingFile && (
          <div className="absolute inset-0 bg-white z-20 flex flex-col animate-fade-in">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center space-x-3">
                      <FileCode className="text-laplace-primary" size={20} />
                      <span className="font-bold text-laplace-darker">{editingFile.path}</span>
                  </div>
                  <div className="flex space-x-2">
                      <button onClick={() => setEditingFile(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-200 rounded-lg text-sm font-medium">Cancel</button>
                      <button onClick={handleSave} className="px-4 py-2 bg-laplace-primary text-white rounded-lg text-sm font-medium flex items-center space-x-2 hover:bg-opacity-90">
                          <Save size={16} />
                          <span>Save Changes</span>
                      </button>
                  </div>
              </div>
              <div className="flex-1 relative">
                  <textarea 
                      className="absolute inset-0 w-full h-full p-4 font-mono text-sm resize-none focus:outline-none text-gray-700 bg-white"
                      value={editingFile.content}
                      onChange={(e) => setEditingFile({...editingFile, content: e.target.value})}
                      spellCheck={false}
                  />
              </div>
          </div>
      )}
    </div>
  );
}