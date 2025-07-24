import React, { useState, useEffect, useCallback } from "react";
import "./App.css";

// Backend API URL (edit if hosted differently)
// You may want to use an environment variable or config
const API_BASE_URL = "http://localhost:3001";

// ---- Helper: Fetch wrapper with token support ----
async function apiFetch(url, options = {}, token = null, isForm = false) {
  const headers = options.headers || {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (
    !options.body ||
    headers["Content-Type"] ||
    isForm
  ) {
    // do nothing, handled outside or by fetch
  } else {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type");
  if (!ct?.includes("application/json")) {
    throw new Error(await res.text());
  }
  const data = await res.json();
  if (!res.ok) {
    throw data;
  }
  return data;
}

// ---- Components ----

// PUBLIC_INTERFACE
function Header({ onLogout, user, theme, toggleTheme }) {
  return (
    <header className="header">
      <div className="logo-area">
        <span className="logo">📝 Notes</span>
      </div>
      <nav className="nav">
        {user && (
          <span className="user-email">{user.email}</span>
        )}
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
        {user && (
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        )}
      </nav>
    </header>
  );
}

// PUBLIC_INTERFACE
function AuthForm({ onLogin, onRegister, loading }) {
  const [isRegister, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  // PUBLIC_INTERFACE
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        await onRegister(email, password);
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      setError(err?.detail?.[0]?.msg || err?.detail || err?.message || "Auth failed");
    }
  };

  return (
    <div className="center-container">
      <form className="auth-form card" onSubmit={handleSubmit}>
        <h2>{isRegister ? "Register" : "Sign In"}</h2>
        <input
          autoFocus
          type="email"
          name="email"
          autoComplete="username"
          placeholder="Email"
          value={email}
          required
          minLength={3}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <input
          type="password"
          name="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder="Password"
          value={password}
          required
          minLength={6}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading} className="btn btn-accent">
          {loading ? "Please wait..." : isRegister ? "Register" : "Sign In"}
        </button>
        <div className="toggle-auth">
          {isRegister
            ? (
              <span>
                Already have an account?{" "}
                <button type="button" className="link-btn" onClick={() => setRegister(false)}>
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                No account?{" "}
                <button type="button" className="link-btn" onClick={() => setRegister(true)}>
                  Register
                </button>
              </span>
            )}
        </div>
        {error && <div className="error">{error.toString()}</div>}
      </form>
    </div>
  );
}

