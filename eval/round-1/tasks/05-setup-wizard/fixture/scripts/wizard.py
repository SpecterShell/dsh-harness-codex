#!/usr/bin/env python3
"""Interactive project setup wizard."""

import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config"


def ask(label, default=None):
    suffix = f" [{default}]" if default is not None else ""
    while True:
        value = input(f"{label}{suffix}: ").strip()
        if value:
            return value
        if default is not None:
            return default
        print("A value is required.")


def ask_yes_no(label, default=False):
    suffix = " [Y/n]" if default else " [y/N]"
    while True:
        value = input(f"{label}{suffix}: ").strip().lower()
        if not value:
            return default
        if value in ("y", "yes"):
            return True
        if value in ("n", "no"):
            return False
        print("Please answer y or n.")


def main():
    name = ask("Project name")
    region = ask("Region", "us-east-1")
    metrics = ask_yes_no("Enable metrics?")

    install_id = secrets.token_hex(6)
    CONFIG.mkdir(parents=True, exist_ok=True)
    text = (
        f'name = "{name}"\n'
        f'region = "{region}"\n'
        f"metrics = {'true' if metrics else 'false'}\n"
        f'install_id = "{install_id}"\n'
    )
    (CONFIG / "project.toml").write_text(text, encoding="utf-8")
    print(f"wrote config/project.toml for {name} ({install_id})")


if __name__ == "__main__":
    main()
