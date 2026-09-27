import { NextRequest } from "next/server";
import { GET as fileGetHandler } from "@/app/api/files/[key]/route";

interface RouteParams {
  params: Promise<{ key: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  return fileGetHandler(req, { params });
}
