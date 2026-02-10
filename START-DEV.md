# Start the site (dev server)

Use **Mac Terminal** (the real app: Spotlight → “Terminal”). Keep that Terminal window open the whole time.

## One command (starts server + opens browser)

```bash
cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
bash scripts/run-and-open.sh
```

- Leave the Terminal window **open**.
- After ~25 seconds your browser should open to the site. If it doesn’t, open **http://localhost:3000** yourself.
- To stop the server: press **Ctrl+C** in Terminal.

---

## If that doesn’t work: step by step

1. **Open Terminal** (Spotlight: `Terminal`).

2. **Go to the project:**
   ```bash
   cd "/Users/troycarson/Documents/Cursor Projects/thesampledig"
   ```

3. **Install dependencies** (only if you haven’t, or things are broken):
   ```bash
   npm install
   ```

4. **Start the dev server:**
   ```bash
   bash scripts/start-dev.sh
   ```

5. **Wait until you see something like:**
   ```text
   ▲ Next.js 16.1.6 (Turbopack)
   - Local:         http://localhost:3000
   ✓ Ready in 3s
   ```

6. **Open in your browser:**  
   **http://localhost:3000**

Leave the Terminal window open. Press **Ctrl+C** to stop the server.

---

## Still “This site can’t be reached”?

- **Use Terminal.app** (or iTerm), not Cursor’s “Run” or a terminal that closes when the command “finishes”. The server has to keep running.
- Make sure the Terminal window where you ran `start-dev.sh` or `run-and-open.sh` is still open and shows “Ready”.
- Try **http://127.0.0.1:3000** instead of localhost.
- If you’re on a different machine than where the server runs, use the **Network** URL Terminal printed (e.g. http://192.168.x.x:3000).
