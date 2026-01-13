import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../stores/app";
import { api } from "../services/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

interface BranchStatus {
  branch: string | null;
  hasChanges: boolean;
  changedFiles: string[];
  aheadBy: number;
}

interface VibeChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VibeChat({ isOpen, onClose }: VibeChatProps) {
  const { user, themeColor } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [branchStatus, setBranchStatus] = useState<BranchStatus>({
    branch: null,
    hasChanges: false,
    changedFiles: [],
    aheadBy: 0,
  });
  const [showChangedFiles, setShowChangedFiles] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadBranchStatus();
      inputRef.current?.focus();
      if (messages.length === 0) {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: `Hey ${
              user?.name || "there"
            }! 👋 I'm your AI coding buddy with **real superpowers**.\n\nI can actually read and write code in the Crosswalk repo! Tell me what you want to build or change, and I'll make it happen.\n\n🔧 Your changes go to your personal branch on GitHub\n👀 Click "View My Version" to see your changes live\n📝 When ready, I can open a PR to share with everyone\n↩️ You can always revert to production\n\nWhat shall we build?`,
            timestamp: new Date(),
          },
        ]);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadBranchStatus = async () => {
    try {
      const status = await api.vibe.getBranchStatus();
      setBranchStatus({
        branch: status.branch,
        hasChanges: status.hasChanges,
        changedFiles: status.changedFiles || [],
        aheadBy: status.aheadBy || 0,
      });
    } catch (err) {
      console.error("Failed to load branch status:", err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await api.vibe.chat(input.trim());

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
        toolsUsed: response.toolsUsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.branchStatus) {
        setBranchStatus({
          branch: response.branchStatus.branch,
          hasChanges: response.branchStatus.hasChanges,
          changedFiles: response.branchStatus.changedFiles || [],
          aheadBy: response.branchStatus.aheadBy || 0,
        });
      }
    } catch (err) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Oops! Something went wrong. Make sure the backend has `GITHUB_TOKEN` set and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenPR = async () => {
    setIsLoading(true);
    try {
      const result = await api.vibe.openPR();
      const prMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `🎉 **PR #${result.prNumber} opened!**\n\n[View on GitHub](${result.prUrl})\n\nOnce reviewed and merged, your changes will be live for everyone!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, prMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Failed to open PR: ${err.message || "Unknown error"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevert = async () => {
    if (!confirm("This will reset your branch to production. Continue?")) {
      return;
    }

    setIsReverting(true);
    try {
      await api.vibe.revert();
      setBranchStatus((prev) => ({
        ...prev,
        hasChanges: false,
        changedFiles: [],
        aheadBy: 0,
      }));
      const revertMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "↩️ **Reverted to production!** Your branch is now in sync with main. Ready to start fresh!",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, revertMessage]);
    } catch (err: any) {
      alert(`Failed to revert: ${err.message}`);
    } finally {
      setIsReverting(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Clear chat history?")) return;
    try {
      await api.vibe.clearHistory();
      setMessages([
        {
          id: "cleared",
          role: "assistant",
          content: "Chat history cleared. What would you like to build?",
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  const handleViewPreview = async () => {
    try {
      const { previewUrl } = await api.vibe.getPreviewUrl();
      window.open(previewUrl, "_blank");
    } catch (err) {
      console.error("Failed to get preview URL:", err);
      alert(
        "Could not get preview URL. Make sure your repo is connected to Vercel."
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <svg
            className="w-6 h-6 text-ink"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="text-center flex-1">
          <h1 className="text-lg font-bold text-ink">Vibe²</h1>
          {branchStatus.branch && (
            <button
              onClick={() => setShowChangedFiles(!showChangedFiles)}
              className="text-xs text-gray-500 flex items-center justify-center gap-1 mx-auto"
            >
              <span className="font-mono">{branchStatus.branch}</span>
              {branchStatus.hasChanges && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                  style={{ backgroundColor: themeColor }}
                >
                  {branchStatus.aheadBy} changes
                </span>
              )}
            </button>
          )}
        </div>
        <button
          onClick={handleClearHistory}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <svg
            className="w-5 h-5 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {showChangedFiles && branchStatus.changedFiles.length > 0 && (
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink">Changed Files</span>
            <button
              onClick={handleRevert}
              disabled={isReverting}
              className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-lg font-medium disabled:opacity-50"
            >
              {isReverting ? "Reverting..." : "↩️ Revert to Production"}
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {branchStatus.changedFiles.map((file) => (
              <div
                key={file}
                className="text-xs font-mono text-gray-600 flex items-center gap-2"
              >
                <span className="text-green-500">M</span>
                {file}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-ink text-white"
                  : "bg-gray-100 text-ink"
              }`}
            >
              <div className="text-sm whitespace-pre-wrap prose prose-sm max-w-none">
                {formatMessage(message.content)}
              </div>
              {message.toolsUsed && message.toolsUsed.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500 font-medium mb-1">
                    Tools used:
                  </p>
                  {message.toolsUsed.map((tool, i) => (
                    <p key={i} className="text-xs text-gray-400 font-mono">
                      {tool}
                    </p>
                  ))}
                </div>
              )}
              <p
                className={`text-xs mt-1 ${
                  message.role === "user" ? "text-white/60" : "text-gray-400"
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  Reading & writing code...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {branchStatus.hasChanges && (
        <div className="px-4 py-2 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500">
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-medium">
              {branchStatus.aheadBy}{" "}
              {branchStatus.aheadBy === 1 ? "commit" : "commits"} ahead
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleRevert}
                disabled={isReverting || isLoading}
                className="px-3 py-1.5 bg-white/20 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                Revert
              </button>
              <button
                onClick={handleViewPreview}
                className="px-3 py-1.5 bg-white/20 text-white text-sm font-medium rounded-lg"
              >
                👀 View
              </button>
              <button
                onClick={handleOpenPR}
                disabled={isLoading}
                className="px-3 py-1.5 bg-white text-purple-600 text-sm font-bold rounded-lg disabled:opacity-50"
              >
                Open PR
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 p-4 safe-area-bottom">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            className="flex-1 resize-none rounded-2xl bg-gray-100 px-4 py-3 text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
            rows={1}
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-30"
            style={{ backgroundColor: themeColor }}
          >
            <svg
              className="w-5 h-5 text-ink"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMessage(content: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  const combined = new RegExp(
    `(\\*\\*[^*]+\\*\\*|\\[[^\\]]+\\]\\([^)]+\\))`,
    "g"
  );

  let match;
  while ((match = combined.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.slice(lastIndex, match.index)}
        </span>
      );
    }

    const matchedText = match[0];
    if (matchedText.startsWith("**") && matchedText.endsWith("**")) {
      parts.push(
        <strong key={`bold-${match.index}`} className="font-semibold">
          {matchedText.slice(2, -2)}
        </strong>
      );
    } else {
      const linkMatch = matchedText.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={`link-${match.index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>{content.slice(lastIndex)}</span>
    );
  }

  return parts.length > 0 ? parts : content;
}