// PUBLIC_INTERFACE
function NotesSidebar({ notes, selectedId, onSelectNote, onCreateNew, onSearch }) {
  const [search, setSearch] = useState("");

  const filtered = (search || "").trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <input
          type="text"
          className="sidebar-search"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (onSearch) onSearch(e.target.value);
          }}
        />
        <button className="btn btn-accent btn-new" onClick={onCreateNew} title="New note">
          +
        </button>
      </div>
      <ul className="note-list">
        {filtered.length === 0 && (
          <li className="note-list-empty">No notes found</li>
        )}
        {filtered.map((note) => (
          <li
            key={note.id}
            className={"note-list-item" + (note.id === selectedId ? " selected" : "")}
            onClick={() => onSelectNote(note.id)}
            tabIndex={0}
            aria-current={note.id === selectedId}
          >
            <div className="note-title">{note.title || <em>(untitled)</em>}</div>
            <div className="note-meta">
              <span className="note-date">
                {note.updated_at
                  ? new Date(note.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// PUBLIC_INTERFACE
function NoteView({
  note,
  onEdit,
  onDelete,
}) {
  if (!note) {
    return (
      <div className="note-empty">
        <span>No note selected.</span>
      </div>
    );
  }
  return (
    <article className="note-article">
      <div className="note-view-header">
        <h2 className="note-view-title">{note.title}</h2>
        <div>
          <button className="btn small" onClick={onEdit}>Edit</button>
          <button className="btn small danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
      <div className="note-view-date">
        <span>
          Last updated: {note.updated_at ? new Date(note.updated_at).toLocaleString() : ""}
        </span>
      </div>
      <div className="note-view-content">{note.content}</div>
    </article>
  );
} 

// PUBLIC_INTERFACE
function NoteEditor({ initialNote, onSave, onCancel, loading, error }) {
  const [title, setTitle] = useState(initialNote?.title || "");
  const [content, setContent] = useState(initialNote?.content || "");

  // Focus title first on mount
  useEffect(() => {
    setTitle(initialNote?.title || "");
    setContent(initialNote?.content || "");
  }, [initialNote]);

  // Keyboard: ESC cancels, Ctrl+Enter saves
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.ctrlKey && e.key === "Enter") onSave({ title, content });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line
  }, [title, content, onSave, onCancel]);

  // PUBLIC_INTERFACE
  const trySave = (e) => {
    e.preventDefault();
    if ((title || "").trim().length === 0) return;
    onSave({ title, content });
  };

  return (
    <form className="note-edit-form card" onSubmit={trySave}>
      <h2>{initialNote ? "Edit Note" : "New Note"}</h2>
      <input
        autoFocus
        name="title"
        type="text"
        placeholder="Note title"
        minLength={1}
        maxLength={128}
        value={title}
        onChange={e => setTitle(e.target.value)}
        disabled={loading}
        required
      />
      <textarea
        name="content"
        rows={8}
        placeholder="Note content"
        maxLength={2048}
        value={content}
        onChange={e => setContent(e.target.value)}
        disabled={loading}
      />
      <div className="edit-actions">
        <button className="btn btn-accent" type="submit" disabled={loading || title.trim() === ""}>
          {loading ? "Saving..." : "Save"}
        </button>
        <button className="btn" onClick={onCancel} type="button" disabled={loading}>
          Cancel
        </button>
        <span className="form-error">{error}</span>
      </div>
    </form>
  );
}

// ---- Main App ----
// PUBLIC_INTERFACE
function App() {
  // App state
  const [theme, setTheme] = useState("light");
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorError, setEditorError] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Theme manager
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load current user on token set
  useEffect(() => {
    if (!token) {
      setUser(null);
      setNotes([]);
      return;
    }
    let cancelled = false;
    apiFetch("/users/me", {}, token)
      .then((user) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => {
        setUser(null);
        setToken("");
        localStorage.removeItem("token");
      });
    return () => { cancelled = true; };
  }, [token]);

  // Load notes on user loaded
  useEffect(() => {
    if (!token || !user) {
      setNotes([]);
      return;
    }
    apiFetch("/notes", {}, token)
      .then((arr) => setNotes(arr || []))
      .catch(() => setNotes([]));
  }, [token, user]);

  // Auto-select newest note
  useEffect(() => {
    if (!notes.length) setSelectedNoteId(null);
    else if (!selectedNoteId || !notes.find(n => n.id === selectedNoteId)) {
      setSelectedNoteId(notes[0]?.id);
    }
    // eslint-disable-next-line
  }, [notes]);

  // Theme toggle
  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prevTheme) => prevTheme === "light" ? "dark" : "light");
  };

  // Authentication handlers
  // PUBLIC_INTERFACE
  const handleLogin = async (email, password) => {
    setAuthLoading(true);
    try {
      // FastAPI expects x-www-form-urlencoded for login
      const params = new URLSearchParams();
      params.append("username", email);
      params.append("password", password);
      const resp = await apiFetch(
        "/auth/login",
        { method: "POST", body: params, headers: {} },
        null,
        true
      );
      setToken(resp.access_token);
      localStorage.setItem("token", resp.access_token);
    } catch (e) {
      throw e;
    } finally {
      setAuthLoading(false);
    }
  };

  // PUBLIC_INTERFACE
  const handleRegister = async (email, password) => {
    setAuthLoading(true);
    try {
      await apiFetch(
        "/auth/register",
        { method: "POST", body: JSON.stringify({ email, password }) },
        null
      );
      // Auto login after registration
      await handleLogin(email, password);
    } catch (e) {
      throw e;
    } finally {
      setAuthLoading(false);
    }
  };

  // PUBLIC_INTERFACE
  const handleLogout = useCallback(() => {
    setUser(null);
    setToken("");
    setNotes([]);
    localStorage.removeItem("token");
  }, []);

  // Notes CRUD handlers
  // PUBLIC_INTERFACE
  const handleSelectNote = (id) => {
    setSelectedNoteId(id);
    setShowEditor(false);
    setEditingNoteId(null);
    setEditorError(null);
  };

  // PUBLIC_INTERFACE
  const handleCreateNew = () => {
    setShowEditor(true);
    setEditingNoteId(null);
    setEditorError(null);
  };

  // PUBLIC_INTERFACE
  const handleEditNote = () => {
    setShowEditor(true);
    setEditingNoteId(selectedNoteId);
    setEditorError(null);
  };

  // PUBLIC_INTERFACE
  const handleDeleteNote = async () => {
    if (!selectedNoteId) return;
    if (!window.confirm("Delete this note?")) return;
    try {
      await apiFetch(`/notes/${selectedNoteId}`, { method: "DELETE" }, token);
      setNotes((prev) => prev.filter((n) => n.id !== selectedNoteId));
      setSelectedNoteId(null);
      setShowEditor(false);
      setEditingNoteId(null);
    } catch (err) {
      alert("Error deleting note: " + (err.detail || err.message || "Unknown"));
    }
  };

  // PUBLIC_INTERFACE
  const handleSaveNote = async (noteData) => {
    setEditorLoading(true);
    setEditorError(null);
    try {
      if (editingNoteId) {
        // update
        const updated = await apiFetch(
          `/notes/${editingNoteId}`,
          { method: "PUT", body: JSON.stringify(noteData) },
          token
        );
        setNotes((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
        );
        setSelectedNoteId(updated.id);
      } else {
        // create
        const created = await apiFetch(
          `/notes`,
          { method: "POST", body: JSON.stringify(noteData) },
          token
        );
        setNotes((prev) => [created, ...prev]);
        setSelectedNoteId(created.id);
      }
      setShowEditor(false);
      setEditingNoteId(null);
    } catch (err) {
      setEditorError(
        err?.detail?.[0]?.msg ||
          err?.detail ||
          err?.message ||
          "Error saving note"
      );
    } finally {
      setEditorLoading(false);
    }
  };

  const selectedNote = selectedNoteId
    ? notes.find((n) => n.id === selectedNoteId)
    : null;

  // UI Layout
  if (!token || !user) {
    return (
      <div className="App">
        <Header user={null} theme={theme} toggleTheme={toggleTheme} />
        <AuthForm
          onLogin={handleLogin}
          onRegister={handleRegister}
          loading={authLoading}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <Header
        user={user}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <div className="main-layout">
        <NotesSidebar
          notes={notes}
          selectedId={selectedNoteId}
          onSelectNote={handleSelectNote}
          onCreateNew={handleCreateNew}
        />
        <main className="main-content">
          {showEditor ? (
            <NoteEditor
              initialNote={editingNoteId ? selectedNote : null}
              onSave={handleSaveNote}
              onCancel={() => {
                setShowEditor(false);
                setEditorError(null);
              }}
              loading={editorLoading}
              error={editorError}
            />
          ) : (
            <NoteView
              note={selectedNote}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
