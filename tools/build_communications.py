"""Validate the lunar communications register and render its GitHub Pages companion."""
import argparse
import json
import re
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
STATUSES = {
    "mission_ended": "Mission ended",
    "mission_use_documented": "Mission use documented",
    "planned_service": "Planned service",
}


def indexed(rows):
    result = {}
    for row in rows:
        key = row["id"]
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", key) or key in result:
            raise ValueError(f"Invalid or duplicate identifier: {key}")
        result[key] = row
    if not result:
        raise ValueError("The register requires records and sources.")
    return result


def iso_date(value):
    parsed = date.fromisoformat(value)
    if parsed.isoformat() != value:
        raise ValueError(f"Use a YYYY-MM-DD date: {value}")
    return parsed


def validate(data):
    review = iso_date(data["reviewed_on"])
    sources = indexed(data["sources"])
    for source in sources.values():
        url = urlsplit(source["url"])
        if url.scheme != "https" or not url.hostname:
            raise ValueError(f"Invalid source URL: {source['id']}")
        if iso_date(source["published_on"]) > review:
            raise ValueError(f"Source postdates review: {source['id']}")
        if not source["publisher"].strip() or not source["title"].strip():
            raise ValueError(f"Incomplete source: {source['id']}")
    for record in indexed(data["records"]).values():
        key = record["id"]
        if record["status"] not in STATUSES or not record["availability"].strip() or not record["name"].strip():
            raise ValueError(f"Incomplete record: {key}")
        status_source = sources.get(record["status_source"])
        if not status_source or iso_date(record["status_as_of"]) > iso_date(status_source["published_on"]):
            raise ValueError(f"Invalid status date or source: {key}")
        if record["status_source"] not in {c["source"] for c in record["claims"]}:
            raise ValueError(f"Status evidence missing from claims: {key}")
        for claim in record["claims"]:
            if claim["source"] not in sources or not claim["text"].strip():
                raise ValueError(f"Invalid claim or source: {key}")
    return sources


def record_html(record, sources):
    claims = []
    for claim in record["claims"]:
        source = sources[claim["source"]]
        citation = f'{source["publisher"]}, {source["published_on"]}'
        link = f'<a href="{escape(source["url"])}" title="{escape(source["title"])}">{escape(citation)}</a>'
        claims.append(f'<li>{escape(claim["text"])} {link}</li>')
    status_source = sources[record["status_source"]]
    return f"""<article id="{record['id']}" data-status="{record['status']}">
  <h2>{escape(record['name'])}</h2>
  <p class="status">{STATUSES[record['status']]} · <a href="{escape(status_source['url'])}">{record['status_as_of']}</a></p>
  <p>{escape(record['availability'])}</p>
  <details><summary>Evidence and sources</summary><ul>{''.join(claims)}</ul></details>
</article>"""


def render(data):
    sources = validate(data)
    articles = "\n".join(record_html(record, sources) for record in data["records"])
    options = "".join(f'<option value="{key}">{label}</option>' for key, label in STATUSES.items())
    template = (ROOT / "tools/templates/lunar_communications.html").read_text(encoding="utf-8")
    return template.replace("{{reviewed_on}}", data["reviewed_on"]).replace("{{options}}", options).replace("{{records}}", articles)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if the generated page differs from the register.")
    args = parser.parse_args()
    data = json.loads((ROOT / "data/lunar-communications.json").read_text(encoding="utf-8"))
    page = render(data)
    output = ROOT / "infrastructure/index.html"
    if args.check:
        if not output.exists() or output.read_text(encoding="utf-8") != page:
            raise SystemExit("Rebuild the companion with python tools/build_communications.py.")
    else:
        output.write_text(page, encoding="utf-8")
    print(f"{len(data['records'])} records and {len(data['sources'])} source documents verified.")


if __name__ == "__main__":
    main()
