#!/bin/bash

# Check if pdftotext is installed
if ! command -v pdftotext >/dev/null 2>&1; then
    echo "Error: pdftotext is not installed. Please install it (e.g., sudo apt install poppler-utils) and try again."
    exit 1
fi

PDF_URL="https://www.riverside.courts.ca.gov/system/files/general/counselingresourcelist.pdf"
PDF_FILE="lmft.pdf"
TEXT_FILE="lmft.txt"

echo "Downloading PDF..."
curl -s -o "$PDF_FILE" "$PDF_URL"
if [ $? -ne 0 ]; then
    echo "Error downloading PDF."
    exit 1
fi

echo "Converting PDF to text..."
pdftotext "$PDF_FILE" "$TEXT_FILE"
if [ $? -ne 0 ]; then
    echo "Error converting PDF to text."
    exit 1
fi

TEMP_FILE=$(mktemp)

echo "Extracting LMFT names and assigning review scores..."
while IFS= read -r line; do
    if echo "$line" | grep -q "LMFT"; then
        # Extract the name (text before the first comma) and trim whitespace
        name=$(echo "$line" | cut -d',' -f1 | xargs)
        # Generate a dummy review score between 3.5 and 5.0 using awk with a random seed
        score=$(awk -v seed=$RANDOM 'BEGIN { srand(seed); printf "%.2f", 3.5 + rand()*1.5 }')
        echo -e "$score\t$name" >> "$TEMP_FILE"
    fi
done < "$TEXT_FILE"

if [ ! -s "$TEMP_FILE" ]; then
    echo "No LMFT names found in the PDF."
    rm "$TEMP_FILE"
    exit 0
fi

echo "Sorting therapists by review score..."
sort -nr "$TEMP_FILE" -o "$TEMP_FILE"

echo "\nTop LMFTs based on review scores (dummy scores):"
head -n 5 "$TEMP_FILE" | while IFS=$'\t' read -r score name; do
    echo "$name - Review Score: $score"
done

rm "$TEMP_FILE" 