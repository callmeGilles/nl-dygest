export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">briefflow</h1>
          <p className="text-sm text-muted-foreground">Set up your newsletter digest</p>
        </div>
        {children}
      </div>
    </div>
  );
}
