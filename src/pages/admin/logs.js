import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import AuthWrapper from '../../components/AuthWrapper';

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [nameFilter, setNameFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Sort state
  const [sortField, setSortField] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/logs');
        if (!response.ok) {
          throw new Error('Failed to fetch logs');
        }
        const data = await response.json();
        setLogs(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredAndSortedLogs = logs
    .filter(log => {
      return (
        (!nameFilter || log.name?.toLowerCase().includes(nameFilter.toLowerCase())) &&
        (!emailFilter || log.email.toLowerCase().includes(emailFilter.toLowerCase())) &&
        (!providerFilter || log.authProvider === providerFilter) &&
        (successFilter === '' || log.success === (successFilter === 'true')) &&
        (!startDate || new Date(log.timestamp) >= new Date(startDate)) &&
        (!endDate || new Date(log.timestamp) <= new Date(endDate))
      );
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      if (sortField === 'timestamp') {
        return direction * (new Date(aValue) - new Date(bValue));
      }
      return direction * (aValue < bValue ? -1 : 1);
    });

  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-4xl font-bold mb-8 text-white">Sign-in Logs</h1>

        {/* Filters */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-[#121212] border border-[#482f1f] text-white focus:border-[#006D5B] focus:outline-none"
              placeholder="Filter by name..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="text"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-[#121212] border border-[#482f1f] text-white focus:border-[#006D5B] focus:outline-none"
              placeholder="Filter by email..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-[#121212] border border-[#482f1f] text-white focus:border-[#006D5B] focus:outline-none"
            >
              <option value="">All Providers</option>
              <option value="GOOGLE">Google</option>
              <option value="GITHUB">GitHub</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
            <select
              value={successFilter}
              onChange={(e) => setSuccessFilter(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-[#121212] border border-[#482f1f] text-white focus:border-[#006D5B] focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="true">Successful</option>
              <option value="false">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-[#121212] border border-[#482f1f] text-white focus:border-[#006D5B] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-[#121212] border border-[#482f1f] text-white focus:border-[#006D5B] focus:outline-none"
            />
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006D5B]"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-[#482f1f]">
                  <th 
                    className="px-6 py-3 cursor-pointer hover:text-[#006D5B] text-white"
                    onClick={() => handleSort('timestamp')}
                  >
                    Timestamp {sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-3 cursor-pointer hover:text-[#006D5B] text-white"
                    onClick={() => handleSort('name')}
                  >
                    Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-3 cursor-pointer hover:text-[#006D5B] text-white"
                    onClick={() => handleSort('email')}
                  >
                    Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-3 cursor-pointer hover:text-[#006D5B] text-white"
                    onClick={() => handleSort('authProvider')}
                  >
                    Provider {sortField === 'authProvider' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-3 cursor-pointer hover:text-[#006D5B] text-white"
                    onClick={() => handleSort('success')}
                  >
                    Status {sortField === 'success' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedLogs.map((log, index) => (
                  <tr 
                    key={index} 
                    className="border-b border-[#482f1f] text-gray-300 hover:bg-[#1a1a1a]"
                  >
                    <td className="px-6 py-4">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">{log.name || 'N/A'}</td>
                    <td className="px-6 py-4">{log.email}</td>
                    <td className="px-6 py-4">{log.authProvider}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        log.success 
                          ? 'bg-green-900/50 text-green-400' 
                          : 'bg-red-900/50 text-red-400'
                      }`}>
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default function ProtectedLogsPage() {
  return (
    <AuthWrapper>
      <LogsPage />
    </AuthWrapper>
  );
} 