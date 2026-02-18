"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingStepper } from "./onboarding-stepper";

interface Label {
  id: string;
  name: string;
  messagesTotal: number;
}

export function LabelPicker() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
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
        if (newsletters) setSelected(newsletters.name);
        setLoading(false);
      });
  }, []);

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmailLabel: selected }),
    });
    router.push("/triage");
  };

  return (
    <div className="space-y-6">
      <OnboardingStepper currentStep={1} steps={["Connect", "Select", "Triage"]} />

      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Choose your newsletter folder</h2>
        <p className="text-sm text-slate-500 mt-1">
          Select the Gmail label that contains your newsletters
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
                selected === label.name
                  ? "ring-2 ring-slate-900 bg-slate-50"
                  : "hover:bg-slate-50"
              }`}
              onClick={() => setSelected(label.name)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{label.name}</span>
                <span className="text-sm text-slate-400">
                  {label.messagesTotal} messages
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      <Button
        onClick={handleContinue}
        disabled={!selected || saving}
        className="w-full rounded-xl h-12 text-base"
        size="lg"
      >
        {saving ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}
