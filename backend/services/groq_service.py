from groq import Groq
from config import GROQ_API_KEY

client = Groq(api_key=GROQ_API_KEY)

MODEL = "llama-3.3-70b-versatile"

QA_SYSTEM_TEMPLATE = (
    "You are a campus assistant. Answer the student's question using ONLY the "
    "provided campus documents. If the answer is not in the documents, say "
    "'I don't have that information in the campus documents yet.' Always mention "
    "which document type your answer came from.\n\n"
    "Question: {question}\n\nDocuments: {chunks}"
)


def answer_campus_question(question: str, chunks: list[dict]) -> str:
    """Use Groq llama-3.3-70b-versatile to answer a campus Q&A question from retrieved chunks."""
    if chunks:
        docs_text = "\n\n".join(
            f"[Document type: {c['metadata'].get('doc_type', 'Unknown')}]\n{c['text']}"
            for c in chunks
        )
    else:
        docs_text = "(no documents available)"

    prompt = QA_SYSTEM_TEMPLATE.format(question=question, chunks=docs_text)

    completion = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=512,
    )
    return completion.choices[0].message.content.strip()
