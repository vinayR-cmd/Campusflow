import os
from openai import OpenAI

_client = None

def get_openai_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client

def openai_chat(
    prompt: str,
    system: str = "You are a helpful assistant. Return only valid JSON when asked.",
    model: str = "gpt-4o-mini",
    max_tokens: int = 1500,
    temperature: float = 0.3
) -> str:
    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"OpenAI error: {e}")
        raise e
