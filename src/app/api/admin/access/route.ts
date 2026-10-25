import { assertPermission, authorizationErrorResponse } from "@/server/auth/access";

export async function GET() {
  try {
    const access = await assertPermission("admin.access");
    return Response.json(
      { role: access.role, rank: access.rank, permissions: [...access.permissions].sort() },
      { headers: { "Cache-Control": "no-store" } }, // private data must never be cached
    );
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}