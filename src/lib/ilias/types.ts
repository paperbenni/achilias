export type Item = {
  id: string;
  type: string;
  title: string;
  description: string;
  meta: string;
  sourceUrl: string;
  available: boolean;
};
export type Tool = { title: string; url: string };
export type IliasPage = {
  title: string;
  description: string;
  items: Item[];
  tools: Tool[];
  text: string[];
  notices: string[];
  sourceUrl: string;
  authenticated: boolean;
  userName: string;
  hasMore: boolean;
};
export type Workspace = {
  storageKey?: string;
  mode: "disconnected" | "demo" | "live";
  instance: string;
  instanceName: string;
  userName: string;
  page: IliasPage;
  error?: string;
  fetchedAt?: string;
};
export const containers = new Set(["crs", "grp", "fold", "cat"]);
export const typeNames: Record<string, string> = {
  crs: "Course",
  grp: "Group",
  fold: "Folder",
  cat: "Category",
  file: "File",
  exc: "Assignment",
  tst: "Test",
  frm: "Forum",
  lm: "Learning module",
  htlm: "HTML module",
  sahs: "SCORM module",
  webr: "Web link",
  wiki: "Wiki",
  sess: "Session",
  svy: "Survey",
  blog: "Blog",
  mcst: "Media",
  poll: "Poll",
  book: "Booking",
  cwrk: "Course work",
  unknown: "ILIAS object",
};
export function itemHref(item: Item, demo = false) {
  if (item.type === "frm") return `/forums/${item.id}${demo ? "?demo=1" : ""}`;
  if (containers.has(item.type))
    return `/browse/${item.type}/${item.id}${demo ? "?demo=1" : ""}`;
  if (item.type === "file")
    return demo ? `/api/files/${item.id}?demo=1` : `/api/files/${item.id}`;
  return item.sourceUrl;
}
