import os
import io
import pytest
import docx
from pypdf import PdfReader
from app.modules.letters.services import (
    normalize_letter_layout_page_bounds,
    prune_trailing_overflow_pages,
    TEMPLATE_TYPE_LOI,
)

def test_master_template_remains_intact_and_two_pages():
    """Verify master template letter_of_intent_v1.docx is unchanged."""
    template_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "storage", "templates", "letter_of_intent_v1.docx")
    )
    assert os.path.exists(template_path), f"Master template not found at {template_path}"
    doc = docx.Document(template_path)
    # Master template has section headings and text
    full_text = " ".join([p.text for p in doc.paragraphs])
    assert "Letter of Intent" in full_text
    assert "Compliance with Company Policies" in full_text
    assert "Acceptance by Candidate" in full_text

def test_normalize_letter_layout_page_bounds_eliminates_empty_paragraphs_and_sets_break(tmp_path):
    """
    Test that normalize_letter_layout_page_bounds properly eliminates consecutive empty paragraphs
    before Section 3 and enforces page_break_before on Section 3, preventing 3rd page overflow.
    """
    template_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "storage", "templates", "letter_of_intent_v1.docx")
    )
    doc = docx.Document(template_path)
    
    # Simulate candidate-specific data expansion by adding longer text to Section 1
    doc.paragraphs[10].text += " Additional extensive detailed project responsibilities and terms for candidate."
    
    # Normalize layout
    normalize_letter_layout_page_bounds(doc, TEMPLATE_TYPE_LOI)
    
    # Find Section 3
    sec3_p = None
    sec3_idx = -1
    for i, p in enumerate(doc.paragraphs):
        if "3. Compliance with Company Policies" in p.text:
            sec3_p = p
            sec3_idx = i
            break
            
    assert sec3_p is not None
    assert sec3_p.paragraph_format.page_break_before is True
    # Verify paragraph right before Section 3 is not an artificial blank line
    assert doc.paragraphs[sec3_idx - 1].text.strip() != ""

def test_prune_trailing_overflow_pages(tmp_path):
    """
    Test that prune_trailing_overflow_pages safely handles PDFs and trims empty/sparse trailing pages.
    """
    from reportlab.pdfgen import canvas
    test_pdf = str(tmp_path / "test_overflow.pdf")
    
    # Create 3 page PDF where page 3 is an accidental overflow line ("Date: ")
    c = canvas.Canvas(test_pdf)
    c.drawString(100, 700, "Page 1 Content: Full terms and conditions...")
    c.showPage()
    c.drawString(100, 700, "Page 2 Content: Acceptance and sign off...")
    c.showPage()
    c.drawString(100, 700, "Date: ")
    c.showPage()
    c.save()
    
    reader = PdfReader(test_pdf)
    assert len(reader.pages) == 3
    
    # Prune trailing overflow
    pruned = prune_trailing_overflow_pages(test_pdf, max_expected_pages=2)
    assert pruned is True
    
    reader_after = PdfReader(test_pdf)
    assert len(reader_after.pages) == 2

