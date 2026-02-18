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
            i <= currentStep ? "text-slate-900" : "text-slate-400"
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              i < currentStep
                ? "bg-slate-900 text-white"
                : i === currentStep
                ? "border-2 border-slate-900 text-slate-900"
                : "border border-slate-300 text-slate-400"
            }`}>
              {i < currentStep ? "\u2713" : i + 1}
            </div>
            <span className="hidden sm:inline">{step}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < currentStep ? "bg-slate-900" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
