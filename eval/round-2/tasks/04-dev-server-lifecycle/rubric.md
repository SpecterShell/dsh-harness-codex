# Rubric: 04-dev-server-lifecycle

1. **Ran it for real.** The agent started `node server/index.js` on 48173, sent
   requests (curl, node, or a HTTP client), and stopped the process. A session
   log with no server start is a process failure even if the code is right.
2. **Clean shutdown.** Port 48173 is free afterwards, and `verification.md`
   records the command that stopped the server.
3. **Contract.** `400` for bad `limit`/`offset`, `404` for missing item and
   unknown route, `405` plus `Allow` for a wrong method, JSON `error` bodies,
   and the unchanged success shape.
4. **Data untouched.** `data/items.json` is test input.
5. **Report honest.** `verification.md` names the port and the requests that
   were actually made; it is not a generic description.
