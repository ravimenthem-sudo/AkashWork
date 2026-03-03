
import sys
import os

print("Starting extraction script...", file=sys.stderr)

try:
    import pypdf
    print("pypdf imported successfully", file=sys.stderr)
except ImportError:
    try:
        import PyPDF2 as pypdf
        print("PyPDF2 imported successfully", file=sys.stderr)
    except ImportError:
        print("MISSING_LIBRARY", file=sys.stderr)
        sys.exit(1)

def extract_text(pdf_path):
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}", file=sys.stderr)
        return None
        
    try:
        print(f"Attempting to read: {pdf_path}", file=sys.stderr)
        reader = pypdf.PdfReader(pdf_path)
        print(f"Number of pages: {len(reader.pages)}", file=sys.stderr)
        text = ""
        for i, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text()
                print(f"Page {i}: extracted {len(page_text)} chars", file=sys.stderr)
                text += page_text + "\n"
            except Exception as e:
                print(f"Error extracting page {i}: {e}", file=sys.stderr)
        return text
    except Exception as e:
        print(f"Error initializing reader: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    pdf_path = r"c:\Users\vardh\Downloads\The_Plan.pdf"
    print(f"Processing {pdf_path}", file=sys.stderr)
    
    text = extract_text(pdf_path)
    
    if text:
        with open("extracted_text.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print("Text written to extracted_text.txt", file=sys.stderr)
    else:
        print("No text extracted or error occurred", file=sys.stderr)
        sys.exit(1)
