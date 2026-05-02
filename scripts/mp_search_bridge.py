"""
Bridge script for MemPalace semantic search with JSON output.
Called by MemPalaceAccess.ts via subprocess.

Usage:
  python mp_search_bridge.py <palace_dir> <wing> <n_results> <query>
"""
import json
import sys
import os

def main() -> None:
    if len(sys.argv) < 5:
        json.dump({"error": "Usage: mp_search_bridge.py <palace_dir> <wing> <n_results> <query>"}, sys.stdout)
        sys.exit(1)

    palace_dir = sys.argv[1]
    wing = sys.argv[2]
    n_results = int(sys.argv[3])
    query = sys.argv[4]

    # Override palace path for this instance
    os.environ["MEMPALACE_PALACE_PATH"] = palace_dir

    # Import after setting env so config picks it up
    from mempalace.searcher import search_memories  # type: ignore

    raw = search_memories(query=query, palace_path=palace_dir, wing=wing, n_results=n_results)
    results = raw.get("results", []) if isinstance(raw, dict) else []

    output = [
        {
            "content": r.get("text", ""),
            "source": r.get("source_file", ""),
            "score": r.get("similarity", 0.0),
            "room": r.get("room", ""),
            "wing": r.get("wing", wing),
        }
        for r in results
    ]

    json.dump(output, sys.stdout)

if __name__ == "__main__":
    main()
