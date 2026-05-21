import { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import axiosInstance from '../../api/axiosInstance';

export const AdminAITraining = () => {
  const [knowledgeText, setKnowledgeText] = useState('');
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client-Side File Reading Logic using FileReader API
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate that the file is indeed a text file
    if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
      toast.error('Only text documents (.txt) are supported / يدعم فقط ملفات النصوص');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLoadedFileName(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setKnowledgeText(content);
      setLoadedFileName(file.name);
      toast.success(`Successfully loaded ${file.name} / تم تحميل الملف بنجاح`);
    };

    reader.onerror = () => {
      toast.error('Failed to read the file / فشل في قراءة الملف');
      setLoadedFileName(null);
    };

    reader.readAsText(file);
  };

  // Submit Handler for vector store feeding
  const handleSubmit = async () => {
    if (!knowledgeText.trim()) {
      toast.error('Please provide some training data text / يرجى إدخال نص لتغذية الذكاء الاصطناعي');
      return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    
    // Construct required payload structure
    const payload = {
      data: [
        { text: knowledgeText.trim() }
      ]
    };

    const baseUrls = [
      axiosInstance.defaults.baseURL || 'http://localhost:5000/api/v1',
      'http://localhost:5000/api/v1'
    ];
    
    const paths = [
      `/api/ai/create-vector-store`,
      `/ai/create-vector-store`,
      `/create-vector-store`
    ];

    let success = false;
    let errorMessage = 'Failed to train global knowledge base';

    for (const baseUrl of baseUrls) {
      for (const path of paths) {
        try {
          const url = `${baseUrl}${path}`;
          const res = await axios.post(url, payload, { headers });
          if (res.data?.status === 'success' || res.data?.message) {
            success = true;
            break;
          }
        } catch (err: any) {
          if (err.response?.status !== 404) {
            errorMessage = err.response?.data?.message || err.message || errorMessage;
          }
        }
      }
      if (success) break;
    }

    if (success) {
      toast.success('Global AI Knowledge Base updated successfully! 🚀');
      setKnowledgeText('');
      setLoadedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      toast.error(errorMessage);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in text-gray-900 dark:text-white">
      {/* Header section */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-2">
          <i className="fa-solid fa-database"></i> Core AI System
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 via-indigo-500 to-indigo-600 bg-clip-text text-transparent">
          AI Knowledge Base Management
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Train the system-wide global chatbot assistant with rules, guidelines, or reference documents.
        </p>
      </div>

      {/* Main Trigger / Form Card */}
      <div className="bg-white dark:bg-[#141419] p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <i className="fa-solid fa-brain text-lg"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold">Feed Global AI Knowledge Base</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Provide context data to generate vector embeddings for global search queries.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500">Target Endpoint</span>
            <code className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-purple-600 dark:text-purple-400 font-mono font-semibold border border-gray-200/20 dark:border-white/5">
              POST /api/v1/ai/create-vector-store
            </code>
          </div>
        </div>

        <div className="space-y-4">
          {/* Input option 1: Text Area */}
          <div className="flex flex-col space-y-2">
            <label htmlFor="knowledge-text" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Paste Text / Content
            </label>
            <textarea
              id="knowledge-text"
              rows={10}
              placeholder="Paste project rules, guidelines, or global data here..."
              value={knowledgeText}
              onChange={(e) => setKnowledgeText(e.target.value)}
              className="w-full p-4 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono text-sm leading-relaxed"
            />
          </div>

          {/* Input option 2: Text file upload */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5">
            <div className="space-y-1">
              <span className="text-sm font-semibold flex items-center gap-2">
                <i className="fa-solid fa-file-arrow-up text-purple-500"></i> Upload Text Document
              </span>
              <p className="text-xs text-gray-400">Supported formats: UTF-8 plain text (.txt)</p>
            </div>
            
            <div className="flex items-center gap-3">
              {loadedFileName && (
                <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 max-w-[200px] truncate">
                  <i className="fa-solid fa-file-invoice mr-1.5"></i>
                  {loadedFileName}
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
                id="text-file-upload"
              />
              <label
                htmlFor="text-file-upload"
                className="cursor-pointer px-4 py-2 bg-white dark:bg-[#1f1f26] hover:bg-gray-50 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium shadow-sm transition-all"
              >
                Choose File
              </label>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !knowledgeText.trim()}
            className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
          >
            {isSubmitting ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i>
                Processing Vector Embeddings...
              </>
            ) : (
              <>
                <i className="fa-solid fa-upload"></i>
                Add to Global AI / إضافة إلى الذكاء الاصطناعي
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
