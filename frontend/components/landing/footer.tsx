export default function Footer() {
  return (
    <div className="w-full flex flex-col md:justify-center md:items-center text-center text-lg">
      <div className="px-4 relative w-full container overflow-hidden md:rounded-lg md:mb-16">
        <div className="relative z-20">
          <div className="flex flex-col items-start space-y-4 py-16 font-medium">
            <a className="" href="mailto:support@clawops.ai">
              Contact us
            </a>
            <a target="_blank" href="https://github.com/clawops/clawops">
              GitHub
            </a>
            <a
              className="flex"
              target="_blank"
              href="https://discord.gg/nNFUUDAKub"
            >
              Join Discord
            </a>
            <a target="_blank" href="/policies/privacy">
              Privacy policy
            </a>
            <a
              target="_blank"
              href="/policies/terms"
            >
              Terms of service
            </a>
            <a target="_blank" href="https://status.clawops.ai">
              Status
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
