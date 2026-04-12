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

export async function fetchSavedItems(studentId) {
  return request(`/students/${studentId}/saved`);
}

export async function saveCourse(studentId, courseId) {
  return request(`/students/${studentId}/saved/courses`, {
    method: "POST",
    body: JSON.stringify({ course_id: courseId }),
  });
}

export async function removeSavedCourse(studentId, courseId) {
  return request(`/students/${studentId}/saved/courses/${courseId}`, {
    method: "DELETE",
  });
}

export async function saveInstructor(studentId, courseId, profId) {
  return request(`/students/${studentId}/saved/instructors`, {
    method: "POST",
    body: JSON.stringify({ course_id: courseId, prof_id: profId }),
  });
}

export async function removeSavedInstructor(studentId, courseId, profId) {
  return request(`/students/${studentId}/saved/instructors/${courseId}/${profId}`, {
    method: "DELETE",
  });
}

export async function fetchStudentReviews(studentId) {
  return request(`/students/${studentId}/reviews`);
}

export async function submitStudentReview(studentId, payload) {
  return request(`/students/${studentId}/reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStudentReview(studentId, reviewId, payload) {
  return request(`/students/${studentId}/reviews/${reviewId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteStudentReview(studentId, reviewId) {
  return request(`/students/${studentId}/reviews/${reviewId}`, {
    method: "DELETE",
  });
}

export async function fetchPendingReviewCount() {
  return request("/moderation/reviews/pending/count");
}

export async function fetchPendingReviews() {
  return request("/moderation/reviews?status=PENDING");
}

export async function fetchModerationHistory(moderatorId) {
  return request(`/moderation/history?moderator_id=${moderatorId}`);
}

export async function moderateReview(reviewId, payload) {
  return request(`/moderation/reviews/${reviewId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
