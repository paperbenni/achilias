import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Achilias",
    short_name: "Achilias",
    description: "Your ILIAS courses, materials, and discussions in a calmer workspace.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#245c49",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The mark fits inside the central 80% safe circle on a solid background.
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My courses", url: "/courses", description: "Open your course and group memberships" },
      { name: "Bookmarks", url: "/saved", description: "Open your saved materials" },
    ],
  };
}
