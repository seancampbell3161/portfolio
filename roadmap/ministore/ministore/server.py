"""The TCP server.

Milestone 1 (DONE): bind a socket, accept connections in a loop, and echo
whatever bytes a client sends straight back. One client at a time.

Later milestones turn this echo server into a key/value store. The TODO markers
below show exactly where each one slots in — and which Redis stage it mirrors.
Run it with:  python -m ministore.server
"""

import socket
import selectors

from ministore import protocol
from ministore import store

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
        self._store = store.Store()
        self.sel = selectors.DefaultSelector()

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

        self.sel.register(fileobj=self._sock, events=selectors.EVENT_READ)
        while True:
            try:
                events = self.sel.select()

                for key, mask in events:
                    if key.fileobj == self._sock: #listening socket
                        conn, addr = self._sock.accept()
                        conn.setblocking(False)
                        self.sel.register(fileobj=conn, events=selectors.EVENT_READ, data=bytearray())
                    else: # client socket
                        if key.data == b"":
                            self.sel.unregister(key.fileobj)
                            
                        self._handle(key.fileobj, key.data)
                    
                # thread = threading.Thread(target=self._handle, args=(conn,))
                # thread.start()

            except OSError:
                # The listening socket was closed (close() called) — stop.
                break
            # `with conn:` guarantees the client socket is closed afterward.
            # with conn:
            #     self._handle(conn)

    def _handle(self, conn, buffer) -> None:
        data = conn.recv(4096)

        buffer += data

        while b"\n" in buffer:
            foundIndex = buffer.find(b"\n")
            line = buffer[:foundIndex]
            del buffer[:foundIndex + 1]

            res = None

            name, args = protocol.parse_command(line.decode())
            
            if name == "PING":
                res = "PONG"
            elif name == "ECHO":
                text = " ".join(args)
                res = text            
            elif name == "SET":
                if args[-2] == "EX" and args[-1].isdigit():
                    index = len(args) - 2
                    res = self._store.set(args[0], " ".join(args[1:index]), float(args[-1]))
                else:
                    res = self._store.set(args[0], " ".join(args[1:]))
            elif name == "GET":
                res = self._store.get(args[0])
            elif name == "DEL":
                res = self._store.delete(args[0])

            conn.sendall(protocol.encode_reply(res))
        return


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
    #   Right now serve_forever() handles one client fully before accepting the
    #   next, so a second `nc` session blocks. Two ways to fix it:
    #     (a) threading: spawn  threading.Thread(target=self._handle, args=(conn,))
    #         per connection (don't use `with conn` then — let the thread own it).
    #     (b) selectors: a single-threaded event loop with selectors.DefaultSelector,
    #         registering the listen socket + each client for READ readiness.
    #   (a) is the quick win; (b) is closer to how a real server is built and a
    #   great thing to have wrestled with before Redis stage 4 ("concurrent clients").


if __name__ == "__main__":
    main()
