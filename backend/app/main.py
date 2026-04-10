from typing import List, Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.database import get_connection

app = FastAPI(title="PickMyProf API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_seed_running = False
_external_seed_running = False
OVERALL_CRITERION_ID = 1
ACCOUNT_ROLE_STUDENT = "STUDENT"
ACCOUNT_ROLE_MODERATOR = "MODERATOR"


# =========================================================
# Keep existing routes
# =========================================================

@app.get("/")
def root():
    return {"message": "PickMyProf backend is running on port 8000"}


@app.on_event("startup")
def startup_tasks():
    ensure_cascade_constraints()


@app.get("/debug/columns/{table}")
def debug_columns(table: str):
    allowed = {"review", "studentuser", "ratingscore", "ratingcriterion", "tag", "tagged_with"}
    if table not in allowed:
        raise HTTPException(400, "not allowed")
    return fetch_all(f"SHOW COLUMNS FROM `{table}`", ())


@app.get("/health/db")
def health_db():
    try:
        conn = get_connection()
        conn.close()
        return {"status": "ok", "db": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/admin/seed")
def seed_database(background_tasks: BackgroundTasks):
    global _seed_running

    if _seed_running:
        raise HTTPException(status_code=409, detail="Official seed already in progress.")

    def _run():
        global _seed_running
        _seed_running = True
        try:
            from app.seed import run_seed
            run_seed()
        finally:
            _seed_running = False

    background_tasks.add_task(_run)
    return {"message": "Official SFU seed started."}


@app.post("/admin/seed/external")
def seed_external(background_tasks: BackgroundTasks):
    global _external_seed_running

    if _external_seed_running:
        raise HTTPException(status_code=409, detail="External seed already in progress.")

    def _run():
        global _external_seed_running
        _external_seed_running = True
        try:
            from app.seed_external import run_external_seed
            run_external_seed()
        finally:
            _external_seed_running = False

    background_tasks.add_task(_run)
    return {"message": "External scraped-data seed started."}


# =========================================================
# DB helpers
# =========================================================

def fetch_all(sql: str, params: tuple = ()):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(sql, params)
        return cursor.fetchall()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        cursor.close()
        conn.close()



def fetch_one(sql: str, params: tuple = ()):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(sql, params)
        return cursor.fetchone()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        cursor.close()
        conn.close()



def execute_write(sql: str, params: tuple = ()):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(sql, params)
        conn.commit()
        return cursor.lastrowid
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        cursor.close()
        conn.close()


def fetch_account_by_user_id(user_id: int):
    return fetch_one(
        """
        SELECT
            u.user_id,
            u.email,
            u.display_name,
            CASE
                WHEN s.user_id IS NOT NULL THEN %s
                WHEN m.user_id IS NOT NULL THEN %s
                ELSE NULL
            END AS role
        FROM user u
        LEFT JOIN studentuser s ON s.user_id = u.user_id
        LEFT JOIN moderatoradmin m ON m.user_id = u.user_id
        WHERE u.user_id = %s
        """,
        (ACCOUNT_ROLE_STUDENT, ACCOUNT_ROLE_MODERATOR, user_id),
    )


def fetch_account_by_credentials(email: str, password: str):
    return fetch_one(
        """
        SELECT
            u.user_id,
            u.email,
            u.display_name,
            CASE
                WHEN s.user_id IS NOT NULL THEN %s
                WHEN m.user_id IS NOT NULL THEN %s
                ELSE NULL
            END AS role
        FROM user u
        LEFT JOIN studentuser s ON s.user_id = u.user_id
        LEFT JOIN moderatoradmin m ON m.user_id = u.user_id
        WHERE u.email = %s AND u.password_hash = %s
        """,
        (ACCOUNT_ROLE_STUDENT, ACCOUNT_ROLE_MODERATOR, email, password),
    )


def ensure_cascade_constraints():
    constraints = [
        ("studentuser", "fk_studentuser_user", "user_id", "user", "user_id"),
        ("moderatoradmin", "fk_moderatoradmin_user", "user_id", "user", "user_id"),
        ("plans", "fk_plans_studentuser", "studentuser_id", "studentuser", "user_id"),
        ("review", "fk_review_studentuser", "studentuser_id", "studentuser", "user_id"),
        ("moderate", "fk_moderate_admin", "moderator_id", "moderatoradmin", "user_id"),
        ("moderate", "fk_moderate_review", "review_id", "review", "review_id"),
        ("ratingscore", "fk_ratingscore_review", "review_id", "review", "review_id"),
        ("tagged_with", "fk_tagged_review", "review_id", "review", "review_id"),
    ]

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        for table_name, constraint_name, column_name, ref_table, ref_column in constraints:
            cursor.execute(
                """
                SELECT UPDATE_RULE, DELETE_RULE
                FROM information_schema.REFERENTIAL_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = DATABASE()
                  AND TABLE_NAME = %s
                  AND CONSTRAINT_NAME = %s
                """,
                (table_name, constraint_name),
            )
            current = cursor.fetchone()
            if not current:
                continue

            if (
                current["UPDATE_RULE"] == "CASCADE"
                and current["DELETE_RULE"] == "CASCADE"
            ):
                continue

            cursor.execute(
                f"ALTER TABLE `{table_name}` DROP FOREIGN KEY `{constraint_name}`"
            )
            cursor.execute(
                f"""
                ALTER TABLE `{table_name}`
                ADD CONSTRAINT `{constraint_name}`
                FOREIGN KEY (`{column_name}`) REFERENCES `{ref_table}` (`{ref_column}`)
                ON DELETE CASCADE
                ON UPDATE CASCADE
                """
            )

        conn.commit()
    finally:
        cursor.close()
        conn.close()


# =========================================================
# Pydantic models
# =========================================================

class StudentRegister(BaseModel):
    display_name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AccountUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class PlanCreate(BaseModel):
    student_id: int
    offering_id: int


class ReviewScoreIn(BaseModel):
    criterion_id: int
    score: float = Field(..., ge=0, le=5)


class ReviewCreate(BaseModel):
    student_id: int
    review_text: str
    prof_id: Optional[int] = None
    external_prof_id: Optional[int] = None
    course_code_raw: Optional[str] = None
    source: str = "APP"
    status: str = "PENDING"
    scores: List[ReviewScoreIn]
    tag_ids: List[int] = []


class ReviewUpdate(BaseModel):
    review_text: Optional[str] = None
    course_code_raw: Optional[str] = None
    status: Optional[str] = None


class ModerationUpdate(BaseModel):
    moderator_id: int
    action_taken: str


# =========================================================
# Auth / users
# =========================================================

@app.post("/auth/register")
def register_account(payload: StudentRegister):
    existing = fetch_one("SELECT user_id FROM user WHERE email = %s", (payload.email,))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()

        cursor.execute(
            """
            INSERT INTO user (email, display_name, password_hash)
            VALUES (%s, %s, %s)
            """,
            (payload.email, payload.display_name, payload.password),
        )
        user_id = cursor.lastrowid

        cursor.execute(
            "INSERT INTO studentuser (user_id) VALUES (%s)",
            (user_id,),
        )

        conn.commit()
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        cursor.close()
        conn.close()

    return {
        "message": "Student account created",
        "user": fetch_account_by_user_id(user_id),
    }


@app.post("/auth/login")
def login_account(payload: LoginRequest):
    row = fetch_account_by_credentials(payload.email, payload.password)

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"message": "Login successful", "user": row}


@app.get("/users/{user_id}")
def get_user_account(user_id: int):
    row = fetch_account_by_user_id(user_id)

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return row


@app.patch("/users/{user_id}")
def update_user_account(user_id: int, payload: AccountUpdate):
    current = fetch_one("SELECT user_id, email FROM user WHERE user_id = %s", (user_id,))
    if not current:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email and payload.email != current["email"]:
        existing = fetch_one("SELECT user_id FROM user WHERE email = %s", (payload.email,))
        if existing and existing["user_id"] != user_id:
            raise HTTPException(status_code=409, detail="Email already registered")

    execute_write(
        """
        UPDATE user
        SET display_name = COALESCE(%s, display_name),
            email = COALESCE(%s, email),
            password_hash = COALESCE(%s, password_hash)
        WHERE user_id = %s
        """,
        (payload.display_name, payload.email, payload.password, user_id),
    )

    return {
        "message": "Account updated",
        "user": fetch_account_by_user_id(user_id),
    }


@app.delete("/users/{user_id}")
def delete_user_account(user_id: int):
    current = fetch_account_by_user_id(user_id)
    if not current:
        raise HTTPException(status_code=404, detail="User not found")

    execute_write("DELETE FROM user WHERE user_id = %s", (user_id,))
    return {"message": "Account deleted", "user_id": user_id}


@app.post("/students/register")
def register_student(payload: StudentRegister):
    return register_account(payload)


@app.post("/students/login")
def login_student(payload: LoginRequest):
    row = fetch_account_by_credentials(payload.email, payload.password)

    if not row or row["role"] != ACCOUNT_ROLE_STUDENT:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"message": "Login successful", "user": row}


