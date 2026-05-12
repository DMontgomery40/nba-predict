#!/usr/bin/env node
import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.TEMP_HOST_PORT ?? 4210);
const webRoot = resolve(
  process.env.TEMP_HOST_WEB_ROOT ??
    fileURLToPath(new URL("../apps/web/dist", import.meta.url))
);
const apiTarget = new URL(
  process.env.TEMP_HOST_API_TARGET ?? "http://127.0.0.1:8787"
);
const username =
  process.env.BASIC_AUTH_USERNAME ?? process.env.TEMP_HOST_USERNAME;
const password =
  process.env.BASIC_AUTH_PASSWORD ?? process.env.TEMP_HOST_PASSWORD;
const authCookieName = "signal_console_temp_auth";
const authCookieValue = createHash("sha256")
  .update(`${username ?? ""}:${password ?? ""}`)
  .digest("hex");

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

if (!username || !password) {
  console.error(
    "Set BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD before starting the temporary host."
  );
  process.exit(1);
}

if (!existsSync(webRoot)) {
  console.error(
    `Web build not found at ${webRoot}. Run pnpm --filter @signal-console/web build first.`
  );
  process.exit(1);
}

function constantTimeMatches(actual, expected) {
  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

function parseCookies(cookieHeader) {
  const cookies = new Map();
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name) {
      cookies.set(name, valueParts.join("="));
    }
  }

  return cookies;
}

function hasAuthCookie(request) {
  const token = parseCookies(request.headers.cookie).get(authCookieName);
  return (
    typeof token === "string" && constantTimeMatches(token, authCookieValue)
  );
}

function isAuthorized(request) {
  if (hasAuthCookie(request)) {
    return true;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return false;
  }

  const [scheme, encoded] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) {
    return false;
  }

  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }

  return constantTimeMatches(decoded, `${username}:${password}`);
}

function sendLoginForm(response, failed = false) {
  response.writeHead(failed ? 401 : 200, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8",
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signal Console Login</title>
    <style>
      :root { color-scheme: dark; font-family: system-ui, sans-serif; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #06080c; color: #f3f7fb; }
      form { width: min(22rem, calc(100vw - 2rem)); display: grid; gap: .75rem; padding: 1.25rem; border: 1px solid rgba(255,255,255,.12); border-radius: .6rem; background: rgba(13,18,24,.92); }
      h1 { margin: 0 0 .25rem; font-size: 1.2rem; }
      label { display: grid; gap: .3rem; color: #a9b8c7; font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
      input, button { min-height: 2.35rem; border-radius: .35rem; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); color: inherit; font: inherit; padding: .45rem .6rem; }
      button { cursor: pointer; border-color: rgba(105,215,165,.3); background: rgba(105,215,165,.12); font-weight: 700; }
      p { margin: 0; color: #ffb09f; }
    </style>
  </head>
  <body>
    <form method="post" action="/__temp-login">
      <h1>Signal Console</h1>
      ${failed ? "<p>Invalid username or password.</p>" : ""}
      <label>Username<input name="username" autocomplete="username" autofocus /></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" /></label>
      <button type="submit">Log in</button>
    </form>
  </body>
</html>`);
}

function sendAuthChallenge(response) {
  response.writeHead(401, {
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8",
    "www-authenticate": 'Basic realm="Signal Console"',
  });
  response.end("Authentication required.\n");
}

function withAuthCookie(headers = {}) {
  return {
    ...headers,
    "set-cookie": `${authCookieName}=${authCookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16_384) {
        request.destroy();
        reject(new Error("Login request body is too large."));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function handleLogin(request, response) {
  if (request.method !== "POST") {
    sendLoginForm(response);
    return;
  }

  let body = "";
  try {
    body = await readRequestBody(request);
  } catch {
    sendLoginForm(response, true);
    return;
  }

  const form = new URLSearchParams(body);
  const submittedUsername = form.get("username") ?? "";
  const submittedPassword = form.get("password") ?? "";
  if (
    constantTimeMatches(submittedUsername, username) &&
    constantTimeMatches(submittedPassword, password)
  ) {
    response.writeHead(
      303,
      withAuthCookie({
        "cache-control": "no-store",
        location: "/",
      })
    );
    response.end();
    return;
  }

  sendLoginForm(response, true);
}

function isApiPath(pathname) {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/health" ||
    pathname.startsWith("/health/")
  );
}

function proxyToApi(request, response) {
  const targetUrl = new URL(request.url ?? "/", apiTarget);
  const headers = { ...request.headers, host: apiTarget.host };
  delete headers.authorization;

  const upstream = httpRequest(
    targetUrl,
    {
      headers,
      method: request.method,
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        withAuthCookie(upstreamResponse.headers)
      );
      upstreamResponse.pipe(response);
    }
  );

  upstream.on("error", (error) => {
    response.writeHead(502, {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    response.end(
      JSON.stringify({
        error: "API proxy failed.",
        message: error.message,
      })
    );
  });

  request.pipe(upstream);
}

function resolveStaticPath(pathname) {
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }

  const candidatePath = resolve(webRoot, `.${decodedPathname}`);
  if (
    candidatePath !== webRoot &&
    !candidatePath.startsWith(`${webRoot}${sep}`)
  ) {
    return undefined;
  }

  if (existsSync(candidatePath)) {
    const stat = statSync(candidatePath);
    if (stat.isDirectory()) {
      return resolve(candidatePath, "index.html");
    }

    if (stat.isFile()) {
      return candidatePath;
    }
  }

  if (extname(candidatePath) === "") {
    return resolve(webRoot, "index.html");
  }

  return undefined;
}

function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, {
      allow: "GET, HEAD",
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    });
    response.end("Method not allowed.\n");
    return;
  }

  const staticPath = resolveStaticPath(pathname);
  if (!staticPath || !existsSync(staticPath)) {
    response.writeHead(404, {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    });
    response.end("Not found.\n");
    return;
  }

  const stat = statSync(staticPath);
  const isIndex = staticPath === resolve(webRoot, "index.html");
  response.writeHead(200, {
    ...withAuthCookie({
      "cache-control": isIndex ? "no-store" : "public, max-age=3600",
      "content-length": stat.size,
      "content-type":
        mimeTypes.get(extname(staticPath)) ?? "application/octet-stream",
    }),
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(staticPath).pipe(response);
}

const server = createServer((request, response) => {
  const requestUrl = new URL(
    request.url ?? "/",
    `http://${request.headers.host}`
  );

  if (requestUrl.pathname === "/__temp-login") {
    void handleLogin(request, response);
    return;
  }

  if (!isAuthorized(request)) {
    if (
      request.method === "GET" &&
      String(request.headers.accept ?? "").includes("text/html")
    ) {
      sendLoginForm(response);
      return;
    }

    sendAuthChallenge(response);
    return;
  }

  if (isApiPath(requestUrl.pathname)) {
    proxyToApi(request, response);
    return;
  }

  serveStatic(request, response, requestUrl.pathname);
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `Temporary authenticated host listening at http://127.0.0.1:${port}`
  );
  console.log(`Serving web build from ${webRoot}`);
  console.log(`Proxying /api and /health to ${apiTarget.href}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
