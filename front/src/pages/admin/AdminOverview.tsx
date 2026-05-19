import { useEffect, useState } from 'react';
import axios from 'axios';

export const AdminOverview = () => {
  const [stats, setStats] = useState({ users: 0, jobs: 0, groups: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await axios.get('http://localhost:5000/api/v1/admin/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const backendStats = data.data.stats;
        setStats({
          users: backendStats.totalUsers || 0,
          jobs: backendStats.totalJobs || 0,
          groups: backendStats.totalGroups || 0
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-gray-900 dark:text-white p-8">Loading stats...</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Users */}
        <div className="bg-white dark:bg-[#141419] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 font-medium text-lg">Total Users</h3>
            <i className="fa-solid fa-users text-2xl text-purple-500"></i>
          </div>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">{stats.users}</p>
        </div>

        {/* Total Jobs */}
        <div className="bg-white dark:bg-[#141419] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 font-medium text-lg">Total Jobs</h3>
            <i className="fa-solid fa-briefcase text-2xl text-green-500"></i>
          </div>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">{stats.jobs}</p>
        </div>

        {/* Total Groups */}
        <div className="bg-white dark:bg-[#141419] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 font-medium text-lg">Communities</h3>
            <i className="fa-solid fa-layer-group text-2xl text-blue-500"></i>
          </div>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">{stats.groups}</p>
        </div>
      </div>
    </div>
  );
};
