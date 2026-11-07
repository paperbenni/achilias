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
export type Tool = { title: string; url: string };
export type Breadcrumb = {
  title: string;
  type?: string;
  id?: string;
  /** Resolved ILIAS URL, when the crumb links somewhere. */
  sourceUrl?: string;
};
export type IliasPage = {
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
