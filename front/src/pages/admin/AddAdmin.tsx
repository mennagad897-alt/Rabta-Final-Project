import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export const AddAdmin = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('http://localhost:5000/api/v1/admin/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Only keep non-admin users
      setUsers(data?.data?.users?.filter((u: any) => u.role !== 'admin') || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const promoteToAdmin = async (userId: string) => {
    if (!window.confirm('Are you sure you want to promote this user to Admin?')) return;
    
    try {
      await axios.put(`http://localhost:5000/api/v1/admin/users/${userId}/role`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('User is now an Admin');
      setUsers(users.filter(u => u._id !== userId));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to promote user');
    }
  };

  const filteredUsers = users.filter(user => 
    user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Promote Admin</h2>
      
      <div className="mb-6 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141419] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#141419] rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No matching users found.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {filteredUsers.map(user => (
              <div key={user._id} className="flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-lg">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{user.fullName}</h3>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => promoteToAdmin(user._id)}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-purple-500/20"
                >
                  Promote to Admin
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
