interface OnboardingStepperProps {
  currentStep: number;
  steps: string[];
}

export function OnboardingStepper({ currentStep, steps }: OnboardingStepperProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-sm ${
            i <= currentStep ? "text-foreground" : "text-muted-foreground/50"
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              i < currentStep
                ? "bg-foreground text-background"
                : i === currentStep
                ? "border-2 border-foreground text-foreground"
                : "border border-border text-muted-foreground/50"
            }`}>
              {i < currentStep ? "\u2713" : i + 1}
            </div>
            <span className="hidden sm:inline">{step}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < currentStep ? "bg-foreground" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
