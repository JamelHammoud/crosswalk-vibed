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

interface Vibe {
  id: string;
  name: string;
  branchName: string;
  hasChanges: boolean;
  changedFiles: string[];
  aheadBy: number;
  createdAt: string;
}

interface VibeChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VibeChat({ isOpen, onClose }: VibeChatProps) {
  const { user, themeColor } = useAppStore();
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVibes, setIsLoadingVibes] = useState(false);
  const [showChangedFiles, setShowChangedFiles] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCreatingVibe, setIsCreatingVibe] = useState(false);
  const [newVibeName, setNewVibeName] = useState("");
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [lastToolAction, setLastToolAction] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<{
    state: "QUEUED" | "BUILDING" | "READY" | "ERROR" | null;
    message: string;
    url?: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadVibes();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadVibes = async () => {
    setIsLoadingVibes(true);
    try {
      const result = await api.vibe.list();
      setVibes(result.vibes);
    } catch (err) {
      console.error("Failed to load vibes:", err);
    } finally {
      setIsLoadingVibes(false);
    }
  };

  const selectVibe = async (vibe: Vibe) => {
    setSelectedVibe(vibe);
    setIsLoading(true);

    const welcomeMessage: Message = {
      id: "welcome",
      role: "assistant",
      content: `Hey ${
        user?.name || "there"
      }!\n\nWelcome to **Vibe²**, where you can dream up new experiences for this app.\n\nSimply ask me to add things, change things, etc., and I'll let you know when I'm done. Then you can use your new version of Crosswalk.\n\nWant to let others use it? Open a PR to the repo.`,
      timestamp: new Date(),
    };

    try {
      const result = await api.vibe.getMessages(vibe.id);
      if (result.messages.length > 0) {
        setMessages(
          result.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt),
          }))
        );
      } else {
        setMessages([welcomeMessage]);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([welcomeMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const createNewVibe = async () => {
    if (!newVibeName.trim()) return;

    setIsLoading(true);
    try {
      const newVibe = await api.vibe.create(newVibeName.trim());
      setVibes((prev) => [
        { ...newVibe, hasChanges: false, changedFiles: [], aheadBy: 0 },
        ...prev,
      ]);
      setSelectedVibe({
        ...newVibe,
        hasChanges: false,
        changedFiles: [],
        aheadBy: 0,
      });
      setNewVibeName("");
      setIsCreatingVibe(false);
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Hey ${
            user?.name || "there"
          }!\n\nWelcome to **Vibe²**, where you can dream up new experiences for this app.\n\nSimply ask me to add things, change things, etc., and I'll let you know when I'm done. Then you can use your new version of Crosswalk.\n\nWant to let others use it? Open a PR to the repo.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error("Failed to create vibe:", err);
      alert("Failed to create vibe");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteVibe = async (vibeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this vibe?")) return;

    try {
      await api.vibe.delete(vibeId);
      setVibes((prev) => prev.filter((v) => v.id !== vibeId));
      if (selectedVibe?.id === vibeId) {
        setSelectedVibe(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete vibe:", err);
    }
  };

  const goBack = () => {
    setSelectedVibe(null);
    setMessages([]);
    setShowChangedFiles(false);
    setDeploymentStatus(null);
    loadVibes();
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !selectedVibe) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = input.trim();
    setInput("");
    setIsLoading(true);
    setProgressStatus("Thinking...");
    setLastToolAction(null);
    setDeploymentStatus(null);

    try {
      await api.vibe.chatStream(selectedVibe.id, messageText, (event) => {
        if (event.type === "status") {
          setProgressStatus(event.message || "Processing...");
        } else if (event.type === "tool_start") {
          setProgressStatus("Working...");
          setLastToolAction(event.message || `Using ${event.tool}...`);
        } else if (event.type === "tool_end") {
          setLastToolAction(event.message || `Finished ${event.tool}`);
        } else if (event.type === "deployment") {
          setDeploymentStatus({
            state: event.state || null,
            message: event.message || "",
            url: event.url,
          });
        } else if (event.type === "done") {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: event.message || "",
            timestamp: new Date(),
            toolsUsed: event.toolsUsed,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          if (event.vibe) {
            setSelectedVibe((prev) =>
              prev ? { ...prev, ...event.vibe } : null
            );
          }
          setIsLoading(false);
          setProgressStatus(null);
          setLastToolAction(null);
        } else if (event.type === "error") {
          const errorMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: event.message || "Something went wrong",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setIsLoading(false);
          setProgressStatus(null);
          setLastToolAction(null);
        }
      });
    } catch (err) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Oops! Something went wrong. Make sure the backend has `GITHUB_TOKEN` set and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
      setProgressStatus(null);
      setLastToolAction(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenPR = async () => {
    if (!selectedVibe) return;
    setIsLoading(true);
    try {
      const result = await api.vibe.openPR(selectedVibe.id);
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
    if (!selectedVibe) return;
    if (
      !confirm(
        "This will reset your branch to production and clear chat history. Continue?"
      )
    ) {
      return;
    }

    setIsReverting(true);
    try {
      await api.vibe.revert(selectedVibe.id);
      setSelectedVibe((prev) =>
        prev
          ? { ...prev, hasChanges: false, changedFiles: [], aheadBy: 0 }
          : null
      );
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `↩️ **Reverted to production!**\n\nYour branch and chat history have been cleared. Ready to start completely fresh!\n\nWhat would you like to build?`,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      alert(`Failed to revert: ${err.message}`);
    } finally {
      setIsReverting(false);
    }
  };

  const handleClearHistory = async () => {
    if (!selectedVibe) return;
    if (!confirm("Clear chat history?")) return;
    try {
      await api.vibe.clearHistory(selectedVibe.id);
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
    if (!selectedVibe) return;
    setIsLoadingPreview(true);
    try {
      const result = await api.vibe.getPreviewUrl(selectedVibe.id);
      const { previewUrl: url, source, message } = result as any;

      if (source === "vercel-api") {
        setPreviewUrl(url);
      } else {
        const urlMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `🔗 **Preview not ready yet**\n\n${
            message || "Push a commit to trigger a Vercel preview."
          }\n\n[View branch on GitHub](${url})`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, urlMessage]);
      }
    } catch (err) {
      console.error("Failed to get preview URL:", err);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Could not get preview URL. Make sure your repo is connected to Vercel and env vars are set.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  if (!isOpen) return null;

  // Vibe list view
  if (!selectedVibe) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="relative flex items-center justify-between px-4 py-3 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f0c29] via-[#302b63] to-[#24243e]" />
          <button
            onClick={onClose}
            className="relative z-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <svg
              className="w-6 h-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="relative z-10 text-lg font-bold text-white">Vibe²</h1>
          <div className="w-10" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingVibes ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-gray-400">Loading vibes...</span>
            </div>
          ) : (
            <>
              {/* Create new vibe */}
              {isCreatingVibe ? (
                <div className="mb-4 p-4 bg-gray-50 rounded-2xl">
                  <input
                    type="text"
                    value={newVibeName}
                    onChange={(e) => setNewVibeName(e.target.value)}
                    placeholder="Name your vibe (e.g., Dark Mode)"
                    className="w-full h-12 bg-white border border-gray-200 rounded-xl px-4 mb-3 focus:outline-none focus:ring-2 focus:ring-purple-300"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && createNewVibe()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsCreatingVibe(false)}
                      className="flex-1 h-10 bg-gray-200 text-ink rounded-xl font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createNewVibe}
                      disabled={!newVibeName.trim() || isLoading}
                      className="flex-1 h-10 bg-purple-500 text-white rounded-xl font-medium disabled:opacity-50"
                    >
                      {isLoading ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingVibe(true)}
                  className="w-full h-14 mb-4 bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Vibe
                </button>
              )}

              {/* Vibe list */}
              {vibes.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">No vibes yet</p>
                  <p className="text-gray-300 text-sm mt-1">
                    Create one to start building!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vibes.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => selectVibe(v)}
                      className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl text-left transition-colors relative group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-ink text-lg">
                            {v.name}
                          </h3>
                          <p className="text-gray-400 text-sm font-mono mt-1">
                            {v.branchName}
                          </p>
                          {v.hasChanges && (
                            <span className="inline-block mt-2 px-2 py-0.5 bg-purple-100 text-purple-600 text-xs font-bold rounded-full">
                              {v.aheadBy}{" "}
                              {v.aheadBy === 1 ? "change" : "changes"}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => deleteVibe(v.id, e)}
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
                        >
                          <svg
                            className="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Chat view (selected vibe)
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0c29] via-[#302b63] to-[#24243e]" />
        <button
          onClick={goBack}
          className="relative z-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          <svg
            className="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="relative z-10 text-center flex-1">
          <h1 className="text-lg font-bold text-white">{selectedVibe.name}</h1>
          {selectedVibe.hasChanges && (
            <button
              onClick={() => setShowChangedFiles(!showChangedFiles)}
              className="text-xs text-white/70 flex items-center justify-center gap-1 mx-auto"
            >
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                {selectedVibe.aheadBy} changes
              </span>
            </button>
          )}
        </div>
        <button
          onClick={handleClearHistory}
          className="relative z-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          <svg
            className="w-5 h-5 text-white/60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {showChangedFiles && selectedVibe.changedFiles.length > 0 && (
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink">Changed Files</span>
            <button
              onClick={handleRevert}
              disabled={isReverting}
              className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-lg font-medium disabled:opacity-50"
            >
              {isReverting ? "Reverting..." : "↩️ Revert"}
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {selectedVibe.changedFiles.map((file) => (
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

      {/* Messages */}
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
              <div className="text-sm whitespace-pre-wrap">
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
            <div className="bg-gray-100 rounded-2xl px-4 py-3 min-w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600 font-medium">
                  {progressStatus || "Thinking..."}
                </span>
              </div>
              {lastToolAction && (
                <div className="text-xs text-gray-500 pl-6">
                  {lastToolAction}
                </div>
              )}
            </div>
          </div>
        )}
        {deploymentStatus && (
          <div className="flex justify-start">
            <div
              className={`rounded-2xl px-4 py-3 ${
                deploymentStatus.state === "READY"
                  ? "bg-green-100"
                  : deploymentStatus.state === "ERROR"
                  ? "bg-red-100"
                  : "bg-amber-100"
              }`}
            >
              <div className="flex items-center gap-2">
                {deploymentStatus.state === "BUILDING" ||
                deploymentStatus.state === "QUEUED" ? (
                  <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : null}
                <span
                  className={`text-sm font-medium ${
                    deploymentStatus.state === "READY"
                      ? "text-green-700"
                      : deploymentStatus.state === "ERROR"
                      ? "text-red-700"
                      : "text-amber-700"
                  }`}
                >
                  {deploymentStatus.message}
                </span>
                {deploymentStatus.state === "READY" && deploymentStatus.url && (
                  <button
                    onClick={() => setPreviewUrl(deploymentStatus.url!)}
                    className="ml-2 px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-lg"
                  >
                    View
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Action bar */}
      {selectedVibe.hasChanges && (
        <div className="px-4 py-2 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500">
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-medium">
              {selectedVibe.aheadBy}{" "}
              {selectedVibe.aheadBy === 1 ? "commit" : "commits"} ahead
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
                disabled={isLoadingPreview}
                className="px-3 py-1.5 bg-white/20 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {isLoadingPreview ? "Loading..." : "👀 View"}
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

      {/* Input */}
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

      {/* Preview iframe overlay */}
      {previewUrl && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-center gap-3 px-4 py-2 bg-amber-400">
            <span className="text-ink font-bold text-sm">
              ✨ Previewing Vibe
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(previewUrl);
                alert("Preview URL copied to clipboard!");
              }}
              className="px-3 py-1 bg-ink/20 text-ink text-xs font-bold rounded-full"
            >
              Share
            </button>
            <button
              onClick={() => setPreviewUrl(null)}
              className="px-3 py-1 bg-ink text-white text-xs font-bold rounded-full"
            >
              Exit Preview
            </button>
          </div>
          <iframe
            src={`${previewUrl}${
              previewUrl.includes("?") ? "&" : "?"
            }vibe_token=${encodeURIComponent(
              localStorage.getItem("auth_token") || ""
            )}`}
            className="flex-1 w-full border-0"
            title="Preview"
            allow="geolocation; camera; microphone"
          />
        </div>
      )}
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
