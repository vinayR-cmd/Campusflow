import uuid
import chromadb
from config import CHROMA_DB_PATH, sanitize_domain
from services.gemini_service import embed_text

_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def collection_name_for_college(college_identifier: str) -> str:
    """Build the chromadb collection name for a college, e.g. kiet_edu_campus_kb."""
    return f"{sanitize_domain(college_identifier)}_campus_kb"


def get_collection(college_identifier: str):
    name = collection_name_for_college(college_identifier)
    return _client.get_or_create_collection(name=name)


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks of `chunk_size` characters."""
    text = text.strip()
    if not text:
        return []

    chunks = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == length:
            break
        start = end - overlap
    return chunks


def add_document_chunks(college_identifier: str, doc_id: str, text: str, metadata: dict) -> int:
    """Chunk `text`, embed each chunk, and store it in the college's collection.

    Returns the number of chunks stored.
    """
    chunks = chunk_text(text)
    if not chunks:
        return 0

    collection = get_collection(college_identifier)

    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    embeddings = [embed_text(c, task_type="retrieval_document") for c in chunks]
    metadatas = []
    for i in range(len(chunks)):
        chunk_meta = dict(metadata)
        chunk_meta["doc_id"] = doc_id
        chunk_meta["chunk_index"] = i
        metadatas.append(chunk_meta)

    collection.add(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
    return len(chunks)


def query_documents(
    college_identifier: str,
    question: str,
    student_context: dict | None = None,
    top_k: int = 3,
) -> list[dict]:
    """Embed `question` and query the college's collection, returning top_k chunks.

    Filters results to documents tagged "All" or matching the student's
    branch/year/section/hostel where those tags are present in student_context.
    """
    collection = get_collection(college_identifier)
    if collection.count() == 0:
        return []

    query_embedding = embed_text(question, task_type="retrieval_query")

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k * 4, max(collection.count(), 1)),
        include=["documents", "metadatas", "distances"],
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    chunks = []
    for doc_text, meta, dist in zip(documents, metadatas, distances):
        if student_context and not _matches_student_context(meta, student_context):
            continue
        chunks.append({"text": doc_text, "metadata": meta, "distance": dist})

    return chunks[:top_k]


def _matches_student_context(meta: dict, student_context: dict) -> bool:
    for key, ctx_key in (("branch", "branch"), ("year", "year"), ("section", "section"), ("hostel_wing", "hostel")):
        meta_value = str(meta.get(key, "All"))
        ctx_value = student_context.get(ctx_key)
        if meta_value == "All" or ctx_value is None:
            continue
        if meta_value != str(ctx_value):
            return False
    return True


def collection_doc_count(college_identifier: str) -> int:
    return get_collection(college_identifier).count()


def new_doc_id() -> str:
    return str(uuid.uuid4())
