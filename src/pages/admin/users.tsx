import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import AuthWrapper from '../../components/AuthWrapper';
import React from 'react';

interface User {
  email: string;
  name: string | null;
  isAdmin: boolean;
  createdAt: string;
}

const AdminUsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/manage-authorized-users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      setError(errorMessage);
    }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/manage-authorized-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName,
        }),
      });

      if (!response.ok) throw new Error('Failed to add user');
      
      setSuccess('User added successfully');
      setNewUserEmail('');
      setNewUserName('');
      fetchUsers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add user';
      setError(errorMessage);
    }
  };

  const removeUser = async (email: string) => {
    try {
      const response = await fetch('/api/manage-authorized-users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) throw new Error('Failed to remove user');
      
      setSuccess('User removed successfully');
      fetchUsers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove user';
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header hideLogoOnHome={true} />
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">Manage Authorized Users</h1>
            <p className="text-gray-400">Add or remove users who can access the system.</p>
          </div>

          {/* Add User Form */}
          <form onSubmit={addUser} className="space-y-4 bg-[#121212]/50 p-6 rounded-lg border-2 border-[#482f1f]">
            <h2 className="text-2xl font-bold text-white mb-4">Add New User</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  id="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="mt-1 w-full px-4 py-2 bg-[#121212] border border-[#482f1f] rounded-md text-white"
                  required
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300">Name</label>
                <input
                  type="text"
                  id="name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="mt-1 w-full px-4 py-2 bg-[#121212] border border-[#482f1f] rounded-md text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="glow-button px-6 py-3 border-2 border-[#006D5B] text-[#006D5B] rounded-full hover:text-[#006D5B] transition-all duration-200"
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              Add User
            </button>
          </form>

          {/* Messages */}
          {error && (
            <div className="mt-8 p-4 rounded-md bg-yellow-950/50 border-yellow-600 border-l-4 animate-[slideIn_0.3s_ease-out]">
              <div className="flex items-center">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.5 0C3.36 0 0 3.36 0 7.5C0 11.64 3.36 15 7.5 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.5 0ZM6.75 3.75H8.25V8.25H6.75V3.75ZM6.75 9.75H8.25V11.25H6.75V9.75ZM1.5 7.5C1.5 10.815 4.185 13.5 7.5 13.5C10.815 13.5 13.5 10.815 13.5 7.5C13.5 4.185 10.815 1.5 7.5 1.5C4.185 1.5 1.5 4.185 1.5 7.5Z"
                    fill="#EAB308"
                  />
                </svg>
                <p className="text-yellow-200 ml-2">{error}</p>
              </div>
            </div>
          )}
          {success && (
            <div className="mt-8 p-4 rounded-md bg-green-950/50 border-green-600 border-l-4 animate-[slideIn_0.3s_ease-out]">
              <div className="flex items-center">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.5 0C3.36 0 0 3.36 0 7.5C0 11.64 3.36 15 7.5 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.5 0ZM6 11.25L2.25 7.5L3.315 6.435L6 9.12L11.685 3.435L12.75 4.5L6 11.25Z"
                    fill="#22C55E"
                  />
                </svg>
                <p className="text-green-200 ml-2">{success}</p>
              </div>
            </div>
          )}

          {/* Users List */}
          <div className="bg-[#121212]/50 p-6 rounded-lg border-2 border-[#482f1f]">
            <h2 className="text-2xl font-bold text-white mb-4">Authorized Users</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-[#482f1f]">
                    <th className="py-3 text-gray-300">Email</th>
                    <th className="py-3 text-gray-300">Name</th>
                    <th className="py-3 text-gray-300">Admin</th>
                    <th className="py-3 text-gray-300">Added</th>
                    <th className="py-3 text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.email} className="border-b border-[#482f1f] text-gray-300">
                      <td className="py-3">{user.email}</td>
                      <td className="py-3">{user.name || '-'}</td>
                      <td className="py-3">{user.isAdmin ? 'Yes' : 'No'}</td>
                      <td className="py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="py-3">
                        <button
                          onClick={() => removeUser(user.email)}
                          className="text-red-500 hover:text-red-400"
                          disabled={user.isAdmin}
                          title={user.isAdmin ? "Can't remove admin users" : "Remove user"}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default function ProtectedAdminPage() {
  return (
    <AuthWrapper>
      <AdminUsersPage />
    </AuthWrapper>
  );
} 