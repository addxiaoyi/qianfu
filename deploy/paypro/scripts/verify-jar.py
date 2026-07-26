#!/usr/bin/env python3
from __future__ import annotations

import argparse
import tempfile
from pathlib import Path
from zipfile import ZipFile

QR_PREFIX = "BOOT-INF/classes/static/assets/qr/"
STATIC_PREFIX = "BOOT-INF/classes/static/"
HEALTH_CLASS = "BOOT-INF/classes/com/wendao/controller/HealthController.class"
APPLICATION_CONFIG = "BOOT-INF/classes/application.yml"


def verify_jar(jar_path: Path) -> tuple[int, int]:
    if not jar_path.is_file():
        raise FileNotFoundError(f"PayPro JAR not found: {jar_path}")

    with ZipFile(jar_path, "r") as source:
        names = source.namelist()
        required = [HEALTH_CLASS, APPLICATION_CONFIG]
        missing = [name for name in required if name not in names]
        if missing:
            raise RuntimeError(f"JAR is missing required entries: {', '.join(missing)}")

        static_count = sum(name.startswith(STATIC_PREFIX) and not name.endswith("/") for name in names)
        if static_count == 0:
            raise RuntimeError("JAR contains no static application assets")

        bundled_qr_count = sum(name.startswith(QR_PREFIX) and not name.endswith("/") for name in names)

        handle = tempfile.NamedTemporaryFile(
            prefix="paypro-sanitized-",
            suffix=".jar",
            dir=jar_path.parent,
            delete=False,
        )
        sanitized_path = Path(handle.name)
        handle.close()

        try:
            with ZipFile(sanitized_path, "w") as target:
                for info in source.infolist():
                    if info.filename.startswith(QR_PREFIX):
                        continue
                    target.writestr(info, source.read(info.filename))

            with ZipFile(sanitized_path, "r") as sanitized:
                corrupt_entry = sanitized.testzip()
                if corrupt_entry is not None:
                    raise RuntimeError(f"Sanitized JAR has a corrupt entry: {corrupt_entry}")
                if any(name.startswith(QR_PREFIX) for name in sanitized.namelist()):
                    raise RuntimeError("Sanitized JAR still contains bundled QR assets")
                if HEALTH_CLASS not in sanitized.namelist():
                    raise RuntimeError("Sanitized JAR lost the health endpoint class")
        finally:
            sanitized_path.unlink(missing_ok=True)

    return bundled_qr_count, static_count


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify PayPro JAR and the Docker QR sanitization contract")
    parser.add_argument("jar", type=Path, help="Path to paypro.jar")
    args = parser.parse_args()

    qr_count, static_count = verify_jar(args.jar.resolve())
    print(f"jar={args.jar}")
    print(f"static_files={static_count}")
    print(f"bundled_qr_files_removed_by_image={qr_count}")
    print("sanitized_qr_files=0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
