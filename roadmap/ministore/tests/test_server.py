"""Tests for the MiniStore server.

Milestone 1's tests are real and passing: they start the server on an ephemeral
port in a background thread, connect a normal socket client, and assert.

This start-a-server-then-connect pattern is exactly how CodeCrafters' own test
harness works — getting comfortable reading and writing it here pays off the
moment a stage fails in week 3.

Run from the project root (roadmap/ministore/):  pytest
"""

import socket
import threading

import pytest

from ministore.server import MiniStore


@pytest.fixture
def port():
    """Start a server on a free port; yield the port; tear it down."""
    server = MiniStore(host="127.0.0.1", port=0)  # port 0 -> OS picks a free one
    bound_port = server.listen()
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield bound_port
    server.close()
    thread.join(timeout=1)


def connect(port: int) -> socket.socket:
    client = socket.create_connection(("127.0.0.1", port), timeout=2)
    client.settimeout(2)
    return client


# --- Milestone 1: the echo server -------------------------------------------


def test_echoes_bytes_back(port):
    with connect(port) as client:
        client.sendall(b"hello world")
        assert client.recv(1024) == b"hello world"


def test_echoes_across_multiple_writes(port):
    with connect(port) as client:
        client.sendall(b"foo")
        assert client.recv(1024) == b"foo"
        client.sendall(b"bar")
        assert client.recv(1024) == b"bar"


# --- Milestones 2-4: write these as you go ----------------------------------
# Uncomment and flesh out once the line protocol exists. A helper that sends a
# command and reads one reply line keeps these readable:


def roundtrip(client, line: str) -> str:
    client.sendall(line.encode() + b"\n")
    return client.recv(1024).decode().rstrip("\n")


def test_ping(port):  # M2
    with connect(port) as client:
        assert roundtrip(client, "PING") == "PONG"


def test_echo(port):  # M2
    with connect(port) as client:
        assert roundtrip(client, "ECHO hello") == "hello"


def test_set_then_get(port):  # M3
    with connect(port) as client:
        assert roundtrip(client, "SET name sean") == "OK"
        assert roundtrip(client, "GET name") == "sean"


def test_get_missing_is_nil(port):  # M3
    with connect(port) as client:
        assert roundtrip(client, "GET nope") == "(nil)"


def test_key_expires(port):  # M4  (uses a short TTL)
    with connect(port) as client:
        assert roundtrip(client, "SET tmp v EX 1") == "OK"
        assert roundtrip(client, "GET tmp") == "v"
        time.sleep(1.1)
        assert roundtrip(client, "GET tmp") == "(nil)"
