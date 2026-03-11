import { PATCH as patchStep } from "../route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return patchStep(request, { params });
}

