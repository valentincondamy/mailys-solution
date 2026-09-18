from pypdf import PdfReader

path = r"C:\Users\vcond\Downloads\site-contenu (1).pdf"
reader = PdfReader(path)

for index, page in enumerate(reader.pages, start=1):
    print(f"--- PAGE {index} ---")
    print(page.extract_text() or "")
    print()
