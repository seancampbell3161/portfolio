# MiniStore

A tiny **line-based TCP key/value server** — your week-0 Python warm-up before the
CodeCrafters "Build Your Own Redis" build.

It's a stripped-down Redis with a trivial text protocol instead of RESP. The goal
isn't to clone Redis; it's to meet Python's socket, bytes, and concurrency
primitives **once**, against a protocol simple enough that you designed it
yourself — so that in week 3 the real RESP parsing is the *only* new thing you're
fighting.

You'll poke at it with `nc`, no client to build:

```
PING            -> PONG
ECHO hello      -> hello
SET name sean   -> OK
GET name        -> sean
SET tmp v EX 10 -> OK        (expires in 10s)
DEL name        -> 1
```

Milestone 1 (an echo server + a passing test) is already done. Milestones 2–6 are
yours — every TODO in the code tells you which file to edit and which Redis stage
it mirrors.

---

## Layout

```
ministore/
├── ministore/            ← the package
│   ├── server.py         M1 done (echo); TODOs for M2–M5
│   ├── protocol.py       M2 stub — the line protocol
│   └── store.py          M3–M4 stub — the in-memory store + expiry
├── tests/
│   └── test_server.py    M1 tests passing; M2–M4 tests sketched, commented out
├── pyproject.toml        pytest config
└── README.md
```

## Setup (first time)

You've not built in Python before, so the one ritual to learn is the **virtual
environment** — a per-project sandbox for dependencies.

```bash
cd roadmap/ministore

python3 -m venv .venv          # create the sandbox
source .venv/bin/activate      # activate it (prompt gains a "(.venv)")
pip install pytest             # the only dependency
```

(Next time, you just need `source .venv/bin/activate`. `deactivate` when done.)

## Run the server

```bash
python -m ministore.server
```

Then in another terminal, talk to it:

```bash
nc 127.0.0.1 4000
hello there        # type this, press Enter
hello there        # the server echoes it back
```

`Ctrl-C` stops the server, `Ctrl-C` (or `Ctrl-D`) quits `nc`.

## Run the tests

```bash
pytest
```

You should see **2 passed**. That's milestone 1 verified. As you build, uncomment
the next test in `tests/test_server.py`, watch it fail, then make it pass — that's
the loop you'll live in on CodeCrafters.

---

## The milestones

Each is roughly one ~2-hour session. 1–4 are the core; 5–6 are the stretch. Do them
in order — each maps onto an early Redis stage, so finishing them means week 3
starts with muscle memory instead of a blank page.

- [x] **M1 · An echo server** — `server.py`
  Bind a socket, accept connections, echo bytes back.
  *Learned:* `socket` bind/listen/accept, `recv`/`sendall`, bytes↔str, project
  layout, `python -m`, pytest.
  *Mirrors:* Redis stage 1 (TCP listener + accept loop).

- [ ] **M2 · Speak the line protocol** — `protocol.py`, then `server.py::_handle`
  Buffer incoming bytes until `\n`, parse one command, dispatch. Implement
  `PING -> PONG` and `ECHO <text> -> <text>`.
  TODOs: fill in `parse_command` and `encode_reply` in `protocol.py`; replace the
  echo in `_handle` with buffer → split on `\n` → parse → reply.
  *Watch for:* a single `recv` may return half a command or two commands at once —
  that's why you buffer. *Mirrors:* Redis stages 2–3.

- [ ] **M3 · SET / GET / DEL** — `store.py`, wired into `server.py`
  Back the server with a `Store` (a dict). `SET k v -> OK`, `GET k -> value` or
  `(nil)`, `DEL k -> 1/0`.
  TODOs: implement `Store.set/get/delete`; construct `self.store` in
  `MiniStore.__init__`; add the three commands to your dispatch.
  *Mirrors:* Redis SET/GET.

- [ ] **M4 · Expiry (TTL)** — `store.py`
  `SET k v EX <seconds>`; expire keys **lazily** on read using `time.monotonic()`
  (the same trick Redis uses — it expires on access, not on a timer).
  TODOs: track deadlines in `Store`; in `get`, drop the key if its deadline
  passed; parse the optional `EX <n>` in your SET command.
  *Mirrors:* Redis key expiry.

- [ ] **M5 · Many clients at once** — `server.py`
  Right now a second `nc` session blocks behind the first. Fix it — start with a
  `threading.Thread` per connection, then (stretch) rewrite as a single-threaded
  event loop with `selectors`.
  TODO: see the block at the bottom of `server.py`.
  *Mirrors:* Redis stage 4 (concurrent connections).

- [ ] **M6 · (stretch) Round out the tests**
  Uncomment the M2–M4 tests in `test_server.py` as you go, and add your own for the
  edge cases (missing key, expired key, unknown command). Testing a socket server
  *is* the CodeCrafters skill.

### Deliberately out of scope

Keep it small — these are later milestones in the real roadmap, not here:
RESP / any real Redis wire format (save it for week 3), persistence (RDB/AOF),
replication, a custom client (use `nc`), and `asyncio` (threading or `selectors`
is plenty and closer to what you'll actually write).

### Done when

You can `nc` in, run `SET`/`GET`/`DEL` with a TTL that actually expires, open two
`nc` sessions at once without one blocking the other, and `pytest` is green.
That's every primitive Redis stage 1–4 needs — already in your hands.
