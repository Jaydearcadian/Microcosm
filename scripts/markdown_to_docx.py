#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from sys import argv, exit
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


def parse_markdown(text: str) -> list[tuple[str, str]]:
    paragraphs: list[tuple[str, str]] = []
    in_code = False
    number = 1

    for raw in text.splitlines():
        line = raw.rstrip("\n")
        stripped = line.strip()

        if stripped.startswith("```"):
            in_code = not in_code
            continue

        if in_code:
            paragraphs.append(("Code", line))
            continue

        if not stripped:
            paragraphs.append(("Normal", ""))
            continue

        if stripped.startswith("# "):
            number = 1
            paragraphs.append(("Heading1", stripped[2:].strip()))
            continue

        if stripped.startswith("## "):
            number = 1
            paragraphs.append(("Heading2", stripped[3:].strip()))
            continue

        if stripped.startswith("### "):
            number = 1
            paragraphs.append(("Heading3", stripped[4:].strip()))
            continue

        if stripped.startswith("- "):
            paragraphs.append(("ListBullet", stripped[2:].strip()))
            continue

        if len(stripped) > 3 and stripped[0].isdigit() and stripped[1:3] == ". ":
            paragraphs.append(("ListNumber", f"{number}. {stripped[3:].strip()}"))
            number += 1
            continue

        number = 1
        paragraphs.append(("Normal", line))

    return paragraphs


def build_document_xml(paragraphs: list[tuple[str, str]]) -> str:
    styles = {
        "Normal": ("Arial", 21, False),
        "Heading1": ("Arial", 32, True),
        "Heading2": ("Arial", 26, True),
        "Heading3": ("Arial", 22, True),
        "ListBullet": ("Arial", 21, False),
        "ListNumber": ("Arial", 21, False),
        "Code": ("Courier New", 19, False),
    }

    xml_parts: list[str] = []

    for style, text in paragraphs:
        font, size, bold = styles[style]
        content = f"• {text}" if style == "ListBullet" and text else text
        text_xml = escape(content)
        rpr = (
            f'<w:rPr><w:rFonts w:ascii="{font}" w:hAnsi="{font}"/>'
            f'<w:sz w:val="{size}"/>'
            + ("<w:b/>" if bold else "")
            + "</w:rPr>"
        )

        if style == "Heading1":
            ppr = '<w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>'
        elif style == "Heading2":
            ppr = '<w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>'
        elif style == "Heading3":
            ppr = '<w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr>'
        elif style in ("ListBullet", "ListNumber"):
            ppr = '<w:pPr><w:spacing w:after="40"/></w:pPr>'
        elif style == "Code":
            ppr = '<w:pPr><w:shd w:fill="F3F3F3"/><w:spacing w:after="20"/></w:pPr>'
        else:
            ppr = '<w:pPr><w:spacing w:after="60"/></w:pPr>'

        if content:
            run = f'<w:r>{rpr}<w:t xml:space="preserve">{text_xml}</w:t></w:r>'
        else:
            run = "<w:r><w:t></w:t></w:r>"

        xml_parts.append(f"<w:p>{ppr}{run}</w:p>")

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    {"".join(xml_parts)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1080" w:right="1296" w:bottom="1080" w:left="1296" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""


def write_docx(source: Path, target: Path) -> None:
    paragraphs = parse_markdown(source.read_text(encoding="utf-8"))
    document_xml = build_document_xml(paragraphs)
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

    core = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{escape(source.stem)}</dc:title>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>
</cp:coreProperties>"""

    app = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
</Properties>"""

    target.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(target, "w", ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("docProps/core.xml", core)
        zf.writestr("docProps/app.xml", app)
        zf.writestr("word/document.xml", document_xml)


def main() -> int:
    if len(argv) < 2:
      print("usage: markdown_to_docx.py <source.md> [target.docx]")
      return 1

    source = Path(argv[1]).resolve()
    target = Path(argv[2]).resolve() if len(argv) > 2 else source.with_suffix(".docx")
    write_docx(source, target)
    print(target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
