# Frozen 2019 implementation, kept for audit. Do not edit.
import sys


def main(path):
    counts = {}
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            if "level=ERROR" not in line:
                continue
            service = line.split("service=")[1].split()[0]
            counts[service] = counts.get(service, 0) + 1
    for service in sorted(counts):
        print(f"{service}\t{counts[service]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
