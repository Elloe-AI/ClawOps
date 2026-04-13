"use client";

import { PYTHON_INSTALL } from "@/lib/const";

import CodeHighlighter from "../../ui/code-highlighter";

export function InstallTabsSection() {
  return (
    <CodeHighlighter
      copyable
      className="text-xs bg-background p-4 rounded-md border"
      code={PYTHON_INSTALL}
      language="bash"
    />
  );
}

export function InitializationTabsSection() {
  const pythonInitialization = `from clawops import ClawOps as TruthChecker
TruthChecker.initialize()`;

  return (
    <CodeHighlighter
      copyable
      className="text-xs bg-background p-4 rounded-md border"
      code={pythonInitialization}
      language="python"
    />
  );
}
