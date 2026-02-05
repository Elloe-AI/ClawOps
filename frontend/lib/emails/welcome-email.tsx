import { Html, Link, Preview, Text } from '@react-email/components';

export default function WelcomeEmail({ }: {}) {
  return (
    <Html lang="en">
      <Preview>Welcome to ClawOps — your control plane for AI agents</Preview>
      <div style={container}>
        <Text style={heading}>Welcome to ClawOps! 👋</Text>
        <Text style={text}>
          Thanks for joining. ClawOps keeps your agents safe, visible, and under control across Telegram, Discord,
          WhatsApp, and SMS.
        </Text>
        <Text style={text}>
          Start here:
        </Text>
        <div style={bulletList}>
          <Text style={bulletPoint}>
            • <Link style={link} href="https://clawops.ai/docs" target="_blank">
              Connect your agent runtime and go live
            </Link>
          </Text>
          <Text style={bulletPoint}>
            • <Link style={link} href="https://clawops.ai/docs" target="_blank">
              Set guardrails and safety toggles
            </Link>
          </Text>
          <Text style={bulletPoint}>
            • <Link style={link} href="https://clawops.ai/docs" target="_blank">
              Review activity timelines
            </Link>
          </Text>
        </div>
        <Text style={text}>
          Need help? Reply to this email or visit our docs anytime.
        </Text>
        <Text style={signature}>The ClawOps team</Text>
      </div>
    </Html>
  );
}

const text = {
  fontFamily: "'Inter', 'Roboto', 'Helvetica', sans-serif",
  fontSize: '13px',
  fontWeight: '400',
  lineHeight: '19.5px'
};

const container = {
  margin: '0 auto',
  padding: '20px',
  maxWidth: '500px',
};

const heading = {
  ...text,
  fontSize: '24px',
  fontWeight: '600',
  marginBottom: '24px',
};

const link = {
  color: '#2563eb',
  textDecoration: 'none',
};

const signature = {
  ...text,
  marginTop: '24px',
  fontWeight: '500',
};

const bulletList = {
  marginLeft: '20px',
  marginBottom: '16px',
};

const bulletPoint = {
  ...text,
  marginBottom: '8px',
};
