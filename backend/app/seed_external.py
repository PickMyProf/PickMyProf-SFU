"""
Scraped professor -> MySQL seeder

Seeds:
- external_professor
- professor_external_match
- review
- ratingcriterion (if needed)
- ratingscore
- tag
- tagged_with
"""

import json
import hashlib
from pathlib import Path
from app.database import get_connection

SOURCE_NAME = "RMP"
JSON_PATH = Path(__file__).resolve().parents[1] / "scraped_professors.json"


def normalize_name(name: str) -> str:
    return " ".join((name or "").lower().replace(".", "").split())


def make_review_hash(
    source: str,
    external_id: str,
    course_code_raw: str | None,
    review_text: str | None,
) -> str:
    raw = "||".join(
        [
            source or "",
            external_id or "",
            str(course_code_raw or ""),
            (review_text or "").strip(),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _upsert_external_professor(cursor, item: dict) -> int:
    external_id = str(item.get("id") or "").strip()
    prof_name = (item.get("name") or "").strip()
    normalized_name = normalize_name(prof_name)
    avg_rating = item.get("avg_rating")
    avg_diff = item.get("avg_diff")
    review_count = len(item.get("reviews") or [])

    cursor.execute(
        """
        INSERT INTO external_professor
            (source, external_id, prof_name, normalized_name, avg_rating, avg_diff, review_count)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            prof_name = VALUES(prof_name),
            normalized_name = VALUES(normalized_name),
            avg_rating = VALUES(avg_rating),
            avg_diff = VALUES(avg_diff),
            review_count = VALUES(review_count)
        """,
        (
            SOURCE_NAME,
            external_id,
            prof_name,
            normalized_name,
            avg_rating,
            avg_diff,
            review_count,
        ),
    )

    cursor.execute(
        """
        SELECT external_prof_id
        FROM external_professor
        WHERE source = %s AND external_id = %s
        """,
        (SOURCE_NAME, external_id),
    )
    return cursor.fetchone()[0]


def _find_official_professor(cursor, prof_name: str):
    normalized = normalize_name(prof_name)
    cursor.execute(
        "SELECT prof_id FROM professor WHERE normalized_name = %s",
        (normalized,),
    )
    row = cursor.fetchone()
    return row[0] if row else None


def _upsert_match(cursor, prof_id: int, external_prof_id: int):
    cursor.execute(
        """
        INSERT IGNORE INTO professor_external_match
            (prof_id, external_prof_id, match_type, confidence_score)
        VALUES (%s, %s, %s, %s)
        """,
        (prof_id, external_prof_id, "AUTO", 1.00),
    )


def _upsert_review(
    cursor,
    external_prof_id: int,
    official_prof_id: int | None,
    external_id: str,
    review_item: dict,
) -> int:
    course_code_raw = (review_item.get("course_code") or "").strip() or None
    review_text = (review_item.get("review_text") or "").strip() or None

    review_hash = make_review_hash(
        source=SOURCE_NAME,
        external_id=external_id,
        course_code_raw=course_code_raw,
        review_text=review_text,
    )

    cursor.execute(
        """
        INSERT INTO review
            (
                source,
                student_id,
                offering_id,
                prof_id,
                external_prof_id,
                review_text,
                course_code_raw,
                external_review_hash,
                status
            )
        VALUES (%s, NULL, NULL, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            prof_id = VALUES(prof_id),
            review_text = VALUES(review_text),
            course_code_raw = VALUES(course_code_raw),
            status = VALUES(status)
        """,
        (
            SOURCE_NAME,
            official_prof_id,
            external_prof_id,
            review_text,
            course_code_raw,
            review_hash,
            "APPROVED",
        ),
    )

    cursor.execute(
        "SELECT review_id FROM review WHERE external_review_hash = %s",
        (review_hash,),
    )
    return cursor.fetchone()[0]


def _upsert_tag(cursor, tag_name: str) -> int:
    clean_tag = " ".join(tag_name.strip().lower().split())
    cursor.execute(
        """
        INSERT INTO tag (tag_name)
        VALUES (%s)
        ON DUPLICATE KEY UPDATE
            tag_name = VALUES(tag_name)
        """,
        (clean_tag,),
    )
    cursor.execute(
        "SELECT tag_id FROM tag WHERE tag_name = %s",
        (clean_tag,),
    )
    return cursor.fetchone()[0]


def _get_or_create_criterion(cursor, criterion_name: str) -> int:
    cursor.execute(
        """
        INSERT INTO ratingcriterion (criterion_name)
        VALUES (%s)
        ON DUPLICATE KEY UPDATE
            criterion_name = VALUES(criterion_name)
        """,
        (criterion_name,),
    )
    cursor.execute(
        "SELECT criterion_id FROM ratingcriterion WHERE criterion_name = %s",
        (criterion_name,),
    )
    return cursor.fetchone()[0]


def _upsert_rating_score(cursor, review_id: int, criterion_id: int, score):
    cursor.execute(
        """
        INSERT INTO ratingscore (review_id, criterion_id, score)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE
            score = VALUES(score)
        """,
        (review_id, criterion_id, score),
    )


def run_external_seed():
    if not JSON_PATH.exists():
        raise FileNotFoundError(f"Could not find {JSON_PATH}")

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = get_connection()
    cursor = conn.cursor()

    overall_criterion_id = _get_or_create_criterion(cursor, "Overall")
    difficulty_criterion_id = _get_or_create_criterion(cursor, "Difficulty")

    stats = {
        "external_professors": 0,
        "matched_professors": 0,
        "reviews": 0,
        "rating_scores": 0,
        "tag_links": 0,
    }

    for item in data:
        prof_name = (item.get("name") or "").strip()
        if not prof_name:
            continue

        external_id = str(item.get("id") or "").strip()
        external_prof_id = _upsert_external_professor(cursor, item)
        stats["external_professors"] += 1

        official_prof_id = _find_official_professor(cursor, prof_name)
        if official_prof_id:
            _upsert_match(cursor, official_prof_id, external_prof_id)
            stats["matched_professors"] += 1

        for review_item in item.get("reviews") or []:
            review_id = _upsert_review(
                cursor=cursor,
                external_prof_id=external_prof_id,
                official_prof_id=official_prof_id,
                external_id=external_id,
                review_item=review_item,
            )
            stats["reviews"] += 1

            quality = review_item.get("quality")
            difficulty = review_item.get("difficulty")

            if quality is not None:
                _upsert_rating_score(cursor, review_id, overall_criterion_id, quality)
                stats["rating_scores"] += 1

            if difficulty is not None:
                _upsert_rating_score(cursor, review_id, difficulty_criterion_id, difficulty)
                stats["rating_scores"] += 1

            for raw_tag in review_item.get("tags") or []:
                if not raw_tag or not raw_tag.strip():
                    continue
                tag_id = _upsert_tag(cursor, raw_tag)
                cursor.execute(
                    """
                    INSERT IGNORE INTO tagged_with (review_id, tag_id)
                    VALUES (%s, %s)
                    """,
                    (review_id, tag_id),
                )
                stats["tag_links"] += 1

    conn.commit()
    cursor.close()
    conn.close()

    print(
        f"✅ External seed complete: "
        f"{stats['external_professors']} external professors | "
        f"{stats['matched_professors']} matched | "
        f"{stats['reviews']} reviews | "
        f"{stats['rating_scores']} rating scores | "
        f"{stats['tag_links']} tag links"
    )
    return stats


if __name__ == "__main__":
    run_external_seed()
