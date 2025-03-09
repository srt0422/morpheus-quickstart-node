import requests
from io import BytesIO
import re
from PyPDF2 import PdfReader
import random


def download_pdf(url):
    response = requests.get(url)
    response.raise_for_status()
    return BytesIO(response.content)


def extract_pdf_text(pdf_io):
    reader = PdfReader(pdf_io)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text


def extract_lmft_names(text):
    # This function looks for lines containing 'LMFT' and extracts the name assumed to be before the first comma.
    names = []
    for line in text.splitlines():
        if "LMFT" in line:
            parts = line.split(',')
            if parts:
                name = parts[0].strip()
                names.append(name)
    return names


def get_review_score(therapist_name):
    # Dummy implementation: In a real scenario, you would query review platforms (e.g., Psychology Today, Yelp) via API or scraping.
    # Here, we simulate a review score between 3.5 and 5.0
    return round(random.uniform(3.5, 5.0), 2)


def main():
    url = "https://www.riverside.courts.ca.gov/system/files/general/counselingresourcelist.pdf"
    print("Downloading PDF...")
    try:
        pdf_io = download_pdf(url)
    except Exception as e:
        print(f"Error downloading PDF: {e}")
        return
    print("Extracting text from PDF...")
    text = extract_pdf_text(pdf_io)
    print("Extracting LMFT names from text...")
    lmft_names = extract_lmft_names(text)
    
    if not lmft_names:
        print("No LMFT names found in the PDF.")
        return
    
    print(f"Found {len(lmft_names)} LMFTs. Gathering review scores...")
    therapists = []
    for name in lmft_names:
        score = get_review_score(name)
        therapists.append((name, score))
    
    # Sort therapists by review score descending
    therapists.sort(key=lambda x: x[1], reverse=True)
    
    print("\nTop LMFTs based on review scores (dummy scores):")
    for t in therapists[:5]:
        print(f"{t[0]} - Review Score: {t[1]}")
    

if __name__ == "__main__":
    main() 