@app.post("/moderators/login")
def login_moderator(payload: LoginRequest):
    row = fetch_account_by_credentials(payload.email, payload.password)

    if not row or row["role"] != ACCOUNT_ROLE_MODERATOR:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"message": "Login successful", "user": row}


# =========================================================
# Courses / offerings / professors
# =========================================================

@app.get("/courses")
def get_courses(search: str = ""):
    return fetch_all(
        """
        SELECT course_id, course_number, course_title
        FROM course
        WHERE (%s = '' OR course_number LIKE CONCAT('%%', %s, '%%') OR course_title LIKE CONCAT('%%', %s, '%%'))
        ORDER BY CAST(course_number AS UNSIGNED), course_number
        """,
        (search, search, search),
    )


# ---------------------------------------------------------
# JOIN QUERY demo
# Search offerings with joined course/professor/review/tag data
# ---------------------------------------------------------
@app.get("/offerings/search")
def search_offerings(
    search: str = "",
    term: str = "",
    delivery_mode: str = "",
    year: Optional[int] = None,
):
    return fetch_all(
        """
        SELECT
            so.offering_id,
            c.course_id,
            CONCAT('CMPT ', c.course_number) AS course_code,
            c.course_title,
            so.section_no,
            so.year,
            so.term,
            so.delivery_mode,
            p.prof_id,
            p.prof_name,
            pem.external_prof_id,
            pem.match_type,
            pem.confidence_score,
            ep.source AS external_source,
            ep.external_id,
            ep.prof_name AS external_prof_name,
            ep.avg_rating AS rmp_avg_rating,
            ep.avg_diff AS rmp_avg_difficulty,
            ep.review_count AS rmp_review_count,
            ROUND(AVG(CASE WHEN rs.criterion_id = %s THEN rs.score END), 2) AS app_overall_rating,
            COUNT(DISTINCT r.review_id) AS app_review_count,
            GROUP_CONCAT(DISTINCT t.tag_name ORDER BY t.tag_name SEPARATOR ', ') AS app_tags
        FROM sectionoffering so
        JOIN course c ON c.course_id = so.course_id
        JOIN professor p ON p.prof_id = so.prof_id
        LEFT JOIN professor_external_match pem ON pem.prof_id = p.prof_id
        LEFT JOIN external_professor ep ON ep.external_prof_id = pem.external_prof_id
        LEFT JOIN review r ON r.prof_id = p.prof_id AND r.status = 'APPROVED'
        LEFT JOIN ratingscore rs ON rs.review_id = r.review_id
        LEFT JOIN tagged_with tw ON tw.review_id = r.review_id
        LEFT JOIN tag t ON t.tag_id = tw.tag_id
        WHERE
            (%s = '' OR c.course_number LIKE CONCAT('%%', %s, '%%') OR c.course_title LIKE CONCAT('%%', %s, '%%') OR p.prof_name LIKE CONCAT('%%', %s, '%%'))
            AND (%s = '' OR LOWER(so.term) = LOWER(%s))
            AND (%s = '' OR so.delivery_mode = %s)
            AND (%s IS NULL OR so.year = %s)
        GROUP BY
            so.offering_id, c.course_id, c.course_number, c.course_title,
            so.section_no, so.year, so.term, so.delivery_mode,
            p.prof_id, p.prof_name,
            pem.external_prof_id, pem.match_type, pem.confidence_score,
            ep.source, ep.external_id, ep.prof_name, ep.avg_rating, ep.avg_diff, ep.review_count
        ORDER BY so.year DESC, FIELD(LOWER(so.term), 'spring', 'summer', 'fall'), c.course_number, so.section_no
        """,
        (
            OVERALL_CRITERION_ID,
            search, search, search, search,
            term, term,
            delivery_mode, delivery_mode,
            year, year,
        ),
    )


