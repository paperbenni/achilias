import { currentSession } from "@/lib/ilias/session";
import { objectUrl } from "@/lib/ilias/config";
import { fetchUpstream, IliasError } from "@/lib/ilias/client";
export const runtime = "nodejs";
function examplePdf() {
  const text =
    "BT /F1 24 Tf 60 740 Td (A little more room to learn.) Tj 0 -42 Td /F1 12 Tf (This is an example PDF from the Achilias demo.) Tj 0 -22 Td (Connect your ILIAS account to download your actual materials.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  if (new URL(request.url).searchParams.get("demo") === "1") {
    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      'attachment; filename="achilias-example.pdf"',
    );
    return new Response(examplePdf(), { headers });
  }
  const session = await currentSession();
  if (session?.status !== "connected")
    return Response.json(
      { error: "Connect your account to download files." },
      { status: 401, headers },
    );
  try {
    const { response } = await fetchUpstream(
      session,
      objectUrl(session.instance, "file", id, true),
      true,
    );
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    if (/text\/html/i.test(contentType)) {
      await response.body?.cancel();
      throw new IliasError(
        "ILIAS returned a sign-in or information page. Reconnect your account, or open the file in ILIAS.",
        401,
      );
    }
    headers.set("Content-Type", contentType);
    const original = response.headers.get("content-disposition");
    headers.set(
      "Content-Disposition",
      original?.match(/filename\*?=/i)
        ? original.replace(/^inline/i, "attachment")
        : `attachment; filename="ilias-file-${id}"`,
    );
    return new Response(response.body, { headers });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Download failed." },
      { status: e instanceof IliasError ? e.status : 400, headers },
    );
  }
}
