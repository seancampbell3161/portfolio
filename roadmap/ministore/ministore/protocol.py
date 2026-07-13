"""The tiny line protocol.  (Milestone 2)

Commands are newline-delimited UTF-8 text, e.g.  b"SET name sean\\n".
Replies are also newline-terminated, e.g.  b"OK\\n".

Keeping the wire format trivial is the whole point: you get to practice the
buffer-until-a-delimiter / bytes<->str dance without also decoding RESP. Fill
these in during milestone 2, then import them from server.py.
"""

NIL = "(nil)"  # what GET returns for a missing key — pick any sentinel you like


def parse_command(line: str) -> tuple[str, list[str]]:
    """Split one decoded command line into (NAME, args).

    "SET name sean"  ->  ("SET", ["name", "sean"])
    "ping"           ->  ("PING", [])

    TODO M2:
      - strip trailing whitespace / the newline
      - split on spaces
      - upper-case the command name so `ping` and `PING` both work
      - decide what to do with an empty line (return ("", []) is fine)
    """
    if not line:
        return ("", [])

    trimmed = line.strip()
    split = trimmed.split(" ")
    split[0] = split[0].upper()
    return (split[0], split[1:])


def encode_reply(value) -> bytes:
    """Turn a reply value into wire bytes ending in '\\n'.

    "hello" -> b"hello\\n"      None -> b"(nil)\\n"      1 -> b"1\\n"

    TODO M2:
      - handle str, int, and None
      - encode() to UTF-8 bytes and make sure it ends in b"\\n"
    """
    if type(value) is str:
        string = f"{value}\n"
        return string.encode()
    if value is None:
        string = f"{NIL}\n"
        return string.encode()
    if type(value) is int:
        string = f"{value}\n"
        return string.encode()
    return "".encode()