@app.get("/offerings/{offering_id}")
def get_offering(offering_id: int):
    row = fetch_one(
        """
        SELECT
            so.offering_id,
            so.section_no,
            so.year,
            so.term,
            so.delivery_mode,
            c.course_id,
            c.course_number,
            c.course_title,
            p.prof_id,
            p.prof_name,
            pem.external_prof_id,
            pem.match_type,
            pem.confidence_score,
            ep.source AS external_source,
            ep.external_id,
            ep.prof_name AS external_prof_name,
            ep.avg_rating AS rmp_avg_rating,
            ep.avg_diff AS rmp_avg_difficulty,
            ep.review_count AS rmp_review_count
        FROM sectionoffering so
        JOIN course c ON c.course_id = so.course_id
        JOIN professor p ON p.prof_id = so.prof_id
        LEFT JOIN professor_external_match pem ON pem.prof_id = p.prof_id
        LEFT JOIN external_professor ep ON ep.external_prof_id = pem.external_prof_id
        WHERE so.offering_id = %s
        """,
        (offering_id,),
    )

    if not row:
        raise HTTPException(status_code=404, detail="Offering not found")

    return row


@app.get("/professors/{prof_id}")
def get_professor(prof_id: int):
    row = fetch_one(
        """
        SELECT
            p.prof_id,
            p.prof_name,
            pem.external_prof_id,
            pem.match_type,
            pem.confidence_score,
            ep.source AS external_source,
            ep.external_id,
            ep.prof_name AS external_prof_name,
            ep.avg_rating AS rmp_avg_rating,
            ep.avg_diff AS rmp_avg_difficulty,
            ep.review_count AS rmp_review_count
        FROM professor p
        LEFT JOIN professor_external_match pem ON pem.prof_id = p.prof_id
        LEFT JOIN external_professor ep ON ep.external_prof_id = pem.external_prof_id
        WHERE p.prof_id = %s
        """,
        (prof_id,),
    )

    if not row:
        raise HTTPException(status_code=404, detail="Professor not found")

    return row


