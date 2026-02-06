const lines = [
  "",
  "ClawOps Quickstart (Docker)",
  "-------------------------",
  "1) Copy env template:",
  "   cp .env.example .env",
  "2) Start services:",
  "   docker compose -f docker-compose.yml up -d",
  "3) Run hardening checks:",
  "   npm run clawops:check",
  "4) Open the UI:",
  "   http://localhost:3000",
  "",
  "Need hosted or hybrid? See docs/LAUNCH.md for deployment modes.",
  "",
];

console.log(lines.join("\n"));
