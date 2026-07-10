#!/usr/bin/env python3
"""Add memory to local mem0 Qdrant collection (fastembed + qdrant-client)."""
import json
import os
import sys
import uuid
from datetime import datetime, timezone

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing payload"}))
        sys.exit(1)

    payload = json.loads(sys.argv[1])
    text = (payload.get("text") or "").strip()
    user_id = payload.get("userId") or os.environ.get("MEM0_USER_ID", "default")
    metadata = payload.get("metadata") or {}

    if not text:
        print(json.dumps({"error": "empty text"}))
        sys.exit(1)

    host = os.environ.get("MEM0_QDRANT_HOST", "localhost")
    port = int(os.environ.get("MEM0_QDRANT_PORT", "6333"))
    collection = os.environ.get("MEM0_COLLECTION", "mem0")

    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct
        from fastembed import TextEmbedding
    except ImportError as e:
        print(json.dumps({
            "error": "Install deps: pip install qdrant-client fastembed",
            "detail": str(e),
        }))
        sys.exit(2)

    model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector = list(next(model.embed([text])))

    point_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    point_payload = {
        "user_id": user_id,
        "role": "user",
        "data": text,
        "created_at": now,
        "updated_at": now,
        **metadata,
    }

    client = QdrantClient(host=host, port=port)
    client.upsert(
        collection_name=collection,
        points=[PointStruct(id=point_id, vector=vector, payload=point_payload)],
    )

    print(json.dumps({"id": point_id, "text": text, "createdAt": now}))


if __name__ == "__main__":
    main()
