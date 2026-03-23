
import sys

try:
    import pypdf
except ImportError:
    try:
        import PyPDF2 as pypdf
    except ImportError:
        print("MISSING_LIBRARY")
        sys.exit(1)

def extract_text(pdf_path):
    try:
        reader = pypdf.PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return None

if __name__ == "__main__":
    pdf_path = r"c:\Users\vardh\Downloads\The_Plan.pdf"
    text = extract_text(pdf_path)
    if text:
        print(text)
    else:
        sys.exit(1)