@app.get("/professors/{prof_id}/reviews")
def get_professor_reviews(prof_id: int, status: str = "APPROVED"):
    return fetch_all(
        """
        SELECT
            r.review_id,
            r.source,
            r.studentuser_id AS student_id,
            u.display_name AS student_username,
            r.prof_id,
            r.external_prof_id,
            r.review_text,
            r.course_code_raw,
            r.status,
            r.created_at,
            ROUND(AVG(CASE WHEN rs.criterion_id = %s THEN rs.score END), 2) AS overall_rating,
            GROUP_CONCAT(DISTINCT t.tag_name ORDER BY t.tag_name SEPARATOR ', ') AS tags
        FROM professor p
        LEFT JOIN professor_external_match pem ON pem.prof_id = p.prof_id
        LEFT JOIN review r
            ON (
                r.prof_id = p.prof_id
                OR (pem.external_prof_id IS NOT NULL AND r.external_prof_id = pem.external_prof_id)
            )
        LEFT JOIN studentuser su ON su.user_id = r.studentuser_id
        LEFT JOIN user u ON u.user_id = su.user_id
        LEFT JOIN ratingscore rs ON rs.review_id = r.review_id
        LEFT JOIN tagged_with tw ON tw.review_id = r.review_id
        LEFT JOIN tag t ON t.tag_id = tw.tag_id
        WHERE p.prof_id = %s AND r.status = %s
        GROUP BY
            r.review_id, r.source, r.studentuser_id, u.display_name,
            r.prof_id, r.external_prof_id,
            r.review_text, r.course_code_raw, r.status, r.created_at
        ORDER BY r.created_at DESC
        """,
        (OVERALL_CRITERION_ID, prof_id, status.upper()),
    )


