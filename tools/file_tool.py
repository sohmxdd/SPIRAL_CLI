"""
SPIRAL File Tool
Read, write, and list files in the workspace.
"""

import os
from typing import Optional


def read_file(path: str) -> str:
    """
    Read file contents.

    Args:
        path: Absolute or relative file path

    Returns:
        File contents as string, or error message
    """
    try:
        abs_path = os.path.abspath(path)
        if not os.path.exists(abs_path):
            return f"[FILE_ERROR] File not found: {abs_path}"
        if not os.path.isfile(abs_path):
            return f"[FILE_ERROR] Not a file: {abs_path}"

        with open(abs_path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    except Exception as e:
        return f"[FILE_ERROR] {str(e)}"


def write_file(path: str, content: str) -> str:
    """
    Write content to a file. Creates directories if needed.

    Args:
        path: Absolute or relative file path
        content: Content to write

    Returns:
        Success/error message
    """
    try:
        abs_path = os.path.abspath(path)
        dir_name = os.path.dirname(abs_path)

        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)

        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return f"[FILE_OK] Written: {abs_path} ({len(content)} chars)"
    except Exception as e:
        return f"[FILE_ERROR] {str(e)}"


def append_file(path: str, content: str) -> str:
    """
    Append content to a file.

    Args:
        path: File path
        content: Content to append

    Returns:
        Success/error message
    """
    try:
        abs_path = os.path.abspath(path)
        with open(abs_path, 'a', encoding='utf-8') as f:
            f.write(content)
        return f"[FILE_OK] Appended to: {abs_path}"
    except Exception as e:
        return f"[FILE_ERROR] {str(e)}"


def list_files(directory: str = ".", extensions: list = None) -> str:
    """
    List files in a directory recursively.

    Args:
        directory: Directory path
        extensions: Filter by extensions (e.g., ['.py', '.js'])

    Returns:
        Formatted file listing
    """
    try:
        abs_dir = os.path.abspath(directory)
        if not os.path.isdir(abs_dir):
            return f"[FILE_ERROR] Not a directory: {abs_dir}"

        files = []
        for root, dirs, filenames in os.walk(abs_dir):
            # Skip hidden and common ignore dirs
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in
                       ['__pycache__', 'node_modules', '.git', 'venv', '.venv']]

            for fname in filenames:
                if fname.startswith('.'):
                    continue
                if extensions and not any(fname.endswith(ext) for ext in extensions):
                    continue
                rel_path = os.path.relpath(os.path.join(root, fname), abs_dir)
                files.append(rel_path)

        if not files:
            return "[FILE_INFO] No files found."

        return "\n".join(sorted(files))
    except Exception as e:
        return f"[FILE_ERROR] {str(e)}"


def file_exists(path: str) -> bool:
    """Check if a file exists."""
    return os.path.isfile(os.path.abspath(path))


def delete_file(path: str) -> str:
    """Delete a file."""
    try:
        abs_path = os.path.abspath(path)
        if not os.path.exists(abs_path):
            return f"[FILE_ERROR] File not found: {abs_path}"
        os.remove(abs_path)
        return f"[FILE_OK] Deleted: {abs_path}"
    except Exception as e:
        return f"[FILE_ERROR] {str(e)}"
