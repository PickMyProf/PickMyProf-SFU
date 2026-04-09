const API = "http://localhost:8000";

export async function fetchCourses(search = "") {
  const res = await fetch(`${API}/courses?search=${encodeURIComponent(search)}`);
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

export async function searchOfferings({ search = "", term = "", delivery_mode = "", year = null }) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (term) params.set("term", term);
  if (delivery_mode) params.set("delivery_mode", delivery_mode);
  if (year) params.set("year", year);
  const res = await fetch(`${API}/offerings/search?${params}`);
  if (!res.ok) throw new Error("Failed to search offerings");
  return res.json();
}

export async function fetchProfessor(profId) {
  const res = await fetch(`${API}/professors/${profId}`);
  if (!res.ok) throw new Error("Failed to fetch professor");
  return res.json();
}

export async function fetchProfessorReviews(profId) {
  const res = await fetch(`${API}/professors/${profId}/reviews`);
  if (!res.ok) throw new Error("Failed to fetch reviews");
  return res.json();
}

export async function fetchProfessorStats(profId) {
  const res = await fetch(`${API}/analytics/professors/${profId}/stats`);
  if (!res.ok) throw new Error("Failed to fetch professor stats");
  return res.json();
}
