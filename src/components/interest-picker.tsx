"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnboardingStepper } from "./onboarding-stepper";
import { X } from "lucide-react";

const SUGGESTED_TOPICS = [
  "AI", "SaaS", "Startups", "Product", "Engineering",
  "Marketing", "Finance", "Design", "Leadership",
  "Health", "Climate", "Crypto",
];

interface InterestPickerProps {
  mode?: "onboarding" | "settings";
  onSaved?: () => void;
}

export function InterestPicker({ mode = "onboarding", onSaved }: InterestPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(mode === "onboarding");
  const router = useRouter();

  // In settings mode, load current interests
  useEffect(() => {
    if (mode !== "settings") return;
    fetch("/api/interests")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSelected(data as string[]);
        }
        setLoaded(true);
      });
  }, [mode]);

  const isSelected = (topic: string) =>
    selected.some((t) => t.toLowerCase() === topic.toLowerCase());

  const toggleTopic = (topic: string) => {
    if (isSelected(topic)) {
      setSelected((prev) =>
        prev.filter((t) => t.toLowerCase() !== topic.toLowerCase())
      );
    } else if (selected.length < 8) {
      setSelected((prev) => [...prev, topic]);
    }
  };

  const addCustom = () => {
    const topic = customInput.trim();
    if (!topic || selected.length >= 8) return;

    // If it matches a suggested topic (case-insensitive), select that instead
    const matchingSuggested = SUGGESTED_TOPICS.find(
      (t) => t.toLowerCase() === topic.toLowerCase()
    );

    if (matchingSuggested) {
      if (!isSelected(matchingSuggested)) {
        setSelected((prev) => [...prev, matchingSuggested]);
      }
    } else if (!isSelected(topic)) {
      setSelected((prev) => [...prev, topic]);
    }

    setCustomInput("");
  };

  const handleSave = async () => {
    if (selected.length < 3) return;
    setSaving(true);
    await fetch("/api/interests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics: selected }),
    });
    if (onSaved) {
      onSaved();
    } else {
      router.push("/gazette");
    }
  };

  // Custom topics = selected items not in the suggested list
  const customTopics = selected.filter(
    (t) => !SUGGESTED_TOPICS.some((s) => s.toLowerCase() === t.toLowerCase())
  );

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      {mode === "onboarding" && (
        <OnboardingStepper currentStep={2} steps={["Connect", "Labels", "Interests"]} />
      )}

      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {mode === "settings" ? "Your interests" : "What topics matter to you?"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
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
              isSelected(topic)
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:bg-border"
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
          className="flex-1 px-4 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
      {customTopics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customTopics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-foreground text-background"
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
      <p className="text-center text-xs text-muted-foreground">
        {selected.length}/8 selected {selected.length < 3 && `(${3 - selected.length} more needed)`}
      </p>

      <Button
        onClick={handleSave}
        disabled={selected.length < 3 || saving}
        className="w-full rounded-xl h-12 text-base"
        size="lg"
      >
        {saving ? "Saving..." : mode === "settings" ? "Save" : "Start reading"}
      </Button>
    </div>
  );
}
