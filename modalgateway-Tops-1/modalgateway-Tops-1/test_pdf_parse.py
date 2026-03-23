import io
import httpx
import asyncio
import PyPDF2
import os

async def test_parse(url):
    print(f"Testing parse for: {url}")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            file_stream = io.BytesIO(resp.content)
            reader = PyPDF2.PdfReader(file_stream)
            text = ""
            print(f"Number of pages: {len(reader.pages)}")
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                print(f"Page {i+1} length: {len(page_text)} chars")
                text += page_text + "\n"
            return text
    except Exception as e:
        print(f"Error: {e}")
        return ""

if __name__ == "__main__":
    url = "https://ppptzmmecvjuvbulvddh.supabase.co/storage/v1/object/public/test-folder/1770121231256_Performance_Improvement_Policy.pdf"
    full_text = asyncio.run(test_parse(url))
    print(f"\nTOTAL EXTRACTED LENGTH: {len(full_text)} characters")
    print("--- FIRST 500 CHARS ---")
    print(full_text[:500])
