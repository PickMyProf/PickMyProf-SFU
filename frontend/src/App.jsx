import { useEffect, useMemo, useState } from "react";
import "./App.css";
import PMPLogo from "./assets/PMPLogo.png";

function App() {
  const [fadeOut, setFadeOut] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [activeDot, setActiveDot] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("All");
  const [selectedMode, setSelectedMode] = useState("All");

  const fullText =
    "Welcome to the one place for SFU schedules and professor insights.";

  const courses = [
    {
      id: 1,
      courseNumber: "CMPT 120",
      courseTitle: "Introduction to Computing Science and Programming I",
      year: 2025,
      term: "Spring",
      section: "D100",
      deliveryMode: "In Person",
      professor: "Brian Fraser",
      rating: 4.5,
      tags: ["clear explanations", "helpful"],
    },
    {
      id: 2,
      courseNumber: "CMPT 125",
      courseTitle: "Introduction to Computing Science and Programming II",
      year: 2025,
      term: "Spring",
      section: "D200",
      deliveryMode: "In Person",
      professor: "Geoffrey Tien",
      rating: 4.0,
      tags: ["tough grader"],
    },
    {
      id: 3,
      courseNumber: "CMPT 225",
      courseTitle: "Data Structures and Programming",
      year: 2025,
      term: "Summer",
      section: "D100",
      deliveryMode: "Online",
      professor: "Manolis Savva",
      rating: 4.3,
      tags: ["organized"],
    },
    {
      id: 4,
      courseNumber: "CMPT 276",
      courseTitle: "Introduction to Software Engineering",
      year: 2025,
      term: "Fall",
      section: "D100",
      deliveryMode: "In Person",
      professor: "Parmit Chilana",
      rating: 4.8,
      tags: ["helpful"],
    },
    {
      id: 5,
      courseNumber: "CMPT 307",
      courseTitle: "Data Structures and Algorithms",
      year: 2026,
      term: "Spring",
      section: "D100",
      deliveryMode: "Hybrid",
      professor: "TBA",
      rating: 3.7,
      tags: ["exam heavy"],
    },
  ];

  useEffect(() => {
    let index = 0;

    const startDelay = setTimeout(() => {
      const typingInterval = setInterval(() => {
        setTypedText(fullText.slice(0, index + 1));
        index++;
        if (index === fullText.length) {
          clearInterval(typingInterval);
        }
      }, 38);
    }, 1100);

    const dotInterval = setInterval(() => {
      setActiveDot((d) => (d + 1) % 3);
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

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        course.courseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.professor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.term.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTerm =
        selectedTerm === "All" || course.term === selectedTerm;

      const matchesMode =
        selectedMode === "All" || course.deliveryMode === selectedMode;

      return matchesSearch && matchesTerm && matchesMode;
    });
  }, [searchTerm, selectedTerm, selectedMode]);

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
          {[0, 1, 2].map((i) => (
            <span key={i} className={activeDot === i ? "active" : ""} />
          ))}
        </div>
      </div>

      <main className={`home-page ${showHome ? "show" : ""}`}>
        <section className="hero-section">
          <div className="hero-text">
            <h1>PickMyProf SFU</h1>
            <p className="hero-description">
              Browse SFU course offerings with professor insights, ratings, tags,
              and section details all in one place.
            </p>
          </div>

          <div className="hero-search-card">
            <h2>Find a course section</h2>
            <input
              type="text"
              placeholder="Search course, professor, or term"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="filter-row">
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
              >
                <option value="All">All Terms</option>
                <option value="Spring">Spring</option>
                <option value="Summer">Summer</option>
                <option value="Fall">Fall</option>
              </select>

              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
              >
                <option value="All">All Modes</option>
                <option value="In Person">In Person</option>
                <option value="Online">Online</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
          </div>
        </section>

        <section className="query-box">
          <h3>Meaningful Query Example</h3>
          <p>
            Showing section offerings filtered by term, delivery mode, and search
            keyword, along with professor and rating information.
          </p>
        </section>

        <section className="results-section">
          <div className="results-top">
            <h2>Course Offerings</h2>
            <span>{filteredCourses.length} result(s)</span>
          </div>

          <div className="course-grid">
            {filteredCourses.length > 0 ? (
              filteredCourses.map((course) => (
                <div className="course-card" key={course.id}>
                  <div className="card-header">
                    <div>
                      <h3>{course.courseNumber}</h3>
                      <p className="course-title">{course.courseTitle}</p>
                    </div>
                    <div className="rating-pill">{course.rating}/5</div>
                  </div>

                  <div className="card-details">
                    <p>
                      <strong>Professor:</strong> {course.professor}
                    </p>
                    <p>
                      <strong>Section:</strong> {course.section}
                    </p>
                    <p>
                      <strong>Term:</strong> {course.term} {course.year}
                    </p>
                    <p>
                      <strong>Delivery:</strong> {course.deliveryMode}
                    </p>
                  </div>

                  <div className="tag-list">
                    {course.tags.map((tag, index) => (
                      <span className="tag" key={index}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="card-buttons">
                    <button className="secondary-btn">View Details</button>
                    <button className="primary-btn">Add to Plan</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <h3>No matching courses found</h3>
                <p>Try changing the search text or filters.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;