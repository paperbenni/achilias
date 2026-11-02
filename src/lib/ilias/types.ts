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
