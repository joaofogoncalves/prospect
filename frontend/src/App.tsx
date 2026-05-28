import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
};

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    try {
      const res = await fetch(`${API_URL}/api/projects`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setProjects(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch(`${API_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setName("");
      loadProjects();
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Project Intake</h1>

      <form onSubmit={createProject} style={{ display: "flex", gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit">Add</button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <strong>{p.name}</strong> — <em>{p.status}</em>
          </li>
        ))}
      </ul>
    </main>
  );
}
