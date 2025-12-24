"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, UserPlus, Trash2, Shield, User, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CompanyUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UnlinkedUser {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface Company {
  id: string;
  name: string;
}

export default function UsersPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch company info
        const companyRes = await fetch(`/api/admin/companies/${companyId}`);
        if (companyRes.ok) {
          const companyData = await companyRes.json();
          setCompany(companyData);
        }

        // Fetch company users
        const usersRes = await fetch(`/api/admin/companies/${companyId}/users`);
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }

        // Fetch unlinked users
        const unlinkedRes = await fetch("/api/admin/users/unlinked");
        if (unlinkedRes.ok) {
          const unlinkedData = await unlinkedRes.json();
          setUnlinkedUsers(unlinkedData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load user data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId]);

  // Add user to company
  async function addUser(userId: string, role: "admin" | "viewer" = "viewer") {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add user");
      }

      const addedUser = await res.json();

      // Update local state
      setUnlinkedUsers((prev) => prev.filter((u) => u.id !== userId));
      setUsers((prev) => [...prev, { ...addedUser, createdAt: new Date().toISOString(), lastLoginAt: null }]);

      toast.success("User added to company");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add user");
    } finally {
      setActionLoading(null);
    }
  }

  // Remove user from company
  async function removeUser(userId: string) {
    if (!confirm("Are you sure you want to remove this user from the company?")) {
      return;
    }

    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/users/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove user");
      }

      // Update local state
      const removedUser = users.find((u) => u.id === userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (removedUser) {
        setUnlinkedUsers((prev) => [...prev, {
          id: removedUser.id,
          email: removedUser.email,
          createdAt: removedUser.createdAt,
          lastLoginAt: removedUser.lastLoginAt
        }]);
      }

      toast.success("User removed from company");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove user");
    } finally {
      setActionLoading(null);
    }
  }

  // Sync Clerk users to database
  async function syncUsers() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/users/sync", {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sync users");
      }

      const result = await res.json();
      toast.success(result.message);

      // Refresh unlinked users list
      const unlinkedRes = await fetch("/api/admin/users/unlinked");
      if (unlinkedRes.ok) {
        const unlinkedData = await unlinkedRes.json();
        setUnlinkedUsers(unlinkedData);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync users");
    } finally {
      setSyncing(false);
    }
  }

  // Change user role
  async function changeRole(userId: string, newRole: "admin" | "viewer") {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to change role");
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );

      toast.success(`Role changed to ${newRole}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change role");
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={`/admin/companies/${companyId}`}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Company
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          Users - {company?.name || "Company"}
        </h1>
        <p className="text-muted-foreground">
          Manage users who can access this company&apos;s reports.
        </p>
      </div>

      {/* Company Users */}
      <Card>
        <CardHeader>
          <CardTitle>Company Users</CardTitle>
          <CardDescription>
            {users.length} user(s) have access to this company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No users assigned to this company yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-3 font-medium">Email</th>
                    <th className="text-left py-3 px-3 font-medium">Role</th>
                    <th className="text-left py-3 px-3 font-medium">Last Login</th>
                    <th className="text-right py-3 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {user.role === "admin" ? (
                            <Shield className="w-4 h-4 text-primary" />
                          ) : (
                            <User className="w-4 h-4 text-muted-foreground" />
                          )}
                          {user.email}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {formatDate(user.lastLoginAt)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === user.id}
                            onClick={() =>
                              changeRole(user.id, user.role === "admin" ? "viewer" : "admin")
                            }
                          >
                            {user.role === "admin" ? "Make Viewer" : "Make Admin"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionLoading === user.id}
                            onClick={() => removeUser(user.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              <CardTitle>Add User</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={syncUsers}
              disabled={syncing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync from Clerk"}
            </Button>
          </div>
          <CardDescription>
            Add users who have signed up but aren&apos;t linked to a company yet.
            Click &quot;Sync from Clerk&quot; to import users who signed up but aren&apos;t in the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unlinkedUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No unlinked users available. Users appear here after they sign up.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-3 font-medium">Email</th>
                    <th className="text-left py-3 px-3 font-medium">Signed Up</th>
                    <th className="text-right py-3 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unlinkedUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-3">{user.email}</td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === user.id}
                            onClick={() => addUser(user.id, "viewer")}
                          >
                            Add as Viewer
                          </Button>
                          <Button
                            size="sm"
                            disabled={actionLoading === user.id}
                            onClick={() => addUser(user.id, "admin")}
                          >
                            Add as Admin
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
