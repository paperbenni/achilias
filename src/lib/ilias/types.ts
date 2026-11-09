export type Item = {
  id: string;
  type: string;
  title: string;
  description: string;
  meta: string;
  /** Repository path such as "Algorithms › Exercise groups", when ILIAS exposes one. */
  context?: string;
  sourceUrl: string;
  available: boolean;
};
/** A read-only peek at a category's or folder's first listing page. */
export type ContainerPreviewData = {
  /** Number of items on the listing page that was read. */
  count: number;
  /** The first few items, enough for a compact card preview. */
  items: Pick<Item, "type" | "title">[];
  /** Items exist beyond the ones included in this preview. */
  truncated: boolean;
  /** ILIAS paginates the listing, so it may contain more than `count`. */
  hasMore: boolean;
};
export type Tool = { title: string; url: string };
export type Breadcrumb = {
  title: string;
  type?: string;
  id?: string;
  /** Resolved ILIAS URL, when the crumb links somewhere. */
  sourceUrl?: string;
};
export type IliasPage = {
  /** Version reported by the standard ILIAS footer, when exposed. */
  iliasVersion?: string;
  title: string;
  description: string;
  items: Item[];
  tools: Tool[];
  text: string[];
  notices: string[];
  /** Repository path from ILIAS, root first, current page last. */
  breadcrumbs?: Breadcrumb[];
  sourceUrl: string;
  authenticated: boolean;
  userName: string;
  hasMore: boolean;
  /** ILIAS' join action when the page offers one; it means the user is not assigned. */
  joinUrl?: string;
  /** ILIAS' leave action when the page offers one; it means the user is a member. */
  leaveUrl?: string;
  /** Confirmed course/group membership for browse pages, when it can be established. */
  membership?: "member" | "guest";
};
export type Workspace = {
  iliasVersion?: string;
  storageKey?: string;
  mode: "disconnected" | "demo" | "live";
  instance: string;
  instanceName: string;
  userName: string;
  page: IliasPage;
  error?: string;
  /** The requested object was not the page ILIAS returned (for example, a redirect to the dashboard). */
  unavailable?: boolean;
  fetchedAt?: string;
};
