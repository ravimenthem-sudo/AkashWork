import PyPDF2
from binding.utils import chunk_text

def test_local_pdf():
    print("📄 Testing Local PDF Extraction & Chunking")
    file_path = "test_policy.pdf"
    
    try:
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            print(f"Number of pages: {len(reader.pages)}")
            
            full_text = ""
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                print(f"Page {i+1} extracted: {len(page_text)} chars")
                full_text += page_text + "\n"
                
            print(f"\nTotal extracted text length: {len(full_text)} chars")
            
            # Now test chunking
            chunks = chunk_text(full_text)
            print(f"Number of chunks generated: {len(chunks)}")
            
            for i, c in enumerate(chunks):
                print(f"Chunk {i+1} length: {len(c)} chars")
                print(f"Preview: {c[:100]}...")
                print("-" * 20)
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_local_pdf()
