import type { MetadataRoute } from "next";

// Powers "Add to Home Screen" on Android/Chrome -- the icon, name, and
// colors used for the installed app icon and splash screen. iOS Safari
// doesn't read this for icons (it uses apple-icon.png instead, see that
// file), but does respect it for the rest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VMSA Deacon Tracker",
    short_name: "Deacon Tracker",
    description: "Track deacon attendance and liturgical assignments",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#7a2e3c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
