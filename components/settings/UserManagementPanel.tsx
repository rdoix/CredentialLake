'use client';

import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '@/lib/api-config';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import {
  Users,
  UserPlus,
  Shield,
  User as UserIcon,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  X,
  Briefcase,
  Clock,
  Calendar,
  CheckCircle2
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  password_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export default function UserManagementPanel() {
  const { token, user: currentUser } = useUser();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [newUserPasswordsMatch, setNewUserPasswordsMatch] = useState<boolean | null>(null);
  const [editUserPasswordsMatch, setEditUserPasswordsMatch] = useState<boolean | null>(null);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    password_expiry: '90',
    custom_expiry_days: ''
  });

  const [editUser, setEditUser] = useState({
    full_name: '',
    email: '',
    role: '',
    new_password: '',
    confirmPassword: '',
    password_expiry: '90',
    custom_expiry_days: ''
  });

  // Check password match for new user
  useEffect(() => {
    if (newUser.confirmPassword === '') {
      setNewUserPasswordsMatch(null);
    } else if (newUser.password === newUser.confirmPassword) {
      setNewUserPasswordsMatch(true);
    } else {
      setNewUserPasswordsMatch(false);
    }
  }, [newUser.password, newUser.confirmPassword]);

  // Check password match for edit user
  useEffect(() => {
    if (editUser.confirmPassword === '') {
      setEditUserPasswordsMatch(null);
    } else if (editUser.new_password === editUser.confirmPassword) {
      setEditUserPasswordsMatch(true);
    } else {
      setEditUserPasswordsMatch(false);
    }
  }, [editUser.new_password, editUser.confirmPassword]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH_LIST_USERS, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newUser.password !== newUser.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      // Calculate password_expiry_days
      let expiryDays: number | null = 90;
      if (newUser.password_expiry === 'never') {
        expiryDays = 0;
      } else if (newUser.password_expiry === 'custom') {
        expiryDays = parseInt(newUser.custom_expiry_days) || 90;
      } else {
        expiryDays = parseInt(newUser.password_expiry);
      }

      const response = await fetch(API_ENDPOINTS.AUTH_CREATE_USER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUser.username,
          email: newUser.email,
          full_name: newUser.full_name,
          password: newUser.password,
          role: newUser.role,
          password_expiry_days: expiryDays
        })
      });

      if (!response.ok) {
        const data = await response.json();
        // Handle both string and object error details
        let errorMessage = 'Failed to create user';
        
        if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          // Handle Pydantic validation errors (array of error objects)
          errorMessage = data.detail.map((err: any) => {
            const field = err.loc?.join('.') || 'field';
            return `${field}: ${err.msg}`;
          }).join('; ');
        } else if (data.detail?.message) {
          errorMessage = data.detail.message;
        } else if (data.detail) {
          errorMessage = JSON.stringify(data.detail);
        }
        
        throw new Error(errorMessage);
      }

      // Reset form and reload users
      setNewUser({
        username: '',
        email: '',
        full_name: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        password_expiry: '90',
        custom_expiry_days: ''
      });
      setShowCreateModal(false);
      loadUsers();
      toast.success('User Created', 'User created successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (editUser.new_password && editUser.new_password !== editUser.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!editingUser) return;

    try {
      const payload: any = {};
      if (editUser.full_name) payload.full_name = editUser.full_name;
      if (editUser.email) payload.email = editUser.email;
      if (editUser.role) payload.role = editUser.role;
      if (editUser.new_password) {
        payload.new_password = editUser.new_password;
        
        // Calculate password_expiry_days
        let expiryDays: number | null = 90;
        if (editUser.password_expiry === 'never') {
          expiryDays = 0;
        } else if (editUser.password_expiry === 'custom') {
          expiryDays = parseInt(editUser.custom_expiry_days) || 90;
        } else {
          expiryDays = parseInt(editUser.password_expiry);
        }
        payload.password_expiry_days = expiryDays;
      }

      const response = await fetch(API_ENDPOINTS.AUTH_UPDATE_USER(editingUser.id), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        // Handle both string and object error details
        const errorMessage = typeof data.detail === 'string'
          ? data.detail
          : (data.detail?.message || JSON.stringify(data.detail) || 'Failed to update user');
        throw new Error(errorMessage);
      }

      setShowEditModal(false);
      setEditingUser(null);
      loadUsers();
      toast.success('User Updated', 'User updated successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditUser({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      new_password: '',
      confirmPassword: '',
      password_expiry: '90',
      custom_expiry_days: ''
    });
    setError('');
    setShowEditModal(true);
  };

  const handleToggleActive = async (userId: number, currentStatus: boolean) => {
    const accepted = await confirm({
      title: currentStatus ? 'Deactivate User' : 'Activate User',
      message: `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`,
      confirmText: currentStatus ? 'Deactivate' : 'Activate',
      cancelText: 'Cancel',
      challenge: { type: 'checkbox', label: 'I understand this will change account access' }
    });
    if (!accepted) return;

    try {
      const response = await fetch(API_ENDPOINTS.AUTH_UPDATE_USER(userId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_active: !currentStatus
        })
      });

      if (!response.ok) {
        const data = await response.json();
        // Handle both string and object error details
        const errorMessage = typeof data.detail === 'string'
          ? data.detail
          : (data.detail?.message || JSON.stringify(data.detail) || 'Failed to update user');
        throw new Error(errorMessage);
      }

      loadUsers();
      toast.success('Status Changed', `User ${currentStatus ? 'deactivated' : 'activated'} successfully!`);
    } catch (err: any) {
      toast.error('Action Failed', err.message);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    const accepted = await confirm({
      title: 'Delete User',
      message: `This will permanently delete user "${username}". This action cannot be undone.`,
      confirmText: 'Delete User',
      cancelText: 'Cancel',
      variant: 'danger',
      challenge: { type: 'text', expected: username, label: `Type "${username}" to confirm`, caseSensitive: false }
    });
    if (!accepted) return;

    try {
      const response = await fetch(API_ENDPOINTS.AUTH_DELETE_USER(userId), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        // Handle both string and object error details
        const errorMessage = typeof data.detail === 'string'
          ? data.detail
          : (data.detail?.message || JSON.stringify(data.detail) || 'Failed to delete user');
        throw new Error(errorMessage);
      }

      loadUsers();
      toast.success('User Deleted', 'User deleted successfully!');
    } catch (err: any) {
      toast.error('Delete Failed', err.message);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'administrator':
        return {
          icon: Shield,
          label: 'Administrator',
          className: 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
        };
      case 'collector':
        return {
          icon: Briefcase,
          label: 'Collector',
          className: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
        };
      default:
        return {
          icon: UserIcon,
          label: 'User',
          className: 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
        };
    }
  };

  const getPasswordExpiryStatus = (expiresAt?: string) => {
    if (!expiresAt) return null;
    
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { label: 'Expired', className: 'text-red-400', urgent: true };
    } else if (daysUntilExpiry <= 7) {
      return { label: `${daysUntilExpiry}d left`, className: 'text-orange-400', urgent: true };
    } else if (daysUntilExpiry <= 30) {
      return { label: `${daysUntilExpiry}d left`, className: 'text-yellow-400', urgent: false };
    }
    return { label: `${daysUntilExpiry}d left`, className: 'text-green-400', urgent: false };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </h2>
          <p className="text-sm text-muted mt-1">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setError('');
          }}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card-hover border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Password Expiry
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => {
                const roleBadge = getRoleBadge(user.role);
                const RoleIcon = roleBadge.icon;
                const expiryStatus = getPasswordExpiryStatus(user.password_expires_at);
                
                return (
                  <tr key={user.id} className="hover:bg-card-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{user.full_name}</div>
                          <div className="text-sm text-muted">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge.className}`}>
                        <RoleIcon className="w-3 h-3" />
                        {roleBadge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        disabled={user.id === currentUser?.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          user.is_active
                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={user.id === currentUser?.id ? 'Cannot deactivate your own account' : 'Click to toggle status'}
                      >
                        {user.is_active ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {expiryStatus ? (
                        <div className="flex items-center gap-1">
                          <Clock className={`w-3 h-3 ${expiryStatus.className}`} />
                          <span className={`text-xs font-medium ${expiryStatus.className}`}>
                            {expiryStatus.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">No expiry</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                        title="Edit user"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        disabled={user.id === currentUser?.id}
                        className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
                        title={user.id === currentUser?.id ? 'Cannot delete your own account' : 'Delete user'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Create New User</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                }}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Choose username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="user">User (View Only)</option>
                  <option value="collector">Collector (Can Scan & Upload)</option>
                  <option value="administrator">Administrator (Full Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Choose password (min 12 chars)"
                  required
                />
                <PasswordStrengthIndicator 
                  password={newUser.password}
                  username={newUser.username}
                  email={newUser.email}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newUser.confirmPassword}
                    onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2 pr-10 bg-background border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                    style={{
                      borderColor: newUserPasswordsMatch === false ? '#ef4444' : newUserPasswordsMatch === true ? '#10b981' : 'var(--border)'
                    }}
                    placeholder="Confirm password"
                    required
                  />
                  {newUserPasswordsMatch !== null && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {newUserPasswordsMatch ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {newUserPasswordsMatch === false && newUser.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Passwords do not match
                  </p>
                )}
                {newUserPasswordsMatch === true && (
                  <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Passwords match
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password Expiry
                </label>
                <select
                  value={newUser.password_expiry}
                  onChange={(e) => setNewUser({ ...newUser, password_expiry: e.target.value, custom_expiry_days: '' })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="never">Never expire</option>
                  <option value="custom">Custom days</option>
                </select>
                {newUser.password_expiry === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={newUser.custom_expiry_days}
                    onChange={(e) => setNewUser({ ...newUser, custom_expiry_days: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary mt-2"
                    placeholder="Enter days (1-3650)"
                    required
                  />
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 bg-card-hover hover:bg-border text-foreground rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Edit User</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                  setError('');
                }}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={editingUser.username}
                  disabled
                  className="w-full px-4 py-2 bg-card-hover border border-border rounded-lg text-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted mt-1">Username cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editUser.full_name}
                  onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role
                </label>
                <select
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                  disabled={editingUser.id === currentUser?.id}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="user">User (View Only)</option>
                  <option value="collector">Collector (Can Scan & Upload)</option>
                  <option value="administrator">Administrator (Full Access)</option>
                </select>
                {editingUser.id === currentUser?.id && (
                  <p className="text-xs text-muted mt-1">Cannot change your own role</p>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  New Password (optional)
                </label>
                <input
                  type="password"
                  value={editUser.new_password}
                  onChange={(e) => setEditUser({ ...editUser, new_password: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Leave blank to keep current password"
                />
                {editUser.new_password && (
                  <PasswordStrengthIndicator 
                    password={editUser.new_password}
                    username={editingUser.username}
                    email={editUser.email}
                  />
                )}
              </div>

              {editUser.new_password && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={editUser.confirmPassword}
                      onChange={(e) => setEditUser({ ...editUser, confirmPassword: e.target.value })}
                      className="w-full px-4 py-2 pr-10 bg-background border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                      style={{
                        borderColor: editUserPasswordsMatch === false ? '#ef4444' : editUserPasswordsMatch === true ? '#10b981' : 'var(--border)'
                      }}
                      placeholder="Confirm new password"
                    />
                    {editUserPasswordsMatch !== null && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {editUserPasswordsMatch ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {editUserPasswordsMatch === false && editUser.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Passwords do not match
                    </p>
                  )}
                  {editUserPasswordsMatch === true && (
                    <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Passwords match
                    </p>
                  )}
                </div>
              )}

              {editUser.new_password && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password Expiry
                  </label>
                  <select
                    value={editUser.password_expiry}
                    onChange={(e) => setEditUser({ ...editUser, password_expiry: e.target.value, custom_expiry_days: '' })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="never">Never expire</option>
                    <option value="custom">Custom days</option>
                  </select>
                  {editUser.password_expiry === 'custom' && (
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={editUser.custom_expiry_days}
                      onChange={(e) => setEditUser({ ...editUser, custom_expiry_days: e.target.value })}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary mt-2"
                      placeholder="Enter days (1-3650)"
                      required
                    />
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 bg-card-hover hover:bg-border text-foreground rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}