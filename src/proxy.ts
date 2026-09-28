import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function unauthorized() {
  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Email Tracker"' },
  });
}

export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!user || !password) return unauthorized();

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    const givenUser = decoded.slice(0, separator);
    const givenPassword = decoded.slice(separator + 1);
    if (givenUser === user && givenPassword === password) {
      return NextResponse.next();
    }
  }

  return unauthorized();
}

export const config = {
  // /api/cron/* se autentica con CRON_SECRET en el propio handler.
  matcher: ["/((?!track/|api/cron/|_next/static|_next/image|favicon.ico).*)"],
};
