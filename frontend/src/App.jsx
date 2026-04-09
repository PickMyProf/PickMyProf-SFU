import { useEffect, useState, useCallback } from "react";
import "./App.css";
import PMPLogo from "./assets/PMPLogo.png";
import { fetchCourses, searchOfferings, fetchProfessorStats, fetchProfessorReviews } from "./api";

function App() {
  const [fadeOut, setFadeOut] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [activeDot, setActiveDot] = useState(0);

  // Course search
  const [searchTerm, setSearchTerm] = useState("");
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Selected course → offerings
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);

  // Selected professor → details + reviews
  const [selectedProf, setSelectedProf] = useState(null);
  const [profStats, setProfStats] = useState(null);
  const [profReviews, setProfReviews] = useState([]);
  const [loadingProf, setLoadingProf] = useState(false);

  const fullText =
    "Welcome to the one place for SFU schedules and professor insights.";

  // Splash animation
  useEffect(() => {
    let index = 0;
    const startDelay = setTimeout(() => {
      const typingInterval = setInterval(() => {
        setTypedText(fullText.slice(0, index + 1));
        index++;
        if (index === fullText.length) clearInterval(typingInterval);
      }, 38);
    }, 1100);
    const dotInterval = setInterval(() => setActiveDot((d) => (d + 1) % 3), 900);
    const fadeTimer = setTimeout(() => setFadeOut(true), 4400);
    const showHomeTimer = setTimeout(() => setShowHome(true), 5200);
    return () => {
      clearTimeout(startDelay);
      clearInterval(dotInterval);
      clearTimeout(fadeTimer);
      clearTimeout(showHomeTimer);
    };
  }, []);

  // Search courses from backend (debounced)
  const loadCourses = useCallback(async () => {
    if (!searchTerm.trim()) { setCourses([]); return; }
    setLoadingCourses(true);
    try {
      const data = await fetchCourses(searchTerm);
      setCourses(data);
    } catch { setCourses([]); }
    finally { setLoadingCourses(false); }
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(loadCourses, 300);
    return () => clearTimeout(t);
  }, [loadCourses]);

  // When a course is selected, fetch its offerings
  const handleSelectCourse = async (course) => {
    setSelectedCourse(course);
    setSelectedProf(null);
    setProfStats(null);
    setProfReviews([]);
    setLoadingOfferings(true);
    try {
      const data = await searchOfferings({ search: course.course_number });
      setOfferings(data.filter((o) => String(o.course_id) === String(course.course_id)));
    } catch { setOfferings([]); }
    finally { setLoadingOfferings(false); }
  };

  // When a professor is clicked, fetch their stats + reviews
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
    } catch { setProfStats(null); setProfReviews([]); }
    finally { setLoadingProf(false); }
  };

  // Get unique professors from offerings
  const uniqueProfs = selectedCourse
    ? Object.values(
        offerings.reduce((acc, o) => {
          if (!acc[o.prof_id]) {
            acc[o.prof_id] = {
              prof_id: o.prof_id,
              prof_name: o.prof_name,
              rmp_avg_rating: o.rmp_avg_rating,
              rmp_avg_difficulty: o.rmp_avg_difficulty,
              app_overall_rating: o.app_overall_rating,
              app_review_count: o.app_review_count,
              sections: [],
            };
          }
          acc[o.prof_id].sections.push(o);
          return acc;
        }, {})
      )
    : [];

  return (
    <div className="app-root">
      {/* ── Splash Screen ── */}
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
          {[0, 1, 2].map((i) => (
            <span key={i} className={activeDot === i ? "active" : ""} />
          ))}
        </div>
      </div>

      {/* ── Main App ── */}
      <main className={`home-page ${showHome ? "show" : ""}`}>
        {/* Navbar */}
        <header className="topbar">
          <div className="topbar-brand">
            <img src={PMPLogo} alt="Logo" className="topbar-logo" />
            <span>PickMyProf SFU</span>
          </div>
        </header>

        {/* 3-Panel Layout: Search | Professors | Reviews */}
        <div className="panels">
          {/* ─── LEFT (1/3): Course Search ─── */}
          <div className="panel panel-left">
            <div className="panel-header">
              <h2>Search Courses</h2>
            </div>
            <div className="search-input-wrap">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                className="search-input"
                placeholder="e.g. 120, Data Structures, CMPT 225…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setSelectedCourse(null); setSelectedProf(null); }}
              />
            </div>

            <div className="course-list">
              {!searchTerm.trim() ? (
                <div className="panel-empty">
                  <div className="panel-empty-icon">📚</div>
                  <p>Type a course number or title to get started</p>
                </div>
              ) : loadingCourses ? (
                <div className="panel-empty"><p>Searching…</p></div>
              ) : courses.length === 0 ? (
                <div className="panel-empty"><p>No courses found</p></div>
              ) : (
                courses.map((c) => (
                  <button
                    key={c.course_id}
                    className={`course-row ${selectedCourse?.course_id === c.course_id ? "active" : ""}`}
                    onClick={() => handleSelectCourse(c)}
                  >
                    <span className="course-badge">CMPT {c.course_number}</span>
                    <span className="course-name">{c.course_title}</span>
                    <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ─── MIDDLE (1/3): Professors & Sections ─── */}
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
                    <div className="panel-empty"><p>Loading sections…</p></div>
                  ) : uniqueProfs.length === 0 ? (
                    <div className="panel-empty"><p>No sections found</p></div>
                  ) : (
                    <div className="prof-list">
                      {uniqueProfs.map((p) => (
                        <button
                          key={p.prof_id}
                          className={`prof-card ${selectedProf?.prof_id === p.prof_id ? "active" : ""}`}
                          onClick={() => handleSelectProf(p.prof_id, p.prof_name)}
                        >
                          <div className="prof-avatar">{p.prof_name?.charAt(0)}</div>
                          <div className="prof-info">
                            <div className="prof-name">{p.prof_name}</div>
                            <div className="prof-meta">
                              {p.sections.map((s) => (
                                <span key={s.offering_id} className="section-chip">
                                  {s.section_no} · {s.term} {s.year}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="prof-ratings">
                            {p.rmp_avg_rating && (
                              <span className="rating-badge rmp">{p.rmp_avg_rating} RMP</span>
                            )}
                            {p.app_overall_rating && (
                              <span className="rating-badge app">{p.app_overall_rating} App</span>
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

          {/* ─── RIGHT (1/3): Reviews ─── */}
          <div className="panel panel-right">
            {!selectedProf ? (
              <div className="panel-empty full">
                <div className="panel-empty-icon">💬</div>
                <h3>Reviews</h3>
                <p>Click a professor to see their ratings and reviews.</p>
              </div>
            ) : loadingProf ? (
              <div className="panel-empty full"><p>Loading professor…</p></div>
            ) : (
              <>
                {/* Professor header */}
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
                        {profStats.app_review_count ?? 0} review{profStats.app_review_count !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                {profStats && (
                  <div className="stats-row">
                    <div className="stat-box">
                      <div className="stat-num">{profStats.app_avg_overall ?? "—"}</div>
                      <div className="stat-lbl">Overall</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num">{profStats.app_avg_difficulty ?? "—"}</div>
                      <div className="stat-lbl">Difficulty</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num">{profStats.rmp_avg_rating ?? "—"}</div>
                      <div className="stat-lbl">RMP</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num">{profStats.rmp_avg_difficulty ?? "—"}</div>
                      <div className="stat-lbl">RMP Diff</div>
                    </div>
                  </div>
                )}

                {/* Reviews list */}
                <div className="reviews-section">
                  <h4>Reviews ({profReviews.length})</h4>
                  {profReviews.length === 0 ? (
                    <p className="no-reviews">No approved reviews yet.</p>
                  ) : (
                    profReviews.map((r) => (
                      <div key={r.review_id} className="review-card">
                        <div className="review-top">
                          <span className="review-author">{r.student_username || "Anonymous"}</span>
                          {r.overall_rating && <span className="rating-badge app">{r.overall_rating}/5</span>}
                          <span className="review-date">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <p className="review-body">{r.review_text}</p>
                        {r.tags && (
                          <div className="review-tags">
                            {r.tags.split(", ").map((t) => (
                              <span key={t} className="tag-chip">{t}</span>
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
    </div>
  );
}

export default App;