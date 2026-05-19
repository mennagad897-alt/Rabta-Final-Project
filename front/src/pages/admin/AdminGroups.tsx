import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export const AdminGroups = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredGroups = (Array.isArray(groups) ? groups : []).filter(group => 
    group?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group?.creator?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentGroups = filteredGroups.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);

  const fetchGroups = async () => {
    try {
      const { data } = await axios.get('http://localhost:5000/api/v1/admin/groups', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setGroups(data?.data?.groups || data?.groups || data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const deleteGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this community?')) return;
    
    try {
      await axios.delete(`http://localhost:5000/api/v1/admin/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setGroups(groups.filter(g => g._id !== groupId));
      toast.success('Community deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Action failed. Please try again.');
    }
  };

  if (loading) return <div className="text-gray-900 dark:text-white p-8">Loading community data...</div>;

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Community Management</h2>
      
      <div className="mb-6 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search communities by name or creator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141419] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#141419] rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400">
              <th className="p-4 font-medium">Community Name</th>
              <th className="p-4 font-medium">Creator</th>
              <th className="p-4 font-medium">Members</th>
              <th className="p-4 font-medium">Created At</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentGroups.map(group => (
              <tr key={group?._id || Math.random()} className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <td className="p-4 font-medium text-gray-900 dark:text-white">{group?.name || 'Unnamed'}</td>
                <td className="p-4 text-gray-600 dark:text-gray-400">{group?.creator?.fullName || 'Unknown'}</td>
                <td className="p-4 text-purple-600 dark:text-purple-400">{group?.memberCount || 0}</td>
                <td className="p-4 text-gray-500">
                  {group?.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'N/A'}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => deleteGroup(group?._id)}
                    className="px-4 py-2 rounded-lg text-sm bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-all"
                  >
                    Delete Community
                  </button>
                </td>
              </tr>
            ))}
            {filteredGroups.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">No communities found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredGroups.length > 0 && (
        <div className="mt-6 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div>
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredGroups.length)} of {filteredGroups.length} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
