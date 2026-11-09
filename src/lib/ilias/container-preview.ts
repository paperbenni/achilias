import { objectUrl } from "./config";
import { fetchPage } from "./client";
import { IliasError } from "./errors";
import { validObjectId } from "./identifiers";
import { isPreviewableContainer } from "./items";
import { loadWorkspacePage } from "./page-cache";
import { pageMatchesObject } from "./workspace";
import type { Session } from "./session";
import type { ContainerPreviewData } from "./types";

/** Show enough entries to recognise a container without turning cards into lists. */
export const containerPreviewLimit = 3;
const previewConcurrency = 4;
let activePreviews = 0;
const previewQueue: (() => void)[] = [];

/** Keep upstream preview reads bounded when several cards enter the viewport. */
async function withPreviewSlot<T>(task: () => Promise<T>) {
  if (activePreviews >= previewConcurrency)
    await new Promise<void>((resolve) => previewQueue.push(resolve));
  activePreviews++;
  try {
    return await task();
  } finally {
    activePreviews--;
    previewQueue.shift()?.();
  }
}

/**
 * Read the first listing page of a category or folder. The parsed page goes
 * through the normal 30-second listing cache, so opening the card immediately
 * after its preview does not download the page twice.
 */
export async function getContainerPreview(
  session: Session,
  type: string,
  id: string,
): Promise<ContainerPreviewData> {
  if (!isPreviewableContainer(type) || !validObjectId(id))
    throw new IliasError("Invalid category or folder.", 400);
  const url = objectUrl(session.instance, type, id);
  const { page } = await withPreviewSlot(() =>
    loadWorkspacePage(session.id, url, () => fetchPage(session, url)),
  );
  // A redirect to the dashboard or parent means ILIAS did not open this object.
  // An empty preview would otherwise claim it has no contents.
  if (!pageMatchesObject(page, type, id))
    throw new IliasError(
      "ILIAS did not open this category or folder. You may not have access.",
      403,
    );
  return {
    count: page.items.length,
    items: page.items
      .slice(0, containerPreviewLimit)
      .map(({ type: itemType, title }) => ({ type: itemType, title })),
    truncated: page.items.length > containerPreviewLimit,
    hasMore: page.hasMore,
  };
}
