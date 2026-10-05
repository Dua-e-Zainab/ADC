import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { UserPlus, Shield, Trash2, KeyRound, RefreshCw } from "lucide-react";
import { C } from "../../constants/color";
import { Card, CardHeader } from "../ui/Card";
import Field from "../ui/Field";

const API = "/api/users";

const ROLES = ["user", "admin"];
const SITES = ["KHI", "LHE"];

export default function UserManagementTab({ toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newUser, setNewUser] = useState({ username: "", password: "", site: "KHI", role: "user" });
  const [creating, setCreating] = useState(false);

  const [resetPwFor, setResetPwFor] = useState(null);
  const [resetPwValue, setResetPwValue] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(API);
      setUsers(res.data);
    } catch (err) {
      toast?.(err.response?.data?.error || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const createUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.site) {
      return toast?.("Username, password, and site are required", "error");
    }
    if (newUser.password.length < 8) {
      return toast?.("Password must be at least 8 characters", "error");
    }
    setCreating(true);
    try {
      await axios.post(API, newUser);
      toast?.(`User "${newUser.username}" created`, "success");
      setNewUser({ username: "", password: "", site: "KHI", role: "user" });
      fetchUsers();
    } catch (err) {
      toast?.(err.response?.data?.error || "Failed to create user", "error");
    } finally {
      setCreating(false);
    }
  };

  const updateUser = async (id, patch) => {
    try {
      await axios.put(`${API}/${id}`, patch);
      toast?.("User updated", "success");
      fetchUsers();
    } catch (err) {
      toast?.(err.response?.data?.error || "Failed to update user", "error");
    }
  };

  const resetPassword = async (id) => {
    if (resetPwValue.length < 8) {
      return toast?.("Password must be at least 8 characters", "error");
    }
    try {
      await axios.put(`${API}/${id}/password`, { password: resetPwValue });
      toast?.("Password reset", "success");
      setResetPwFor(null);
      setResetPwValue("");
    } catch (err) {
      toast?.(err.response?.data?.error || "Failed to reset password", "error");
    }
  };

  const deleteUser = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/${id}`);
      toast?.(`User "${username}" deleted`, "success");
      fetchUsers();
    } catch (err) {
      toast?.(err.response?.data?.error || "Failed to delete user", "error");
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>User Management</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Add users, assign roles, and manage site access.</p>
        </div>
        <button
          onClick={fetchUsers}
          style={{ height: 34, padding: "0 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* CREATE USER */}
      <Card style={{ marginBottom: 20 }}>
        <CardHeader step="+" title="Add New User" sub="Creates a bcrypt-hashed account immediately" />
        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr 140px 140px auto", gap: 16, alignItems: "end" }}>
          <Field label="Username" req>
            <input
              value={newUser.username}
              onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
              placeholder="e.g. dz.lahore"
              style={{ height: 42, width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none" }}
            />
          </Field>
          <Field label="Password" req hint="Min 8 characters">
            <input
              type="password"
              value={newUser.password}
              onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
              placeholder="••••••••"
              style={{ height: 42, width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none" }}
            />
          </Field>
          <Field label="Site" req>
            <select
              value={newUser.site}
              onChange={e => setNewUser(u => ({ ...u, site: e.target.value }))}
              style={{ height: 42, width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none" }}
            >
              {SITES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Role" req>
            <select
              value={newUser.role}
              onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
              style={{ height: 42, width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none" }}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <button
            onClick={createUser}
            disabled={creating}
            style={{ height: 42, padding: "0 18px", borderRadius: 8, border: "none", background: creating ? C.border : C.navy, color: "#fff", fontSize: 13, fontWeight: 600, cursor: creating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
          >
            <UserPlus size={14} /> {creating ? "Adding..." : "Add User"}
          </button>
        </div>
      </Card>

      {/* USER LIST */}
      <Card style={{ overflow: "hidden" }}>
        <CardHeader step="👥" title="All Users" sub={`${users.length} account${users.length === 1 ? "" : "s"}`} />
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>Loading users...</div>
        ) : !users.length ? (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>No users yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                {["Username", "Site", "Role", "Created", "Last Login", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textFaint, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600, color: C.text }}>{u.username}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <select
                      value={u.site}
                      onChange={e => updateUser(u.id, { site: e.target.value })}
                      style={{ height: 30, border: `1px solid ${C.border}`, borderRadius: 6, padding: "0 8px", fontSize: 12 }}
                    >
                      {SITES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <select
                      value={u.role}
                      onChange={e => updateUser(u.id, { role: e.target.value })}
                      style={{
                        height: 30, border: `1px solid ${u.role === "admin" ? C.blueBorder : C.border}`, borderRadius: 6, padding: "0 8px", fontSize: 12,
                        background: u.role === "admin" ? C.blueLight : "#fff", color: u.role === "admin" ? C.blue : C.text, fontWeight: 600,
                      }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 16px", color: C.textMuted, fontSize: 11 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "10px 16px", color: C.textMuted, fontSize: 11 }}>
                    {u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                      {resetPwFor === u.id ? (
                        <>
                          <input
                            type="password"
                            value={resetPwValue}
                            onChange={e => setResetPwValue(e.target.value)}
                            placeholder="New password"
                            style={{ height: 30, width: 130, border: `1px solid ${C.blueBorder}`, borderRadius: 6, padding: "0 8px", fontSize: 12 }}
                          />
                          <button
                            onClick={() => resetPassword(u.id)}
                            style={{ height: 30, padding: "0 10px", borderRadius: 6, border: "none", background: C.blue, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setResetPwFor(null); setResetPwValue(""); }}
                            style={{ height: 30, padding: "0 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff", fontSize: 11, cursor: "pointer" }}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setResetPwFor(u.id)}
                          title="Reset password"
                          style={{ height: 30, width: 30, borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff", color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <KeyRound size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteUser(u.id, u.username)}
                        title="Delete user"
                        style={{ height: 30, width: 30, borderRadius: 6, border: `1px solid ${C.redBorder}`, background: C.redLight, color: C.red, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}