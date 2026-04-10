import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import PMPLogo from "./assets/PMPLogo.png";
import {
  deleteUserAccount,
  fetchCourses,
  fetchProfessorReviews,
  fetchProfessorStats,
  loginAccount,
  registerAccount,
  searchOfferings,
  updateUserAccount,
} from "./api";

const AUTH_STORAGE_KEY = "pickmyprof.currentUser";

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function App() {
  const [fadeOut, setFadeOut] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [activeDot, setActiveDot] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);

  const [selectedProf, setSelectedProf] = useState(null);
  const [profStats, setProfStats] = useState(null);
  const [profReviews, setProfReviews] = useState([]);
  const [loadingProf, setLoadingProf] = useState(false);

  const [currentUser, setCurrentUser] = useState(readStoredUser);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    display_name: "",
    email: "",
    password: "",
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    email: "",
    password: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  const fullText =
    "Welcome to the one place for SFU schedules, professor insights, and account management.";

  useEffect(() => {
    let index = 0;

    const startDelay = setTimeout(() => {
      const typingInterval = setInterval(() => {
        setTypedText(fullText.slice(0, index + 1));
        index += 1;
        if (index === fullText.length) {
          clearInterval(typingInterval);
        }
      }, 38);
    }, 1100);

    const dotInterval = setInterval(() => {
      setActiveDot((dot) => (dot + 1) % 3);
    }, 900);

    const fadeTimer = setTimeout(() => setFadeOut(true), 4400);
    const showHomeTimer = setTimeout(() => setShowHome(true), 5200);

    return () => {
      clearTimeout(startDelay);
      clearInterval(dotInterval);
      clearTimeout(fadeTimer);
      clearTimeout(showHomeTimer);
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      setProfileForm({
        display_name: currentUser.display_name || "",
        email: currentUser.email || "",
        password: "",
      });
      return;
    }

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setProfileForm({
      display_name: "",
      email: "",
      password: "",
    });
  }, [currentUser]);

  const loadCourses = useCallback(async () => {
    if (!searchTerm.trim()) {
      setCourses([]);
      return;
    }

    setLoadingCourses(true);
    try {
      const data = await fetchCourses(searchTerm);
      setCourses(data);
    } catch {
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timeout = setTimeout(loadCourses, 300);
    return () => clearTimeout(timeout);
  }, [loadCourses]);

  const handleSelectCourse = async (course) => {
    setSelectedCourse(course);
    setSelectedProf(null);
    setProfStats(null);
    setProfReviews([]);
    setLoadingOfferings(true);

    try {
      const data = await searchOfferings({ search: course.course_number });
      setOfferings(
        data.filter((offering) => String(offering.course_id) === String(course.course_id)),
      );
    } catch {
      setOfferings([]);
    } finally {
      setLoadingOfferings(false);
    }
  };

  const handleSelectProf = async (profId, profName) => {
    setSelectedProf({ prof_id: profId, prof_name: profName });
    setLoadingProf(true);

    try {
      const [stats, reviews] = await Promise.all([
        fetchProfessorStats(profId),
        fetchProfessorReviews(profId),
      ]);
      setProfStats(stats);
      setProfReviews(reviews);
    } catch {
      setProfStats(null);
      setProfReviews([]);
    } finally {
      setLoadingProf(false);
    }
  };

  const uniqueProfs = useMemo(() => {
    if (!selectedCourse) {
      return [];
    }

    return Object.values(
      offerings.reduce((accumulator, offering) => {
        if (!accumulator[offering.prof_id]) {
          accumulator[offering.prof_id] = {
            prof_id: offering.prof_id,
            prof_name: offering.prof_name,
            rmp_avg_rating: offering.rmp_avg_rating,
            rmp_avg_difficulty: offering.rmp_avg_difficulty,
            app_overall_rating: offering.app_overall_rating,
            app_review_count: offering.app_review_count,
            sections: [],
          };
        }

        accumulator[offering.prof_id].sections.push(offering);
        return accumulator;
      }, {}),
    );
  }, [offerings, selectedCourse]);

  const openAuthModal = (mode) => {
    setAuthMode(mode);
    setAuthError("");
    setAuthForm({ display_name: "", email: "", password: "" });
    setAuthModalOpen(true);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const response =
        authMode === "login"
          ? await loginAccount({
              email: authForm.email,
              password: authForm.password,
            })
          : await registerAccount(authForm);

      setCurrentUser(response.user);
      setAuthModalOpen(false);
      setAuthForm({ display_name: "", email: "", password: "" });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      return;
    }

    setProfileLoading(true);
    setProfileError("");
    setProfileMessage("");

    try {
      const payload = {
        display_name: profileForm.display_name,
        email: profileForm.email,
      };

      if (profileForm.password.trim()) {
        payload.password = profileForm.password;
      }

      const response = await updateUserAccount(currentUser.user_id, payload);
      setCurrentUser(response.user);
      setProfileForm((current) => ({ ...current, password: "" }));
      setProfileMessage("Account updated successfully.");
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this account? Linked student rows and related plans/reviews will be removed through cascade rules.",
    );

    if (!confirmed) {
      return;
    }

    setProfileLoading(true);
    setProfileError("");

    try {
      await deleteUserAccount(currentUser.user_id);
      setCurrentUser(null);
      setProfileModalOpen(false);
      setSelectedCourse(null);
      setSelectedProf(null);
      setProfStats(null);
      setProfReviews([]);
      setOfferings([]);
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setProfileModalOpen(false);
    setProfileError("");
    setProfileMessage("");
  };

  return (
    <div className="app-root">
      <div className={`splash-screen ${fadeOut ? "fade-out" : ""}`}>
        <div className="splash-content">
          <div className="splash-logo-wrapper">
            <img src={PMPLogo} alt="PickMyProf Logo" className="splash-logo" />
          </div>
          <p className="typing-text">
            {typedText}
            <span className="cursor">|</span>
          </p>
        </div>
        <div className="dot-indicators">
          {[0, 1, 2].map((index) => (
            <span key={index} className={activeDot === index ? "active" : ""} />
          ))}
        </div>
      </div>

      <main className={`home-page ${showHome ? "show" : ""}`}>
        <header className="topbar">
          <div className="topbar-brand">
            <img src={PMPLogo} alt="Logo" className="topbar-logo" />
            <span>PickMyProf SFU</span>
          </div>

          <div className="topbar-actions">
            {currentUser ? (
              <>
                <div className="account-pill">
                  <strong>{currentUser.display_name}</strong>
                  <span>{currentUser.role}</span>
                </div>
                <button
                  type="button"
                  className="topbar-button light"
                  onClick={() => {
                    setProfileError("");
                    setProfileMessage("");
                    setProfileModalOpen(true);
                  }}
                >
                  Account
                </button>
                <button type="button" className="topbar-button" onClick={handleLogout}>
                  Log Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="topbar-button light"
                  onClick={() => openAuthModal("login")}
                >
                  Log In
                </button>
                <button
                  type="button"
                  className="topbar-button"
                  onClick={() => openAuthModal("signup")}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </header>

        <div className="panels">
          <div className="panel panel-left">
            <div className="panel-header">
              <h2>Search Courses</h2>
            </div>

            <div className="search-input-wrap">
              <svg
                className="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="e.g. 120, Data Structures, CMPT 225..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSelectedCourse(null);
                  setSelectedProf(null);
                }}
              />
            </div>

            {!currentUser ? (
              <div className="auth-hint-card">
                <strong>Student accounts are live.</strong>
                <p>
                  Sign up to create a `studentuser` account. Moderator accounts are added
                  manually in the database, but both roles can log in through the same
                  form.
                </p>
              </div>
            ) : (
              <div className="auth-hint-card signed-in">
                <strong>Signed in as {currentUser.display_name}</strong>
                <p>
                  Use the Account button to update your display name, email, password, or
                  delete the account with cascade cleanup.
                </p>
              </div>
            )}

            <div className="course-list">
              {!searchTerm.trim() ? (
                <div className="panel-empty">
                  <div className="panel-empty-icon">📚</div>
                  <p>Type a course number or title to get started</p>
                </div>
              ) : loadingCourses ? (
                <div className="panel-empty">
                  <p>Searching...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="panel-empty">
                  <p>No courses found</p>
                </div>
              ) : (
                courses.map((course) => (
                  <button
                    key={course.course_id}
                    className={`course-row ${selectedCourse?.course_id === course.course_id ? "active" : ""}`}
                    onClick={() => handleSelectCourse(course)}
                  >
                    <span className="course-badge">CMPT {course.course_number}</span>
                    <span className="course-name">{course.course_title}</span>
                    <svg
                      className="chevron"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="panel panel-middle">
            {!selectedCourse ? (
              <div className="panel-empty full">
                <div className="panel-empty-icon">👈</div>
                <h3>Select a course</h3>
                <p>Pick a course to see its professors and sections.</p>
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <div>
                    <h2>CMPT {selectedCourse.course_number}</h2>
                    <p className="detail-title">{selectedCourse.course_title}</p>
                  </div>
                  <span className="section-count">
                    {offerings.length} section{offerings.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="prof-section">
                  <h3 className="sub-heading">Professors</h3>

                  {loadingOfferings ? (
                    <div className="panel-empty">
                      <p>Loading sections...</p>
                    </div>
                  ) : uniqueProfs.length === 0 ? (
                    <div className="panel-empty">
                      <p>No sections found</p>
                    </div>
                  ) : (
                    <div className="prof-list">
                      {uniqueProfs.map((professor) => (
                        <button
                          key={professor.prof_id}
                          className={`prof-card ${selectedProf?.prof_id === professor.prof_id ? "active" : ""}`}
                          onClick={() =>
                            handleSelectProf(professor.prof_id, professor.prof_name)
                          }
                        >
                          <div className="prof-avatar">
                            {professor.prof_name?.charAt(0)}
                          </div>
                          <div className="prof-info">
                            <div className="prof-name">{professor.prof_name}</div>
                            <div className="prof-meta">
                              {professor.sections.map((section) => (
                                <span key={section.offering_id} className="section-chip">
                                  {section.section_no} · {section.term} {section.year}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="prof-ratings">
                            {professor.rmp_avg_rating && (
                              <span className="rating-badge rmp">
                                {professor.rmp_avg_rating} RMP
                              </span>
                            )}
                            {professor.app_overall_rating && (
                              <span className="rating-badge app">
                                {professor.app_overall_rating} App
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="panel panel-right">
            {!selectedProf ? (
              <div className="panel-empty full">
                <div className="panel-empty-icon">💬</div>
                <h3>Reviews</h3>
                <p>Click a professor to see their ratings and reviews.</p>
              </div>
            ) : loadingProf ? (
              <div className="panel-empty full">
                <p>Loading professor...</p>
              </div>
            ) : (
              <>
                <div className="prof-detail-header">
                  <div className="prof-avatar lg">{selectedProf.prof_name?.charAt(0)}</div>
                  <div>
                    <h3>{selectedProf.prof_name}</h3>
                    {profStats && (
                      <p className="prof-detail-sub">
                        {profStats.rmp_avg_rating && `RMP: ${profStats.rmp_avg_rating}/5`}
                        {profStats.rmp_avg_rating && profStats.app_avg_overall && " · "}
                        {profStats.app_avg_overall && `App: ${profStats.app_avg_overall}/5`}
                        {" · "}
                        {profStats.app_review_count ?? 0} review
                        {profStats.app_review_count !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>

                {profStats && (
                  <div className="stats-row">
                    <div className="stat-box">
                      <div className="stat-num">{profStats.app_avg_overall ?? "-"}</div>
                      <div className="stat-lbl">Overall</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num">{profStats.app_avg_difficulty ?? "-"}</div>
                      <div className="stat-lbl">Difficulty</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num">{profStats.rmp_avg_rating ?? "-"}</div>
                      <div className="stat-lbl">RMP</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num">{profStats.rmp_avg_difficulty ?? "-"}</div>
                      <div className="stat-lbl">RMP Diff</div>
                    </div>
                  </div>
                )}

                <div className="reviews-section">
                  <h4>Reviews ({profReviews.length})</h4>
                  {profReviews.length === 0 ? (
                    <p className="no-reviews">No approved reviews yet.</p>
                  ) : (
                    profReviews.map((review) => (
                      <div key={review.review_id} className="review-card">
                        <div className="review-top">
                          <span className="review-author">
                            {review.student_username || "Anonymous"}
                          </span>
                          {review.overall_rating && (
                            <span className="rating-badge app">
                              {review.overall_rating}/5
                            </span>
                          )}
                          <span className="review-date">
                            {review.created_at
                              ? new Date(review.created_at).toLocaleDateString()
                              : ""}
                          </span>
                        </div>
                        <p className="review-body">{review.review_text}</p>
                        {review.tags && (
                          <div className="review-tags">
                            {review.tags.split(", ").map((tag) => (
                              <span key={tag} className="tag-chip">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {authModalOpen && (
        <div className="modal-backdrop" onClick={() => setAuthModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{authMode === "login" ? "Log In" : "Create Student Account"}</h3>
                <p>
                  {authMode === "login"
                    ? "Students and moderators both log in here."
                    : "Sign up creates a row in user and studentuser."}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAuthModalOpen(false)}
              >
                x
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAuthSubmit}>
              {authMode === "signup" && (
                <label className="field-group">
                  <span>Display Name</span>
                  <input
                    type="text"
                    value={authForm.display_name}
                    onChange={(event) =>
                      setAuthForm((current) => ({
                        ...current,
                        display_name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              )}

              <label className="field-group">
                <span>Email</span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="field-group">
                <span>Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              {authError && <p className="form-error">{authError}</p>}

              {authMode === "signup" && (
                <p className="form-note">
                  ModeratorAdmin accounts are still added manually in the database.
                </p>
              )}

              <div className="modal-actions">
                <button type="submit" className="topbar-button" disabled={authLoading}>
                  {authLoading
                    ? "Working..."
                    : authMode === "login"
                      ? "Log In"
                      : "Sign Up"}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setAuthError("");
                    setAuthMode((current) =>
                      current === "login" ? "signup" : "login",
                    );
                  }}
                >
                  {authMode === "login"
                    ? "Need a student account?"
                    : "Already have an account?"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {profileModalOpen && currentUser && (
        <div className="modal-backdrop" onClick={() => setProfileModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Account Settings</h3>
                <p>
                  Role: {currentUser.role}. Updating edits the shared user record. Deleting
                  removes linked subtype rows and dependent records through cascade rules.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setProfileModalOpen(false)}
              >
                x
              </button>
            </div>

            <form className="modal-form" onSubmit={handleProfileSubmit}>
              <label className="field-group">
                <span>Display Name</span>
                <input
                  type="text"
                  value={profileForm.display_name}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      display_name: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="field-group">
                <span>Email</span>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="field-group">
                <span>New Password</span>
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Leave blank to keep current password"
                />
              </label>

              {profileError && <p className="form-error">{profileError}</p>}
              {profileMessage && <p className="form-success">{profileMessage}</p>}

              <div className="modal-actions profile-actions">
                <button type="submit" className="topbar-button" disabled={profileLoading}>
                  {profileLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={handleDeleteAccount}
                  disabled={profileLoading}
                >
                  Delete Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
