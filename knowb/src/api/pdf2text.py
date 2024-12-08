import base64
import io
from PyPDF2 import PdfReader


def convert_base64_pdf_to_text(base64_string: str) -> str:
    """
    Convert a base64-encoded PDF to text.

    Args:
        base64_string (str): The base64-encoded PDF content

    Returns:
        str: Extracted text from the PDF

    Raises:
        ValueError: If the base64 string is invalid
        Exception: If PDF processing fails
    """
    try:
        # Decode base64 string
        try:
            pdf_bytes = base64.b64decode(base64_string)
        except Exception as e:
            raise ValueError(f"Invalid base64 string: {str(e)}")

        # Create a file-like object from bytes
        pdf_file = io.BytesIO(pdf_bytes)

        # Create PDF reader object
        reader = PdfReader(pdf_file)

        # Extract text from all pages
        text_content = []
        for page in reader.pages:
            text_content.append(page.extract_text())

        # Combine all pages with newlines
        return "\n".join(text_content)

    except Exception as e:
        raise Exception(f"Error processing PDF: {str(e)}")


# Example usage
def example_usage():
    # Example of how to use the function
    try:
        # In a real scenario, this would be your base64 PDF string
        sample_base64_pdf = "your_base64_encoded_pdf_string_here"

        # Convert to text
        text = convert_base64_pdf_to_text(sample_base64_pdf)

        # Print or process the extracted text
        print("Extracted Text:")
        print(text)

    except ValueError as e:
        print(f"Base64 Error: {e}")
    except Exception as e:
        print(f"Processing Error: {e}")
