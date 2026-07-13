"""The TCP server.

Milestone 1 (DONE): bind a socket, accept connections in a loop, and echo
whatever bytes a client sends straight back. One client at a time.

Later milestones turn this echo server into a key/value store. The TODO markers
below show exactly where each one slots in — and which Redis stage it mirrors.
Run it with:  python -m ministore.server
"""

import socket

from ministore import protocol

HOST = "127.0.0.1"
DEFAULT_PORT = 4000


class MiniStore:
    """A single-threaded TCP server.

    Lifecycle:  listen()  ->  serve_forever()  ->  close()
    Bind to port 0 to let the OS pick a free port (handy in tests); the real
    port is then available as ``self.port`` after ``listen()``.
    """

    def __init__(self, host: str = HOST, port: int = DEFAULT_PORT):
        self.host = host
        self.port = port
        self._sock: socket.socket | None = None
        # TODO M3: give the server a store, e.g.  self.store = Store()
        #          (from ministore.store import Store)

    def listen(self) -> int:
        """Create the listening socket and start accepting. Returns the port."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # Without SO_REUSEADDR you hit "Address already in use" for a minute
        # every time you restart the server. This is a classic gotcha.
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((self.host, self.port))
        sock.listen()
        self._sock = sock
        # If we bound to port 0, the OS chose a real port for us — capture it.
        self.port = sock.getsockname()[1]
        return self.port

    def serve_forever(self) -> None:
        """Accept connections until the listening socket is closed."""
        if self._sock is None:
            raise RuntimeError("call listen() before serve_forever()")
        while True:
            try:
                conn, addr = self._sock.accept()
            except OSError:
                # The listening socket was closed (close() called) — stop.
                break
            # `with conn:` guarantees the client socket is closed afterward.
            with conn:
                self._handle(conn)

    def _handle(self, conn: socket.socket) -> None:
        """Handle one connected client.

        Milestone 1: echo raw bytes back until the client disconnects.
        """
        buffer = bytearray()
        while True:
            data = conn.recv(4096)
            if not data:
                # recv() returns b"" when the client has closed the connection.
                return


            # TODO M2 — Speak the line protocol instead of echoing.
            #   Replace the echo above with:
            #     1. append `data` to a per-connection bytearray buffer
            #     2. while the buffer contains b"\n", split off one line
            #     3. decode the line, hand it to protocol.parse_command(...)
            #     4. dispatch on the command name, send protocol.encode_reply(...)
            #   Start with PING -> "PONG" and ECHO <text> -> "<text>".
            #   (mirrors Redis stages 2-3)
            
            buffer += data

            while b"\n" in buffer:
                foundIndex = buffer.find(b"\n")
                line = buffer[:foundIndex]
                del buffer[:foundIndex + 1]

                name, arg = protocol.parse_command(line.decode())
                
                if name == "PING":
                    conn.send(protocol.encode_reply("PONG"))
                if name == "ECHO":
                    text = " ".join(arg)
                    conn.sendall(protocol.encode_reply(text))
            
            # TODO M3 — Add SET / GET / DEL backed by self.store (ministore.store).
            #   (mirrors Redis SET/GET)

            
            
            # TODO M4 — Support `SET k v EX <seconds>` and expire keys lazily on
            #   read. (mirrors Redis key expiry)

    def close(self) -> None:
        """Close the listening socket (also unblocks serve_forever())."""
        if self._sock is not None:
            self._sock.close()
            self._sock = None


def main() -> None:
    server = MiniStore(port=DEFAULT_PORT)
    port = server.listen()
    print(f"MiniStore listening on {HOST}:{port}  (Ctrl-C to stop)")
    print(f"Try it:  nc {HOST} {port}   then type anything and press Enter")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")
    finally:
        server.close()

    # TODO M5 — Handle many clients at once.
    #   Right now serve_forever() handles one client fully before accept()ing the
    #   next, so a second `nc` session blocks. Two ways to fix it:
    #     (a) threading: spawn  threading.Thread(target=self._handle, args=(conn,))
    #         per connection (don't use `with conn` then — let the thread own it).
    #     (b) selectors: a single-threaded event loop with selectors.DefaultSelector,
    #         registering the listen socket + each client for READ readiness.
    #   (a) is the quick win; (b) is closer to how a real server is built and a
    #   great thing to have wrestled with before Redis stage 4 ("concurrent clients").


if __name__ == "__main__":
    main()
