import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import PMPLogo from "./assets/PMPLogo.png";
import {
  cascadeDeleteStudentDemo,
  deleteStudentReview,
  deleteUserAccount,
  fetchCourses,
  fetchProfessorAveragesByCourse,
  fetchPendingReviewCount,
  fetchPendingReviews,
  fetchProfessorReviews,
  fetchProfessorStats,
  fetchSavedItems,
  fetchProfessorsAllTerms,
  fetchStudentReviews,
  fetchModerationHistory,
  loginAccount,
  moderateReview,
  registerAccount,
  removeSavedCourse,
  removeSavedInstructor,
  saveCourse,
  saveInstructor,
  searchOfferings,
  submitStudentReview,
  updateReviewStatusDemo,
  updateStudentReview,
  updateUserAccount,
} from "./api";

const AUTH_STORAGE_KEY = "pickmyprof.currentUser";
const REVIEW_STATUS_STORAGE_KEY = "pickmyprof.reviewStatuses";

function getReviewStatusStorageKey(userId) {
  return `${REVIEW_STATUS_STORAGE_KEY}.${userId}`;
}

function readStoredReviewStatuses(userId) {
  try {
    const raw = window.localStorage.getItem(getReviewStatusStorageKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function storeReviewStatuses(userId, reviews) {
  const statuses = reviews.reduce((accumulator, review) => {
    accumulator[review.review_id] = review.status;
    return accumulator;
  }, {});

  window.localStorage.setItem(
    getReviewStatusStorageKey(userId),
    JSON.stringify(statuses),
  );
}

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed";
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
  const [courseProfessorAverages, setCourseProfessorAverages] = useState([]);
  const [loadingCourseProfessorAverages, setLoadingCourseProfessorAverages] =
    useState(false);
  const [allTermsProfessors, setAllTermsProfessors] = useState([]);
  const [loadingAllTermsProfessors, setLoadingAllTermsProfessors] = useState(false);
  const [courseQueryError, setCourseQueryError] = useState("");

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

  const [savedItems, setSavedItems] = useState({ courses: [], instructors: [] });
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");
  const [savedModalOpen, setSavedModalOpen] = useState(false);

  const [studentReviews, setStudentReviews] = useState([]);
  const [studentReviewsLoading, setStudentReviewsLoading] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    review_text: "",
    overall_score: 4,
    is_anonymous: false,
  });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [queryDemoMessage, setQueryDemoMessage] = useState("");
  const [queryDemoError, setQueryDemoError] = useState("");
  const [queryDemoLoading, setQueryDemoLoading] = useState(false);
  const [reviewNotice, setReviewNotice] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalCourseCode, setReviewModalCourseCode] = useState("");
  const [reviewMode, setReviewMode] = useState("create");
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [myReviewsModalOpen, setMyReviewsModalOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);

  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [moderationModalOpen, setModerationModalOpen] = useState(false);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [moderationHistoryModalOpen, setModerationHistoryModalOpen] = useState(false);
  const [moderationHistory, setModerationHistory] = useState([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationError, setModerationError] = useState("");

  const fullText =
    "Welcome to the one place for SFU schedules, professor insights, and account management.";

  const isStudent = currentUser?.role === "STUDENT";
  const isModerator = currentUser?.role === "MODERATOR";

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

  useEffect(() => {
    if (!reviewNotice) {
      return undefined;
    }

    const timeout = setTimeout(() => setReviewNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [reviewNotice]);

  const loadSavedItems = useCallback(async () => {
    if (!isStudent || !currentUser?.user_id) {
      setSavedItems({ courses: [], instructors: [] });
      setSavedError("");
      return;
    }

    setSavedLoading(true);
    setSavedError("");

    try {
      const data = await fetchSavedItems(currentUser.user_id);
      setSavedItems({
        courses: data.courses || [],
        instructors: data.instructors || [],
      });
    } catch (error) {
      setSavedError(error.message);
    } finally {
      setSavedLoading(false);
    }
  }, [currentUser?.user_id, isStudent]);

  const loadStudentReviews = useCallback(async () => {
    if (!isStudent || !currentUser?.user_id) {
      setStudentReviews([]);
      return;
    }

    setStudentReviewsLoading(true);

    try {
      const data = await fetchStudentReviews(currentUser.user_id);
      setStudentReviews(data);
      const previousStatuses = readStoredReviewStatuses(currentUser.user_id);
      const changedReview = data.find((review) => {
        const previousStatus = previousStatuses[review.review_id];
        return (
          previousStatus === "PENDING" &&
          ["APPROVED", "REJECTED"].includes(review.status)
        );
      });

      if (changedReview) {
        setReviewNotice({
          status: changedReview.status,
          profName: changedReview.prof_name,
          courseCode: changedReview.course_code_raw,
        });
      }

      storeReviewStatuses(currentUser.user_id, data);
    } catch {
      setStudentReviews([]);
    } finally {
      setStudentReviewsLoading(false);
    }
  }, [currentUser?.user_id, isStudent]);

  const loadPendingReviewCount = useCallback(async () => {
    if (!isModerator) {
      setPendingReviewCount(0);
      return;
    }

    try {
      const data = await fetchPendingReviewCount();
      setPendingReviewCount(data.pending_count || 0);
    } catch {
      setPendingReviewCount(0);
    }
  }, [isModerator]);

  useEffect(() => {
    loadSavedItems();
    loadStudentReviews();
    loadPendingReviewCount();
  }, [loadPendingReviewCount, loadSavedItems, loadStudentReviews]);

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
    setCourseQueryError("");
    setCourseProfessorAverages([]);
    setAllTermsProfessors([]);
    setLoadingOfferings(true);
    setLoadingCourseProfessorAverages(true);
    setLoadingAllTermsProfessors(true);

    const [joinResult, groupByResult, divisionResult] = await Promise.allSettled([
      searchOfferings({ search: course.course_number }),
      fetchProfessorAveragesByCourse(course.course_number),
      fetchProfessorsAllTerms(course.course_number),
    ]);

    const errors = [];

    if (joinResult.status === "fulfilled") {
      setOfferings(
        joinResult.value.filter(
          (offering) => String(offering.course_id) === String(course.course_id),
        ),
      );
    } else {
      setOfferings([]);
      errors.push(`Join query failed: ${getErrorMessage(joinResult.reason)}`);
    }

    if (groupByResult.status === "fulfilled") {
      setCourseProfessorAverages(groupByResult.value);
    } else {
      setCourseProfessorAverages([]);
      errors.push(
        `Group-by aggregation failed: ${getErrorMessage(groupByResult.reason)}`,
      );
    }

    if (divisionResult.status === "fulfilled") {
      setAllTermsProfessors(divisionResult.value);
    } else {
      setAllTermsProfessors([]);
      errors.push(`Division query failed: ${getErrorMessage(divisionResult.reason)}`);
    }

    setCourseQueryError(errors.join(" "));
    setLoadingOfferings(false);
    setLoadingCourseProfessorAverages(false);
    setLoadingAllTermsProfessors(false);
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

  const handleOpenSavedCourse = async (course) => {
    setSavedModalOpen(false);
    setSearchTerm(course.course_number);
    await handleSelectCourse(course);
  };

  const handleOpenSavedInstructor = async (instructor) => {
    setSavedModalOpen(false);
    setSearchTerm(instructor.course_number);
    await handleSelectCourse(instructor);
    await handleSelectProf(instructor.prof_id, instructor.prof_name);
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

  const savedCourseIds = useMemo(
    () => new Set(savedItems.courses.map((course) => String(course.course_id))),
    [savedItems.courses],
  );

  const savedInstructorKeys = useMemo(
    () =>
      new Set(
        savedItems.instructors.map(
          (instructor) => `${instructor.course_id}:${instructor.prof_id}`,
        ),
      ),
    [savedItems.instructors],
  );

  const selectedCourseCode = selectedCourse
    ? `CMPT ${selectedCourse.course_number}`
    : "";

  const ownReviewsForSelectedProf = useMemo(() => {
    if (!selectedProf) {
      return [];
    }

    return studentReviews.filter((review) => {
      const sameProfessor = String(review.prof_id) === String(selectedProf.prof_id);
      const sameCourse =
        !selectedCourseCode ||
        !review.course_code_raw ||
        review.course_code_raw === selectedCourseCode;

      return sameProfessor && sameCourse;
    });
  }, [selectedCourseCode, selectedProf, studentReviews]);

  const reviewNotifications = useMemo(
    () =>
      studentReviews.filter((review) =>
        ["APPROVED", "REJECTED"].includes(review.status),
      ),
    [studentReviews],
  );

  const resetWorkspaceState = () => {
    setSearchTerm("");
    setCourses([]);
    setLoadingCourses(false);
    setSelectedCourse(null);
    setOfferings([]);
    setLoadingOfferings(false);
    setCourseProfessorAverages([]);
    setLoadingCourseProfessorAverages(false);
    setPlannedAllStudents([]);
    setLoadingPlannedAllStudents(false);
    setCourseQueryError("");
    setSelectedProf(null);
    setProfStats(null);
    setProfReviews([]);
    setLoadingProf(false);
    setSavedItems({ courses: [], instructors: [] });
    setSavedLoading(false);
    setSavedError("");
    setSavedModalOpen(false);
    setStudentReviews([]);
    setStudentReviewsLoading(false);
    setReviewForm({
      review_text: "",
      overall_score: 4,
      is_anonymous: false,
    });
    setReviewSubmitting(false);
    setReviewError("");
    setReviewMessage("");
    setQueryDemoMessage("");
    setQueryDemoError("");
    setQueryDemoLoading(false);
    setReviewNotice(null);
    setReviewModalOpen(false);
    setReviewModalCourseCode("");
    setReviewMode("create");
    setEditingReviewId(null);
    setMyReviewsModalOpen(false);
    setNotificationsModalOpen(false);
    setPendingReviewCount(0);
    setModerationModalOpen(false);
    setPendingReviews([]);
    setModerationHistoryModalOpen(false);
    setModerationHistory([]);
    setModerationLoading(false);
    setModerationError("");
  };

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

      resetWorkspaceState();
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
      if (currentUser.role === "STUDENT") {
        await cascadeDeleteStudentDemo(currentUser.user_id);
      } else {
        await deleteUserAccount(currentUser.user_id);
      }
      setCurrentUser(null);
      setProfileModalOpen(false);
      resetWorkspaceState();
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const requireStudentLogin = () => {
    if (isStudent && currentUser?.user_id) {
      return true;
    }

    openAuthModal("login");
    return false;
  };

  const handleSaveSelectedCourse = async () => {
    if (!selectedCourse || !requireStudentLogin()) {
      return;
    }

    setSavedError("");
    setSavedLoading(true);

    try {
      const response = await saveCourse(currentUser.user_id, selectedCourse.course_id);
      setSavedItems(response.saved);
    } catch (error) {
      setSavedError(error.message);
    } finally {
      setSavedLoading(false);
    }
  };

  const handleSaveSelectedInstructor = async () => {
    if (!selectedCourse || !selectedProf || !requireStudentLogin()) {
      return;
    }

    setSavedError("");
    setSavedLoading(true);

    try {
      const response = await saveInstructor(
        currentUser.user_id,
        selectedCourse.course_id,
        selectedProf.prof_id,
      );
      setSavedItems(response.saved);
    } catch (error) {
      setSavedError(error.message);
    } finally {
      setSavedLoading(false);
    }
  };

  const handleRemoveSavedCourse = async (courseId) => {
    if (!isStudent || !currentUser?.user_id) {
      return;
    }

    setSavedError("");
    setSavedLoading(true);

    try {
      const response = await removeSavedCourse(currentUser.user_id, courseId);
      setSavedItems(response.saved);
    } catch (error) {
      setSavedError(error.message);
    } finally {
      setSavedLoading(false);
    }
  };

  const handleRemoveSavedInstructor = async (courseId, profId) => {
    if (!isStudent || !currentUser?.user_id) {
      return;
    }

    setSavedError("");
    setSavedLoading(true);

    try {
      const response = await removeSavedInstructor(currentUser.user_id, courseId, profId);
      setSavedItems(response.saved);
    } catch (error) {
      setSavedError(error.message);
    } finally {
      setSavedLoading(false);
    }
  };

  const openCreateReviewModal = () => {
    setReviewMode("create");
    setEditingReviewId(null);
    setReviewModalCourseCode(selectedCourseCode);
    setReviewForm({
      review_text: "",
      overall_score: 4,
      is_anonymous: false,
    });
    setReviewError("");
    setReviewMessage("");
    setMyReviewsModalOpen(false);
    setReviewModalOpen(true);
  };

  const openEditReviewModal = (review) => {
    if (review.status !== "PENDING") {
      return;
    }

    setReviewMode("edit");
    setEditingReviewId(review.review_id);
    setSelectedProf({ prof_id: review.prof_id, prof_name: review.prof_name });
    setReviewModalCourseCode(review.course_code_raw || "");
    setReviewForm({
      review_text: review.review_text || "",
      overall_score: Number(review.overall_rating ?? 4),
      is_anonymous: Boolean(review.is_anonymous),
    });
    setReviewError("");
    setReviewMessage("");
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProf || !requireStudentLogin()) {
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");
    setReviewMessage("");

    try {
      const payload = {
        prof_id: selectedProf.prof_id,
        course_code_raw: reviewMode === "create" ? selectedCourseCode : reviewModalCourseCode,
        review_text: reviewForm.review_text,
        overall_score: reviewForm.overall_score,
        is_anonymous: reviewForm.is_anonymous,
      };

      if (reviewMode === "edit" && editingReviewId) {
        await updateStudentReview(currentUser.user_id, editingReviewId, {
          review_text: payload.review_text,
          overall_score: payload.overall_score,
          is_anonymous: payload.is_anonymous,
        });
        setReviewMessage("Pending review updated.");
      } else {
        await submitStudentReview(currentUser.user_id, payload);
        setReviewMessage("Submitted. Your review is pending moderator approval.");
      }

      setReviewForm({
        review_text: "",
        overall_score: 4,
        is_anonymous: false,
      });
      setReviewMode("create");
      setEditingReviewId(null);
      setReviewModalCourseCode("");
      setReviewModalOpen(false);
      await loadStudentReviews();
    } catch (error) {
      setReviewError(error.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteOwnReview = async (reviewId) => {
    if (!isStudent || !currentUser?.user_id) {
      return;
    }

    setReviewError("");
    setReviewMessage("");

    try {
      await deleteStudentReview(currentUser.user_id, reviewId);
      setReviewMessage("Review deleted.");
      await loadStudentReviews();
      if (selectedProf) {
        const reviews = await fetchProfessorReviews(selectedProf.prof_id);
        setProfReviews(reviews);
      }
    } catch (error) {
      setReviewError(error.message);
    }
  };

  const handleWithdrawPendingReview = async (reviewId) => {
    if (!isStudent || !currentUser?.user_id) {
      return;
    }

    const confirmed = window.confirm(
      "Withdraw this pending review? This uses the update demo endpoint and sets status to HIDDEN.",
    );

    if (!confirmed) {
      return;
    }

    setQueryDemoLoading(true);
    setQueryDemoError("");
    setQueryDemoMessage("");
    setReviewError("");
    setReviewMessage("");

    try {
      const response = await updateReviewStatusDemo(reviewId, "HIDDEN");
      const updatedStatus = response?.after?.status || "HIDDEN";
      setQueryDemoMessage(
        `Update demo completed: review ${reviewId} changed to ${updatedStatus}.`,
      );
      await loadStudentReviews();
      if (selectedProf) {
        const reviews = await fetchProfessorReviews(selectedProf.prof_id);
        setProfReviews(reviews);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setQueryDemoError(message);
    } finally {
      setQueryDemoLoading(false);
    }
  };

  const loadPendingReviews = async () => {
    if (!isModerator) {
      return;
    }

    setModerationLoading(true);
    setModerationError("");

    try {
      const data = await fetchPendingReviews();
      setPendingReviews(data);
    } catch (error) {
      setModerationError(error.message);
      setPendingReviews([]);
    } finally {
      setModerationLoading(false);
    }
  };

  const handleOpenModeration = async () => {
    setModerationModalOpen(true);
    await loadPendingReviews();
  };

  const handleOpenModerationHistory = async () => {
    if (!isModerator || !currentUser?.user_id) {
      return;
    }

    setModerationHistoryModalOpen(true);
    setModerationLoading(true);
    setModerationError("");

    try {
      const data = await fetchModerationHistory(currentUser.user_id);
      setModerationHistory(data);
    } catch (error) {
      setModerationHistory([]);
      setModerationError(error.message);
    } finally {
      setModerationLoading(false);
    }
  };

  const handleModerateReview = async (reviewId, actionTaken) => {
    if (!isModerator || !currentUser?.user_id) {
      return;
    }

    setModerationLoading(true);
    setModerationError("");

    try {
      await moderateReview(reviewId, {
        moderator_id: currentUser.user_id,
        action_taken: actionTaken,
      });
      await loadPendingReviews();
      await loadPendingReviewCount();
      if (moderationHistoryModalOpen) {
        const history = await fetchModerationHistory(currentUser.user_id);
        setModerationHistory(history);
      }
      if (selectedProf) {
        const reviews = await fetchProfessorReviews(selectedProf.prof_id);
        setProfReviews(reviews);
      }
    } catch (error) {
      setModerationError(error.message);
    } finally {
      setModerationLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setProfileModalOpen(false);
    setProfileError("");
    setProfileMessage("");
    resetWorkspaceState();
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

      {reviewNotice && (
        <div className={`review-toast ${reviewNotice.status.toLowerCase()}`}>
          <strong>
            Review {reviewNotice.status === "APPROVED" ? "accepted" : "rejected"}
          </strong>
          <p>
            {reviewNotice.courseCode ? `${reviewNotice.courseCode} ` : ""}
            {reviewNotice.profName ? `with ${reviewNotice.profName}` : ""}
            {reviewNotice.status === "APPROVED"
              ? " is now public."
              : " was not approved."}
          </p>
        </div>
      )}

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
                {isStudent && (
                  <>
                    <button
                      type="button"
                      className="topbar-button light"
                      onClick={() => setSavedModalOpen(true)}
                    >
                      Saved
                    </button>
                    <button
                      type="button"
                      className="topbar-button notification-button"
                      onClick={() => setNotificationsModalOpen(true)}
                    >
                      Review Updates
                      <span>{reviewNotifications.length}</span>
                    </button>
                    <button
                      type="button"
                      className="topbar-button light"
                      onClick={() => setMyReviewsModalOpen(true)}
                    >
                      My Reviews
                    </button>
                  </>
                )}
                {isModerator && (
                  <>
                    <button
                      type="button"
                      className="topbar-button moderator-alert"
                      onClick={handleOpenModeration}
                    >
                      Reviews Pending
                      <span>{pendingReviewCount}</span>
                    </button>
                    <button
                      type="button"
                      className="topbar-button light"
                      onClick={handleOpenModerationHistory}
                    >
                      History
                    </button>
                  </>
                )}
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
                  <div className="detail-actions">
                    <span className="section-count">
                      {offerings.length} section{offerings.length !== 1 ? "s" : ""}
                    </span>
                    {!isModerator && (
                      <button
                        type="button"
                        className="save-action"
                        onClick={handleSaveSelectedCourse}
                        disabled={
                          savedLoading ||
                          savedCourseIds.has(String(selectedCourse.course_id))
                        }
                      >
                        {savedCourseIds.has(String(selectedCourse.course_id))
                          ? "Saved"
                          : "Save Course"}
                      </button>
                    )}
                  </div>
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

                <div className="query-demo-stack">
                  <article className="query-demo-card">
                    <h3 className="sub-heading">Top Professors</h3>
                    {loadingCourseProfessorAverages ? (
                      <p className="no-reviews">Loading professor averages...</p>
                    ) : courseProfessorAverages.length === 0 ? (
                      <p className="no-reviews">No averages found for this course.</p>
                    ) : (
                      <div className="query-demo-list">
                        {courseProfessorAverages.slice(0, 5).map((row) => (
                          <div
                            key={`${row.course_id}-${row.prof_id}`}
                            className="query-demo-row"
                          >
                            <strong>{row.prof_name}</strong>
                            <span>
                              Avg {row.app_avg_overall ?? "-"} / 5 ({row.app_review_count}{" "}
                              reviews)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>

                  <article className="query-demo-card">
                    <h3 className="sub-heading">Professors in All Terms (2025)</h3>
                    {loadingAllTermsProfessors ? (
                      <p className="no-reviews">Loading...</p>
                    ) : allTermsProfessors.length === 0 ? (
                      <p className="no-reviews">No professors taught all three terms in 2025.</p>
                    ) : (
                      <>
                        <p className="query-demo-note">
                          {allTermsProfessors.length} professor
                          {allTermsProfessors.length !== 1 ? "s" : ""} taught Spring, Summer &amp; Fall 2025.
                        </p>
                        <div className="query-demo-list">
                          {allTermsProfessors.slice(0, 5).map((prof) => (
                            <div key={prof.prof_id} className="query-demo-row">
                              <strong>{prof.prof_name}</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </article>

                  {courseQueryError && <p className="form-error">{courseQueryError}</p>}
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
                  {!isModerator && selectedCourse && (
                    <button
                      type="button"
                      className="save-action prof-save"
                      onClick={handleSaveSelectedInstructor}
                      disabled={
                        savedLoading ||
                        savedInstructorKeys.has(
                          `${selectedCourse.course_id}:${selectedProf.prof_id}`,
                        )
                      }
                    >
                      {savedInstructorKeys.has(
                        `${selectedCourse.course_id}:${selectedProf.prof_id}`,
                      )
                        ? "Saved"
                        : "Save Instructor"}
                    </button>
                  )}
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
                  {isStudent ? (
                    <div className="review-action-bar">
                      <div>
                        <h4>Reviews ({profReviews.length})</h4>
                        <p>Read what students said, or add your own after taking it.</p>
                      </div>
                      <button
                        type="button"
                        className="topbar-button composer-button"
                        onClick={openCreateReviewModal}
                      >
                        Write a Review
                      </button>
                    </div>
                  ) : !currentUser ? (
                    <div className="review-action-bar">
                      <div>
                        <h4>Reviews ({profReviews.length})</h4>
                        <p>Log in as a student to write a review.</p>
                      </div>
                      <button
                        type="button"
                        className="topbar-button composer-button"
                        onClick={() => openAuthModal("login")}
                      >
                        Log In
                      </button>
                    </div>
                  ) : (
                    <div className="review-action-bar">
                      <div>
                        <h4>Reviews ({profReviews.length})</h4>
                        <p>Moderator accounts can review submissions from the top bar.</p>
                      </div>
                    </div>
                  )}

                  {reviewError && !reviewModalOpen && <p className="form-error">{reviewError}</p>}
                  {reviewMessage && !reviewModalOpen && (
                    <p className="form-success compact-success">{reviewMessage}</p>
                  )}
                  {queryDemoError && !reviewModalOpen && (
                    <p className="form-error">{queryDemoError}</p>
                  )}
                  {queryDemoMessage && !reviewModalOpen && (
                    <p className="form-success compact-success">{queryDemoMessage}</p>
                  )}

                  {isStudent && (
                    <div className="own-review-list">
                      <h4>Your Submissions</h4>
                      {studentReviewsLoading ? (
                        <p className="no-reviews">Loading your review statuses...</p>
                      ) : ownReviewsForSelectedProf.length === 0 ? (
                        <p className="no-reviews">
                          You have not submitted a review for this instructor yet.
                        </p>
                      ) : (
                        ownReviewsForSelectedProf.map((review) => (
                          <div key={review.review_id} className="review-card own-review">
                            <div className="review-top">
                              <span className={`status-pill ${String(review.status || "").toLowerCase()}`}>
                                {review.status === "APPROVED"
                                  ? "Accepted"
                                  : review.status === "REJECTED"
                                    ? "Rejected"
                                    : "Pending approval"}
                              </span>
                              <span className="review-date">
                                {review.created_at
                                  ? new Date(review.created_at).toLocaleDateString()
                                  : ""}
                              </span>
                            </div>
                            <p className="review-body">{review.review_text}</p>
                            <p className="review-visibility">
                              Posted as {review.is_anonymous ? "Anonymous" : "your name"}
                            </p>
                            <div className="review-card-actions">
                              {review.status === "PENDING" && (
                                <>
                                  <button
                                    type="button"
                                    className="saved-remove inline-remove"
                                    onClick={() => openEditReviewModal(review)}
                                  >
                                    Edit Review
                                  </button>
                                  <button
                                    type="button"
                                    className="saved-remove inline-remove"
                                    onClick={() =>
                                      handleWithdrawPendingReview(review.review_id)
                                    }
                                    disabled={queryDemoLoading}
                                  >
                                    {queryDemoLoading ? "Updating..." : "Withdraw (Update Demo)"}
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="saved-remove inline-remove"
                                onClick={() => handleDeleteOwnReview(review.review_id)}
                              >
                                Delete Review
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

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
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {reviewModalOpen && isStudent && selectedProf && (
        <div className="modal-backdrop" onClick={() => setReviewModalOpen(false)}>
          <div
            className="modal-card review-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>{reviewMode === "edit" ? "Edit Pending Review" : "Write a Review"}</h3>
                <p>
                  {reviewModalCourseCode ? `${reviewModalCourseCode} with ` : ""}
                  {selectedProf.prof_name}. It stays pending until a moderator approves it.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setReviewModalOpen(false)}
              >
                x
              </button>
            </div>

            <form className="modal-form review-composer" onSubmit={handleReviewSubmit}>
              <textarea
                value={reviewForm.review_text}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    review_text: event.target.value,
                  }))
                }
                placeholder={`How was ${selectedProf.prof_name} for ${reviewModalCourseCode || "this course"}?`}
                minLength={8}
                required
              />
              <div className="rating-slider-card">
                <div className="rating-slider-head">
                  <span>Overall Rating</span>
                  <strong>{Number(reviewForm.overall_score).toFixed(1)}/5</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={reviewForm.overall_score}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      overall_score: Number(event.target.value),
                    }))
                  }
                  aria-label="Overall rating out of 5"
                />
                <div className="rating-scale">
                  <span>0</span>
                  <span>2.5</span>
                  <span>5</span>
                </div>
              </div>
              <label className="anonymous-toggle">
                <input
                  type="checkbox"
                  checked={reviewForm.is_anonymous}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      is_anonymous: event.target.checked,
                    }))
                  }
                />
                <span>
                  Post as Anonymous
                  <small>
                    Moderators can still review it, but students will not see your name.
                  </small>
                </span>
              </label>
              {reviewError && <p className="form-error">{reviewError}</p>}
              <div className="modal-actions">
                <button
                  type="submit"
                  className="topbar-button composer-button"
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting
                    ? "Saving..."
                    : reviewMode === "edit"
                      ? "Save Pending Review"
                      : "Submit for Approval"}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setReviewModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {savedModalOpen && isStudent && (
        <div className="modal-backdrop" onClick={() => setSavedModalOpen(false)}>
          <div
            className="modal-card saved-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>Saved</h3>
                <p>Open saved courses and instructors from here.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSavedModalOpen(false)}
              >
                x
              </button>
            </div>

            <div className="saved-modal-body">
              {savedLoading && <p className="no-reviews">Syncing saved items...</p>}
              {savedError && <p className="form-error">{savedError}</p>}
              {savedItems.courses.length === 0 &&
              savedItems.instructors.length === 0 ? (
                <p className="saved-empty">Nothing saved yet.</p>
              ) : (
                <div className="saved-list">
                  {savedItems.courses.map((course) => (
                    <div key={`course-${course.course_id}`} className="saved-item">
                      <button
                        type="button"
                        className="saved-item-main"
                        onClick={() => handleOpenSavedCourse(course)}
                      >
                        <span className="saved-kicker">Course</span>
                        <strong>CMPT {course.course_number}</strong>
                        <p>{course.course_title}</p>
                      </button>
                      <button
                        type="button"
                        className="saved-remove"
                        onClick={() => handleRemoveSavedCourse(course.course_id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {savedItems.instructors.map((instructor) => (
                    <div
                      key={`instructor-${instructor.course_id}-${instructor.prof_id}`}
                      className="saved-item"
                    >
                      <button
                        type="button"
                        className="saved-item-main"
                        onClick={() => handleOpenSavedInstructor(instructor)}
                      >
                        <span className="saved-kicker">Instructor</span>
                        <strong>{instructor.prof_name}</strong>
                        <p>CMPT {instructor.course_number} - {instructor.course_title}</p>
                      </button>
                      <button
                        type="button"
                        className="saved-remove"
                        onClick={() =>
                          handleRemoveSavedInstructor(
                            instructor.course_id,
                            instructor.prof_id,
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {myReviewsModalOpen && isStudent && (
        <div className="modal-backdrop" onClick={() => setMyReviewsModalOpen(false)}>
          <div
            className="modal-card review-list-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>My Reviews</h3>
                <p>Track every review you submitted and edit pending ones.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setMyReviewsModalOpen(false)}
              >
                x
              </button>
            </div>

            <div className="review-management-list">
              {studentReviewsLoading ? (
                <p className="no-reviews">Loading your reviews...</p>
              ) : studentReviews.length === 0 ? (
                <p className="no-reviews">You have not submitted any reviews yet.</p>
              ) : (
                studentReviews.map((review) => (
                  <article key={review.review_id} className="managed-review-card">
                    <div className="managed-review-head">
                      <div>
                        <strong>{review.prof_name || "Unknown instructor"}</strong>
                        <p>{review.course_code_raw || "Course not specified"}</p>
                      </div>
                      <span className={`status-pill ${String(review.status || "").toLowerCase()}`}>
                        {review.status === "APPROVED"
                          ? "Accepted"
                          : review.status === "REJECTED"
                            ? "Rejected"
                            : "Pending"}
                      </span>
                    </div>
                    <p className="review-body">{review.review_text}</p>
                    <div className="managed-review-meta">
                      <span>{review.overall_rating ?? "-"} / 5</span>
                      <span>{review.is_anonymous ? "Anonymous" : "Name shown"}</span>
                      <span>
                        {review.created_at
                          ? new Date(review.created_at).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <div className="review-card-actions">
                      {review.status === "PENDING" && (
                        <button
                          type="button"
                          className="topbar-button small-action"
                          onClick={() => openEditReviewModal(review)}
                        >
                          Edit Pending
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger-button reject-button"
                        onClick={() => handleDeleteOwnReview(review.review_id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {notificationsModalOpen && isStudent && (
        <div className="modal-backdrop" onClick={() => setNotificationsModalOpen(false)}>
          <div
            className="modal-card review-list-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>Review Updates</h3>
                <p>Accepted and rejected review decisions from moderators.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setNotificationsModalOpen(false)}
              >
                x
              </button>
            </div>

            <div className="review-management-list">
              {reviewNotifications.length === 0 ? (
                <p className="no-reviews">No accepted or rejected review updates yet.</p>
              ) : (
                reviewNotifications.map((review) => (
                  <article key={review.review_id} className="notification-row">
                    <span className={`status-pill ${String(review.status || "").toLowerCase()}`}>
                      {review.status === "APPROVED" ? "Accepted" : "Rejected"}
                    </span>
                    <div>
                      <strong>{review.prof_name || "Unknown instructor"}</strong>
                      <p>
                        {review.course_code_raw || "Course not specified"} -{" "}
                        {review.status === "APPROVED"
                          ? "Your review is now public."
                          : "Your review was not approved."}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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

      {moderationModalOpen && isModerator && (
        <div className="modal-backdrop" onClick={() => setModerationModalOpen(false)}>
          <div
            className="modal-card moderation-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>Pending Reviews</h3>
                <p>Accepting a review makes it public. Rejecting keeps it hidden.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModerationModalOpen(false)}
              >
                x
              </button>
            </div>

            <div className="moderation-body">
              {moderationError && <p className="form-error">{moderationError}</p>}
              {moderationLoading && pendingReviews.length === 0 ? (
                <p className="no-reviews">Loading pending reviews...</p>
              ) : pendingReviews.length === 0 ? (
                <p className="no-reviews">No pending reviews right now.</p>
              ) : (
                pendingReviews.map((review) => (
                  <article key={review.review_id} className="moderation-review">
                    <div className="moderation-meta">
                      <strong>{review.student_username || "Student"}</strong>
                      <span>{review.prof_name || "Unknown instructor"}</span>
                      <span>{review.course_code_raw || "Course not specified"}</span>
                      <span>
                        {review.created_at
                          ? new Date(review.created_at).toLocaleString()
                          : ""}
                      </span>
                    </div>
                    <p>{review.review_text}</p>
                    <div className="moderation-actions">
                      <button
                        type="button"
                        className="topbar-button accept-button"
                        onClick={() => handleModerateReview(review.review_id, "APPROVED")}
                        disabled={moderationLoading}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="danger-button reject-button"
                        onClick={() => handleModerateReview(review.review_id, "REJECTED")}
                        disabled={moderationLoading}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {moderationHistoryModalOpen && isModerator && (
        <div
          className="modal-backdrop"
          onClick={() => setModerationHistoryModalOpen(false)}
        >
          <div
            className="modal-card moderation-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>Moderation History</h3>
                <p>Recent accepted, rejected, and changed review decisions.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModerationHistoryModalOpen(false)}
              >
                x
              </button>
            </div>

            <div className="moderation-body">
              {moderationError && <p className="form-error">{moderationError}</p>}
              {moderationLoading && moderationHistory.length === 0 ? (
                <p className="no-reviews">Loading moderation history...</p>
              ) : moderationHistory.length === 0 ? (
                <p className="no-reviews">No moderation actions recorded yet.</p>
              ) : (
                moderationHistory.map((entry) => (
                  <article key={entry.moderation_id} className="moderation-review">
                    <div className="moderation-meta">
                      <strong>{entry.action_taken}</strong>
                      <span>{entry.prof_name || "Unknown instructor"}</span>
                      <span>{entry.course_code_raw || "Course not specified"}</span>
                      <span>{entry.student_username || "Student"}</span>
                      <span>
                        {entry.action_time
                          ? new Date(entry.action_time).toLocaleString()
                          : ""}
                      </span>
                    </div>
                    <p>{entry.review_text}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