@app.get("/reviews/{review_id}")
def get_review_details(review_id: int):
    review = fetch_one(
        """
        SELECT
            review_id, source, prof_id, external_prof_id,
            review_text, course_code_raw, status, created_at
        FROM review
        WHERE review_id = %s
        """,
        (review_id,),
    )

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    scores = fetch_all(
        """
        SELECT rc.criterion_id, rc.criterion_name, rs.score
        FROM ratingscore rs
        JOIN ratingcriterion rc ON rc.criterion_id = rs.criterion_id
        WHERE rs.review_id = %s
        ORDER BY rc.criterion_name
        """,
        (review_id,),
    )

    tags = fetch_all(
        """
        SELECT t.tag_id, t.tag_name
        FROM tagged_with tw
        JOIN tag t ON t.tag_id = tw.tag_id
        WHERE tw.review_id = %s
        ORDER BY t.tag_name
        """,
        (review_id,),
    )

    return {**review, "scores": scores, "tags": tags}


@app.get("/tags")
def get_tags():
    return fetch_all("SELECT tag_id, tag_name FROM tag ORDER BY tag_name")


# =========================================================
# Plans
# =========================================================

@app.get("/students/{student_id}/plans")
def get_student_plans(student_id: int):
    return fetch_all(
        """
        SELECT
            p.studentuser_id AS student_id,
            so.offering_id,
            c.course_number,
            c.course_title,
            so.section_no,
            so.year,
            so.term,
            so.delivery_mode,
            prof.prof_name
        FROM plans p
        JOIN sectionoffering so ON so.offering_id = p.offering_id
        JOIN course c ON c.course_id = so.course_id
        JOIN professor prof ON prof.prof_id = so.prof_id
        WHERE p.studentuser_id = %s
        ORDER BY so.year DESC, FIELD(LOWER(so.term), 'spring', 'summer', 'fall'), c.course_number, so.section_no
        """,
        (student_id,),
    )


@app.post("/plans")
def add_plan(payload: PlanCreate):
    execute_write(
        "INSERT INTO plans (studentuser_id, offering_id) VALUES (%s, %s)",
        (payload.student_id, payload.offering_id),
    )
    return {"message": "Plan added"}


@app.delete("/plans")
def remove_plan(student_id: int = Query(...), offering_id: int = Query(...)):
    execute_write(
        "DELETE FROM plans WHERE studentuser_id = %s AND offering_id = %s",
        (student_id, offering_id),
    )
    return {"message": "Plan removed"}


# =========================================================
# Reviews
# =========================================================

