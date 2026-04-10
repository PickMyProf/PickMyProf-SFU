const API = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const payload = await response.json();
      detail = payload.detail || payload.message || detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }

  return response.json();
}

export async function fetchCourses(search = "") {
  return request(`/courses?search=${encodeURIComponent(search)}`);
}

export async function searchOfferings({
  search = "",
  term = "",
  delivery_mode = "",
  year = null,
}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (term) params.set("term", term);
  if (delivery_mode) params.set("delivery_mode", delivery_mode);
  if (year) params.set("year", year);
  return request(`/offerings/search?${params}`);
}

export async function fetchProfessor(profId) {
  return request(`/professors/${profId}`);
}

export async function fetchProfessorReviews(profId) {
  return request(`/professors/${profId}/reviews`);
}

export async function fetchProfessorStats(profId) {
  return request(`/analytics/professors/${profId}/stats`);
}

export async function loginAccount(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerAccount(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUserAccount(userId, payload) {
  return request(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteUserAccount(userId) {
  return request(`/users/${userId}`, {
    method: "DELETE",
  });
}
