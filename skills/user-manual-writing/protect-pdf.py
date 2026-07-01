#!/usr/bin/env python3
"""Protect a PDF: set author metadata + AES-256 encryption (opens without a user password)."""
import argparse
import secrets
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Missing dependency. Run: pip install pymupdf", file=sys.stderr)
    sys.exit(2)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", help="defaults to overwriting --input")
    p.add_argument("--author", required=True)
    p.add_argument("--owner-password", default=None, help="restricts edit/print without one; auto-generated if omitted")
    p.add_argument("--allow-copy", action="store_true", default=False)
    p.add_argument("--allow-modify", action="store_true", default=False)
    args = p.parse_args()

    output = args.output or args.input

    doc = fitz.open(args.input)
    meta = doc.metadata or {}
    meta["author"] = args.author
    doc.set_metadata(meta)

    perm = fitz.PDF_PERM_PRINT | fitz.PDF_PERM_PRINT_HQ
    if args.allow_copy:
        perm |= fitz.PDF_PERM_COPY
    if args.allow_modify:
        perm |= fitz.PDF_PERM_MODIFY

    owner_pw = args.owner_password or secrets.token_urlsafe(24)
    if not args.owner_password:
        print("No --owner-password given — generated one, not persisted anywhere.", file=sys.stderr)

    doc.save(
        output,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw=owner_pw,
        user_pw="",  # empty user password: opens without a prompt
        permissions=perm,
    )
    print(f"Protected: {output}")


if __name__ == "__main__":
    main()
