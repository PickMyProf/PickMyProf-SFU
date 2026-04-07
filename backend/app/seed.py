"""
SFU API -> MySQL seeder (official source of truth)

Seeds:
- course
- professor
- sectionoffering
"""

import time
import requests
from app.database import get_connection

SFU_API = "https://www.sfu.ca/bin/wcm/course-outlines"
DEPT = "cmpt"

TERMS = [
    ("2024", "fall"),
    ("2025", "spring"),
    ("2025", "summer"),
    ("2025", "fall"),
    ("2026", "spring"),
    ("2026", "summer"),
    ("2026", "fall"),
]

REQUEST_DELAY = 0.15


def normalize_name(name: str) -> str:
    return " ".join(name.lower().replace(".", "").split())


def _fetch(url: str):
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and data.get("errorCode"):
            return None
        return data
    except Exception as exc:
        print(f"    [WARN] {url} -> {exc}")
        return None


def _upsert_course(cursor, course_number: str, course_title: str) -> int:
    cursor.execute(
        """
        INSERT INTO course (course_number, course_title)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE
            course_title = VALUES(course_title)
        """,
        (course_number, course_title),
    )
    cursor.execute(
        "SELECT course_id FROM course WHERE course_number = %s",
        (course_number,),
    )
    return cursor.fetchone()[0]


def _upsert_professor(cursor, prof_name: str) -> int:
    normalized = normalize_name(prof_name)

    cursor.execute(
        "SELECT prof_id FROM professor WHERE normalized_name = %s",
        (normalized,),
    )
    row = cursor.fetchone()
    if row:
        return row[0]

    cursor.execute(
        """
        INSERT INTO professor (prof_name, normalized_name)
        VALUES (%s, %s)
        """,
        (prof_name, normalized),
    )
    return cursor.lastrowid


def _upsert_section(
    cursor,
    course_id: int,
    prof_id: int | None,
    year: int,
    term: str,
    section_no: str,
    delivery_mode: str | None,
):
    cursor.execute(
        """
        INSERT INTO sectionoffering
            (section_no, year, term, delivery_mode, course_id, prof_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            prof_id = VALUES(prof_id),
            delivery_mode = VALUES(delivery_mode)
        """,
        (section_no, year, term, delivery_mode, course_id, prof_id),
    )


def run_seed() -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    stats = {"terms": 0, "courses": 0, "sections": 0, "skipped": 0}

    tba_prof_id = _upsert_professor(cursor, "TBA")
    conn.commit()

    for year, term in TERMS:
        print(f"\n{'=' * 60}")
        print(f"  {year} {term.upper()}")
        print(f"{'=' * 60}")

        courses = _fetch(f"{SFU_API}?{year}/{term}/{DEPT}")
        if not courses:
            print("  No courses found - skipping term.")
            continue

        stats["terms"] += 1

        for course_item in courses:
            number = course_item.get("value")
            if not number:
                continue

            print(f"\n  {DEPT.upper()} {number}")
            sections = _fetch(f"{SFU_API}?{year}/{term}/{DEPT}/{number}")
            if not sections:
                stats["skipped"] += 1
                continue

            stats["courses"] += 1

            for section_item in sections:
                section = section_item.get("value")
                if not section:
                    continue

                time.sleep(REQUEST_DELAY)
                outline = _fetch(f"{SFU_API}?{year}/{term}/{DEPT}/{number}/{section}")
                if not outline or "info" not in outline:
                    stats["skipped"] += 1
                    continue

                info = outline.get("info", {})
                course_title = info.get("title") or f"CMPT {number}"
                delivery_mode = info.get("deliveryMethod") or info.get("type") or None

                course_id = _upsert_course(cursor, number, course_title)

                raw_instructors = outline.get("instructor") or []
                if isinstance(raw_instructors, dict):
                    raw_instructors = [raw_instructors]

                prof_id = None
                prof_display = "TBA"

                for instr in raw_instructors:
                    if not instr:
                        continue

                    fname = (instr.get("firstName") or "").strip()
                    lname = (instr.get("lastName") or "").strip()
                    full_name = " ".join(filter(None, [fname, lname]))

                    if not full_name:
                        continue

                    prof_id = _upsert_professor(cursor, full_name)
                    prof_display = full_name
                    break

                if prof_id is None:
                    prof_id = tba_prof_id

                _upsert_section(
                    cursor=cursor,
                    course_id=course_id,
                    prof_id=prof_id,
                    year=int(year),
                    term=term,
                    section_no=section,
                    delivery_mode=delivery_mode,
                )

                conn.commit()
                stats["sections"] += 1
                print(f"    ✓ {section} - {prof_display}")

    cursor.close()
    conn.close()

    print(
        f"\n✅ Seeding complete: "
        f"{stats['terms']} terms | "
        f"{stats['courses']} courses | "
        f"{stats['sections']} sections inserted/updated | "
        f"{stats['skipped']} skipped"
    )
    return stats


if __name__ == "__main__":
    run_seed()
