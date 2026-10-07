// Configuração do app Android (Capacitor).
// O app abre o site publicado no Netlify (SITE_URL), então melhorias no site chegam ao app
// sem precisar reinstalar. O APK é gerado pelo GitHub Actions (.github/workflows/android.yml).
const siteUrl = (process.env.SITE_URL || "https://exemplo.netlify.app").replace(/\/+$/, "");

module.exports = {
  appId: "br.com.vetorial.rastreamento",
  appName: "Rastreamento Logístico",
  webDir: "www",
  server: {
    url: siteUrl,
    allowNavigation: [new URL(siteUrl).hostname, "*.supabase.co"]
  },
  android: {
    // necessário para a localização não parar após 5 min em segundo plano
    // (https://github.com/capacitor-community/background-geolocation#android)
    useLegacyBridge: true
  }
};