@app.post("/reviews")
def create_review(payload: ReviewCreate):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()

        cursor.execute(
            """
            INSERT INTO review
            (source, studentuser_id, prof_id, external_prof_id, review_text, course_code_raw, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                payload.source,
                payload.student_id,
                payload.prof_id,
                payload.external_prof_id,
                payload.review_text,
                payload.course_code_raw,
                payload.status.upper(),
            ),
        )

        review_id = cursor.lastrowid

        for score in payload.scores:
            cursor.execute(
                "INSERT INTO ratingscore (review_id, criterion_id, score) VALUES (%s, %s, %s)",
                (review_id, score.criterion_id, score.score),
            )

        for tag_id in payload.tag_ids:
            cursor.execute(
                "INSERT INTO tagged_with (review_id, tag_id) VALUES (%s, %s)",
                (review_id, tag_id),
            )

        conn.commit()
        return {"message": "Review created", "review_id": review_id}

    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        cursor.close()
        conn.close()


@app.patch("/reviews/{review_id}")
def update_review(review_id: int, payload: ReviewUpdate):
    current = fetch_one("SELECT review_id FROM review WHERE review_id = %s", (review_id,))
    if not current:
        raise HTTPException(status_code=404, detail="Review not found")

    execute_write(
        """
        UPDATE review
        SET review_text = COALESCE(%s, review_text),
            course_code_raw = COALESCE(%s, course_code_raw),
            status = COALESCE(%s, status)
        WHERE review_id = %s
        """,
        (
            payload.review_text,
            payload.course_code_raw,
            payload.status.upper() if payload.status else None,
            review_id,
        ),
    )

    return {"message": "Review updated"}


# =========================================================
# Moderation / update demo
# =========================================================

@app.get("/moderation/reviews")
def get_reviews_for_moderation(status: str = "PENDING"):
    return fetch_all(
        """
        SELECT
            r.review_id,
            r.source,
            r.studentuser_id AS student_id,
            u.display_name AS student_username,
            r.prof_id,
            p.prof_name,
            r.review_text,
            r.course_code_raw,
            r.status,
            r.created_at
        FROM review r
        LEFT JOIN studentuser su ON su.user_id = r.studentuser_id
        LEFT JOIN user u ON u.user_id = su.user_id
        LEFT JOIN professor p ON p.prof_id = r.prof_id
        WHERE r.status = %s
        ORDER BY r.created_at DESC
        """,
        (status.upper(),),
    )


@app.patch("/moderation/reviews/{review_id}")
def moderate_review(review_id: int, payload: ModerationUpdate):
    action = payload.action_taken.upper().strip()
    if action not in {"APPROVED", "HIDDEN", "REMOVED", "PENDING"}:
        raise HTTPException(status_code=400, detail="Invalid action_taken")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()

        cursor.execute(
            "UPDATE review SET status = %s WHERE review_id = %s",
            (action, review_id),
        )

        cursor.execute(
            "INSERT INTO moderate (moderator_id, review_id, action_taken) VALUES (%s, %s, %s)",
            (payload.moderator_id, review_id, action),
        )

        conn.commit()
        return {"message": "Moderation applied", "review_id": review_id, "status": action}

    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        cursor.close()
        conn.close()


# ---------------------------------------------------------
# DELETE CASCADE demo endpoint
# Your DB must also define ON DELETE CASCADE on the review
# foreign keys for this rubric item to fully count.
# ---------------------------------------------------------
@app.delete("/admin/reviews/{review_id}")
def delete_review(review_id: int):
    execute_write("DELETE FROM review WHERE review_id = %s", (review_id,))
    return {"message": "Review deleted"}


# =========================================================
# Analytics / rubric query demos
# =========================================================

# ---------------------------------------------------------
# AGGREGATION query demo
# ---------------------------------------------------------
@app.get("/analytics/professors/{prof_id}/stats")
def professor_stats(prof_id: int):
    row = fetch_one(
        """
        SELECT
            p.prof_id,
            p.prof_name,
            pem.external_prof_id,
            ep.avg_rating AS rmp_avg_rating,
            ep.avg_diff AS rmp_avg_difficulty,
            ep.review_count AS rmp_review_count,
            COUNT(DISTINCT r.review_id) AS app_review_count,
            ROUND(AVG(CASE WHEN rs.criterion_id = %s THEN rs.score END), 2) AS app_avg_overall,
            ROUND(AVG(CASE WHEN rc.criterion_name = 'Difficulty' THEN rs.score END), 2) AS app_avg_difficulty,
            MIN(CASE WHEN rs.criterion_id = %s THEN rs.score END) AS app_min_overall,
            MAX(CASE WHEN rs.criterion_id = %s THEN rs.score END) AS app_max_overall
        FROM professor p
        LEFT JOIN professor_external_match pem ON pem.prof_id = p.prof_id
        LEFT JOIN external_professor ep ON ep.external_prof_id = pem.external_prof_id
        LEFT JOIN review r ON r.prof_id = p.prof_id AND r.status = 'APPROVED'
        LEFT JOIN ratingscore rs ON rs.review_id = r.review_id
        LEFT JOIN ratingcriterion rc ON rc.criterion_id = rs.criterion_id
        WHERE p.prof_id = %s
        GROUP BY p.prof_id, p.prof_name, pem.external_prof_id, ep.avg_rating, ep.avg_diff, ep.review_count
        """,
        (OVERALL_CRITERION_ID, OVERALL_CRITERION_ID, OVERALL_CRITERION_ID, prof_id),
    )

    if not row:
        raise HTTPException(status_code=404, detail="Professor not found")

    return row


# ---------------------------------------------------------
# AGGREGATION WITH GROUP BY demo
# ---------------------------------------------------------
@app.get("/analytics/professor-averages-by-course")
def professor_averages_by_course(course_number: str):
    return fetch_all(
        """
        SELECT
            c.course_id,
            c.course_number,
            c.course_title,
            p.prof_id,
            p.prof_name,
            pem.external_prof_id,
            ep.avg_rating AS rmp_avg_rating,
            ep.avg_diff AS rmp_avg_difficulty,
            ep.review_count AS rmp_review_count,
            COUNT(DISTINCT r.review_id) AS app_review_count,
            ROUND(AVG(CASE WHEN rs.criterion_id = %s THEN rs.score END), 2) AS app_avg_overall,
            ROUND(AVG(CASE WHEN rc.criterion_name = 'Difficulty' THEN rs.score END), 2) AS app_avg_difficulty
        FROM sectionoffering so
        JOIN course c ON c.course_id = so.course_id
        JOIN professor p ON p.prof_id = so.prof_id
        LEFT JOIN professor_external_match pem ON pem.prof_id = p.prof_id
        LEFT JOIN external_professor ep ON ep.external_prof_id = pem.external_prof_id
        LEFT JOIN review r ON r.prof_id = p.prof_id AND r.status = 'APPROVED'
        LEFT JOIN ratingscore rs ON rs.review_id = r.review_id
        LEFT JOIN ratingcriterion rc ON rc.criterion_id = rs.criterion_id
        WHERE c.course_number = %s
        GROUP BY c.course_id, c.course_number, c.course_title, p.prof_id, p.prof_name, pem.external_prof_id, ep.avg_rating, ep.avg_diff, ep.review_count
        ORDER BY app_avg_overall DESC, rmp_avg_rating DESC, app_review_count DESC, p.prof_name
        """,
        (OVERALL_CRITERION_ID, course_number),
    )


# ---------------------------------------------------------
# DIVISION query demo
# Students who planned ALL offerings of a given course
# ---------------------------------------------------------
@app.get("/analytics/students/planned-all-sections")
def students_planned_all_sections(course_id: int):
    return fetch_all(
        """
        SELECT s.student_id, s.username, s.email
        FROM (
            SELECT su.user_id AS student_id, u.display_name AS username, u.email
            FROM studentuser su
            JOIN user u ON u.user_id = su.user_id
        ) s
        WHERE EXISTS (
            SELECT 1
            FROM sectionoffering so
            WHERE so.course_id = %s
        )
        AND NOT EXISTS (
            SELECT so.offering_id
            FROM sectionoffering so
            WHERE so.course_id = %s
              AND NOT EXISTS (
                  SELECT 1
                  FROM plans p
                  WHERE p.studentuser_id = s.student_id
                    AND p.offering_id = so.offering_id
              )
        )
        ORDER BY s.username
        """,
        (course_id, course_id),
    )


@app.get("/analytics/course-offering-counts")
def course_offering_counts():
    return fetch_all(
        """
        SELECT year, term, COUNT(*) AS offering_count
        FROM sectionoffering
        GROUP BY year, term
        ORDER BY year DESC, FIELD(LOWER(term), 'spring', 'summer', 'fall')
        """
    )
