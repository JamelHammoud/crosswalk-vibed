import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../stores/app";
import { useDrops } from "../hooks/useDrops";
import { DROP_RANGES, DROP_RANGE_OPTIONS } from "../constants/range";
import { EFFECTS } from "../constants/effects";
import { calculateExpiresAt } from "../constants/expiry";
import type { DropRangeType, EffectType } from "../types";
import type { ExpiryUnit } from "../constants/expiry";

type ActivePanel = "none" | "effect" | "range" | "expiry";

const PILL_BASE =
  "flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition-all";
const PILL_DEFAULT = "bg-[#F5F1F0] text-[#1B1919]";
const PILL_SELECTED =
  "bg-white text-[#1B1919] shadow-[inset_0_0_0_2px_#1B1919,0_2px_4px_rgba(0,0,0,0.06)]";

export function DropComposer() {
  const { isComposerOpen, closeComposer, themeColor } = useAppStore();
  const { createDrop } = useDrops();
  const [message, setMessage] = useState("");
  const [range, setRange] = useState<DropRangeType>("close");
  const [effect, setEffect] = useState<EffectType>("none");
  const [expiryUnit, setExpiryUnit] = useState<ExpiryUnit>("forever");
  const [expiryValue, setExpiryValue] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isComposerOpen && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [isComposerOpen]);

  if (!isComposerOpen) return null;

  const selectedEffect = EFFECTS.find((e) => e.id === effect) || EFFECTS[0];
  const selectedRange = DROP_RANGES[range];

  const isRangeNonDefault = range !== "close";
  const isExpiryNonDefault = expiryUnit !== "forever";
  const isEffectNonDefault = effect !== "none";

  const handleSubmit = async () => {
    if (!message.trim() || isSubmitting) return;

    const expiresAt = calculateExpiresAt(expiryUnit, expiryValue ?? undefined);

    setIsSubmitting(true);
    const drop = await createDrop(message.trim(), range, effect, expiresAt);
    setIsSubmitting(false);

    if (drop) {
      resetForm();
      closeComposer();
      showDroppedToast(themeColor);
    }
  };

  const resetForm = () => {
    setMessage("");
    setRange("close");
    setEffect("none");
    setExpiryUnit("forever");
    setExpiryValue(null);
    setActivePanel("none");
  };

  const handleClose = () => {
    resetForm();
    closeComposer();
  };

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(activePanel === panel ? "none" : panel);
  };

  const getExpiryLabel = () => {
    if (expiryUnit === "forever") return "∞";
    return `${expiryValue}${expiryUnit[0]}`;
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={handleClose}
      />

      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
        <div className="bg-white rounded-t-3xl shadow-2xl">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <button className="flex items-center gap-1 font-semibold text-lg text-[#1B1919]">
              Drop
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-[#F5F1F0] flex items-center justify-center"
            >
              <svg
                className="w-4 h-4 text-[#1B1919]/50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-5 py-12 flex items-center justify-center min-h-[200px]">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-[#1B1919] text-xl text-center placeholder-[#1B1919]/30 resize-none focus:outline-none bg-transparent"
              placeholder="Drop your thoughts"
              maxLength={280}
              rows={3}
              autoFocus
            />
          </div>

          <div className="pb-4 flex items-center gap-3 pl-0 pr-5">
            <div
              ref={scrollRef}
              className="flex-1 overflow-x-auto scrollbar-hide"
            >
              <div className="flex gap-2 pl-5 w-max ml-auto">
                <button
                  onClick={() => togglePanel("range")}
                  className={`${PILL_BASE} shrink-0 ${
                    isRangeNonDefault ? PILL_SELECTED : PILL_DEFAULT
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 22 22"
                    fill="currentColor"
                  >
                    <path d="M16.8337 4.24939C18.3484 5.76385 19.2146 7.808 19.2493 9.94961C19.2841 12.0912 18.4845 14.1624 17.0198 15.7251L16.8337 15.9176L12.9443 19.8061C12.4508 20.2993 11.7883 20.5865 11.0909 20.6095C10.3936 20.6325 9.71362 20.3895 9.18872 19.9299L9.05672 19.8061L5.16638 15.9167C3.6192 14.3695 2.75 12.2711 2.75 10.0831C2.75 7.89501 3.6192 5.79658 5.16638 4.24939C6.71357 2.70221 8.812 1.83301 11.0001 1.83301C13.1881 1.83301 15.2865 2.70221 16.8337 4.24939ZM11.0001 7.33306C10.6389 7.33306 10.2813 7.40419 9.94767 7.54239C9.61403 7.68059 9.31087 7.88315 9.05551 8.13851C8.80015 8.39388 8.59758 8.69703 8.45938 9.03068C8.32118 9.36432 8.25005 9.72192 8.25005 10.0831C8.25005 10.4442 8.32118 10.8018 8.45938 11.1354C8.59758 11.4691 8.80015 11.7722 9.05551 12.0276C9.31087 12.283 9.61403 12.4855 9.94767 12.6237C10.2813 12.7619 10.6389 12.8331 11.0001 12.8331C11.7294 12.8331 12.4289 12.5433 12.9446 12.0276C13.4603 11.5119 13.7501 10.8124 13.7501 10.0831C13.7501 9.35371 13.4603 8.65424 12.9446 8.13851C12.4289 7.62279 11.7294 7.33306 11.0001 7.33306Z" />
                  </svg>
                  <span>{selectedRange.label}</span>
                </button>

                <button
                  onClick={() => togglePanel("expiry")}
                  className={`${PILL_BASE} shrink-0 ${
                    isExpiryNonDefault ? PILL_SELECTED : PILL_DEFAULT
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 22 22"
                    fill="currentColor"
                  >
                    <path d="M15.5833 3.06124C16.9658 3.85953 18.1159 5.00506 18.9198 6.38443C19.7236 7.76381 20.1532 9.3292 20.1661 10.9256C20.179 12.5221 19.7747 14.0942 18.9933 15.4864C18.2119 16.8786 17.0804 18.0425 15.7109 18.863C14.3414 19.6835 12.7813 20.1322 11.1852 20.1645C9.58901 20.1968 8.01209 19.8116 6.61051 19.0472C5.20893 18.2828 4.0313 17.1656 3.1942 15.8061C2.35709 14.4467 1.88954 12.8922 1.83784 11.2966L1.83325 10.9996L1.83784 10.7026C1.88917 9.11948 2.34984 7.57671 3.17492 6.22465C4.00001 4.8726 5.16135 3.75741 6.54574 2.9878C7.93012 2.2182 9.4903 1.82044 11.0742 1.83331C12.658 1.84618 14.2116 2.26924 15.5833 3.06124ZM10.9999 5.49958C10.7754 5.49961 10.5587 5.58204 10.3909 5.73123C10.2231 5.88043 10.1159 6.08601 10.0897 6.30899L10.0833 6.41624V10.9996L10.0915 11.1197C10.1124 11.2787 10.1747 11.4295 10.2721 11.5569L10.3518 11.6486L13.1018 14.3986L13.188 14.4737C13.3488 14.5985 13.5464 14.6662 13.7499 14.6662C13.9534 14.6662 14.1511 14.5985 14.3118 14.4737L14.398 14.3977L14.4741 14.3115C14.5988 14.1507 14.6665 13.953 14.6665 13.7496C14.6665 13.5461 14.5988 13.3484 14.4741 13.1877L14.398 13.1015L11.9166 10.6192V6.41624L11.9102 6.30899C11.8839 6.08601 11.7767 5.88043 11.6089 5.73123C11.4411 5.58204 11.2244 5.49961 10.9999 5.49958Z" />
                  </svg>
                  <span>{getExpiryLabel()}</span>
                </button>

                <button
                  onClick={() => togglePanel("effect")}
                  className={`${PILL_BASE} shrink-0 ${
                    isEffectNonDefault ? PILL_SELECTED : PILL_DEFAULT
                  }`}
                >
                  {isEffectNonDefault ? (
                    <span className="text-base">{selectedEffect.emoji}</span>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!message.trim() || isSubmitting}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1B1919] text-white font-bold text-sm"
            >
              <span>{isSubmitting ? "..." : "Drop"}</span>
              <svg
                className="w-[18px] h-[18px]"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7.49268 11.625L11.8052 15.1875M11.8052 15.1875L16.1177 11.625M11.8052 15.1875V9.8125C11.8052 5.94651 8.67117 2.8125 4.80518 2.8125H3.36768" />
              </svg>
            </button>
          </div>

          {activePanel === "effect" && (
            <div className="bg-[#F5F1F0] px-4 py-4 safe-area-bottom">
              <div className="grid grid-cols-3 gap-3">
                {EFFECTS.filter((e) => e.id !== "none").map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setEffect(e.id);
                      setActivePanel("none");
                    }}
                    className={`flex flex-col items-center p-4 rounded-2xl transition-all ${
                      effect === e.id
                        ? "bg-white shadow-[inset_0_0_0_2px_#1B1919,0_2px_4px_rgba(0,0,0,0.06)]"
                        : "bg-white"
                    }`}
                  >
                    <span className="text-4xl mb-2">{e.emoji}</span>
                    <span className="text-sm font-bold text-[#1B1919]">
                      {e.label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setEffect("none");
                  setActivePanel("none");
                }}
                className="w-full mt-3 py-2 text-sm text-[#1B1919]/50 font-bold"
              >
                No Effect
              </button>
            </div>
          )}

          {activePanel === "range" && (
            <div className="bg-[#F5F1F0] px-4 py-4 safe-area-bottom">
              <div className="flex flex-col gap-2">
                {DROP_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setRange(option);
                      setActivePanel("none");
                    }}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                      range === option
                        ? "bg-white shadow-[inset_0_0_0_2px_#1B1919,0_2px_4px_rgba(0,0,0,0.06)]"
                        : "bg-white"
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-bold text-[#1B1919]">
                        {DROP_RANGES[option].label}
                      </p>
                      <p className="text-sm text-[#1B1919]/50">
                        {DROP_RANGES[option].description}
                      </p>
                    </div>
                    {range === option && (
                      <svg
                        className="w-5 h-5 text-[#1B1919]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activePanel === "expiry" && (
            <div className="bg-[#F5F1F0] px-4 py-4 safe-area-bottom">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setExpiryUnit("forever");
                    setExpiryValue(null);
                    setActivePanel("none");
                  }}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    expiryUnit === "forever"
                      ? "bg-white shadow-[inset_0_0_0_2px_#1B1919,0_2px_4px_rgba(0,0,0,0.06)]"
                      : "bg-white"
                  }`}
                >
                  <div className="text-left">
                    <p className="font-bold text-[#1B1919]">Forever</p>
                    <p className="text-sm text-[#1B1919]/50">Never expires</p>
                  </div>
                  {expiryUnit === "forever" && (
                    <svg
                      className="w-5 h-5 text-[#1B1919]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </button>
                {[
                  { unit: "hours" as ExpiryUnit, values: [1, 6, 12, 24] },
                  { unit: "days" as ExpiryUnit, values: [1, 3, 7, 14] },
                  { unit: "months" as ExpiryUnit, values: [1, 3, 6, 12] },
                ].map(({ unit, values }) => (
                  <div key={unit} className="bg-white rounded-xl p-3">
                    <p className="text-xs font-bold text-[#1B1919]/50 uppercase mb-2">
                      {unit}
                    </p>
                    <div className="flex gap-2">
                      {values.map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            setExpiryUnit(unit);
                            setExpiryValue(val);
                            setActivePanel("none");
                          }}
                          className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                            expiryUnit === unit && expiryValue === val
                              ? "bg-[#1B1919] text-white"
                              : "bg-[#F5F1F0] text-[#1B1919]"
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePanel === "none" && <div className="safe-area-bottom" />}
        </div>
      </div>
    </>
  );
}

function showDroppedToast(themeColor: string) {
  const toast = document.createElement("div");
  toast.className =
    "fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold shadow-lg z-[100] animate-float-up text-[#1B1919]";
  toast.style.backgroundColor = themeColor;
  toast.textContent = "✨ Dropped!";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 600);
}
