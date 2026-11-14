export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: "Miúdos 2026",
      short_name: "Miúdos",
      description: "Com quem ficam os miúdos, dia a dia",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#f3f5f7",
      theme_color: "#2f86c4",
      lang: "pt",
      icons: [
        { src: "/miudos-icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/miudos-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
