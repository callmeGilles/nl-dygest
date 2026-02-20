"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingStepper } from "./onboarding-stepper";
import { Check } from "lucide-react";

interface Label {
  id: string;
  name: string;
  messagesTotal: number;
}

export function LabelPicker() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/labels")
      .then((r) => r.json())
      .then((data) => {
        setLabels(data);
        // Auto-select "Newsletters" if it exists
        const newsletters = data.find(
          (l: Label) => l.name.toLowerCase() === "newsletters"
        );
        if (newsletters) setSelected([newsletters.name]);
        setLoading(false);
      });
  }, []);

  const toggleLabel = (name: string) => {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length < 3
          ? [...prev, name]
          : prev
    );
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmailLabels: selected }),
    });
    router.push("/onboarding/interests");
  };

  return (
    <div className="space-y-6">
      <OnboardingStepper currentStep={1} steps={["Connect", "Labels", "Interests"]} />

      <div className="text-center">
        <h2 className="text-xl font-semibold text-stone-900">
          Choose your newsletter folders
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          Select up to 3 Gmail labels that contain your newsletters
        </p>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : (
          labels.map((label) => (
            <Card
              key={label.id}
              className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                selected.includes(label.name)
                  ? "ring-2 ring-stone-900 bg-stone-50"
                  : "hover:bg-stone-50"
              }`}
              onClick={() => toggleLabel(label.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selected.includes(label.name) && (
                    <Check className="h-4 w-4 text-stone-900" />
                  )}
                  <span className="font-medium text-stone-900">{label.name}</span>
                </div>
                <span className="text-sm text-stone-400">
                  {label.messagesTotal} messages
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      {selected.length > 0 && (
        <p className="text-center text-xs text-stone-400">
          {selected.length}/3 selected
        </p>
      )}

      <Button
        onClick={handleContinue}
        disabled={selected.length === 0 || saving}
        className="w-full rounded-xl h-12 text-base"
        size="lg"
      >
        {saving ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}
