"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingStepper } from "./onboarding-stepper";
import { Check } from "lucide-react";

interface Label {
  id: string;
  name: string;
  messagesTotal: number;
}

interface LabelPickerProps {
  mode?: "onboarding" | "settings";
  onSaved?: () => void;
}

export function LabelPicker({ mode = "onboarding", onSaved }: LabelPickerProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Load labels and current preferences in parallel
    Promise.all([
      fetch("/api/labels").then((r) => r.json()),
      mode === "settings"
        ? fetch("/api/preferences").then((r) => r.json())
        : Promise.resolve(null),
    ]).then(([labelsData, prefs]) => {
      setLabels(labelsData);
      if (prefs?.gmailLabels) {
        try {
          const savedLabels = JSON.parse(prefs.gmailLabels);
          setSelected(savedLabels);
        } catch {
          if (prefs.gmailLabel) setSelected([prefs.gmailLabel]);
        }
      } else if (mode === "onboarding") {
        const newsletters = labelsData.find(
          (l: Label) => l.name.toLowerCase() === "newsletters"
        );
        if (newsletters) setSelected([newsletters.name]);
      }
      setLoading(false);
    });
  }, [mode]);

  const toggleLabel = (name: string) => {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length < 3
          ? [...prev, name]
          : prev
    );
  };

  const handleSave = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmailLabels: selected }),
    });
    if (onSaved) {
      onSaved();
    } else {
      router.push("/onboarding/interests");
    }
  };

  return (
    <div className="space-y-6">
      {mode === "onboarding" && (
        <OnboardingStepper currentStep={1} steps={["Connect", "Labels", "Interests"]} />
      )}

      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {mode === "settings" ? "Gmail labels" : "Choose your newsletter folders"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select up to 3 Gmail labels that contain your newsletters
        </p>
      </div>

      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))
        ) : (
          labels.map((label) => {
            const isSelected = selected.includes(label.name);
            return (
              <button
                key={label.id}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isSelected
                    ? "bg-foreground text-background"
                    : "bg-card hover:bg-secondary border border-border"
                }`}
                onClick={() => toggleLabel(label.name)}
              >
                <span className="flex items-center gap-2">
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                  <span className="font-medium">{label.name}</span>
                </span>
                <span className={`text-xs ${isSelected ? "text-background/60" : "text-muted-foreground"}`}>
                  {label.messagesTotal} messages
                </span>
              </button>
            );
          })
        )}
      </div>

      {selected.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {selected.length}/3 selected
        </p>
      )}

      <Button
        onClick={handleSave}
        disabled={selected.length === 0 || saving}
        className="w-full rounded-xl h-12 text-base"
        size="lg"
      >
        {saving ? "Saving..." : mode === "settings" ? "Save" : "Continue"}
      </Button>
    </div>
  );
}
