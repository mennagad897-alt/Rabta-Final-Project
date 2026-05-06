import { useEffect, useState } from 'react';
import axios from 'axios';

export const AdminLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const { data } = await axios.get('http://localhost:5000/api/v1/admin/logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setLogs(data?.data?.logs || data?.logs || data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getRelativeTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const getActionIcon = (action: string) => {
    if (!action) return 'fa-clipboard-list text-purple-500';
    const act = action.toLowerCase();
    if (act.includes('delete')) return 'fa-trash text-red-500';
    if (act.includes('ban')) return 'fa-ban text-red-500';
    if (act.includes('unban')) return 'fa-check-circle text-green-500';
    if (act.includes('create')) return 'fa-plus text-blue-500';
    if (act.includes('update')) return 'fa-pen text-yellow-500';
    return 'fa-clipboard-list text-purple-500';
  };

  if (loading) return <div className="text-gray-900 dark:text-white p-8">Loading logs...</div>;

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Activity Logs</h2>
      <div className="bg-white dark:bg-[#141419] rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm">
        <div className="p-6">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No activity logs found.</p>
          ) : (
            <div className="space-y-6">
              {logs.map((log) => (
                <div key={log._id || Math.random()} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
                    <i className={`fa-solid ${getActionIcon(log.action)}`}></i>
                  </div>
                  <div className="flex-1 pb-6 border-b border-gray-100 dark:border-white/5 last:border-0 last:pb-0">
                    <p className="text-gray-900 dark:text-white">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {log.adminId?.fullName || 'Admin'}
                      </span>{' '}
                      {log.action}{' '}
                      <span className="font-medium">
                        {log.targetEntityName || ''}
                      </span>
                    </p>
                    {log.createdAt && (
                      <p className="text-sm text-gray-500 mt-1">
                        {getRelativeTime(log.createdAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
