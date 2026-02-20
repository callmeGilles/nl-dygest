"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnboardingStepper } from "./onboarding-stepper";
import { X } from "lucide-react";

const SUGGESTED_TOPICS = [
  "AI", "SaaS", "Startups", "Product", "Engineering",
  "Marketing", "Finance", "Design", "Leadership",
  "Health", "Climate", "Crypto",
];

export function InterestPicker() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const toggleTopic = (topic: string) => {
    setSelected((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : prev.length < 8
          ? [...prev, topic]
          : prev
    );
  };

  const addCustom = () => {
    const topic = customInput.trim();
    if (topic && !selected.includes(topic) && selected.length < 8) {
      setSelected((prev) => [...prev, topic]);
      setCustomInput("");
    }
  };

  const handleContinue = async () => {
    if (selected.length < 3) return;
    setSaving(true);
    await fetch("/api/interests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics: selected }),
    });
    router.push("/gazette");
  };

  return (
    <div className="space-y-6">
      <OnboardingStepper currentStep={2} steps={["Connect", "Labels", "Interests"]} />

      <div className="text-center">
        <h2 className="text-xl font-semibold text-stone-900">
          What topics matter to you?
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          Pick 3-8 topics. We&apos;ll use these to curate your gazette.
        </p>
      </div>

      {/* Suggested chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        {SUGGESTED_TOPICS.map((topic) => (
          <button
            key={topic}
            onClick={() => toggleTopic(topic)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selected.includes(topic)
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add your own..."
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          className="flex-1 px-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
        <Button
          variant="outline"
          onClick={addCustom}
          disabled={!customInput.trim() || selected.length >= 8}
          className="rounded-xl"
        >
          Add
        </Button>
      </div>

      {/* Selected custom topics (remove button) */}
      {selected.filter((t) => !SUGGESTED_TOPICS.includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected
            .filter((t) => !SUGGESTED_TOPICS.includes(t))
            .map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-stone-900 text-white"
              >
                {topic}
                <button onClick={() => toggleTopic(topic)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
        </div>
      )}

      {/* Counter */}
      <p className="text-center text-xs text-stone-400">
        {selected.length}/8 selected {selected.length < 3 && `(${3 - selected.length} more needed)`}
      </p>

      <Button
        onClick={handleContinue}
        disabled={selected.length < 3 || saving}
        className="w-full rounded-xl h-12 text-base"
        size="lg"
      >
        {saving ? "Saving..." : "Start reading"}
      </Button>
    </div>
  );
}
