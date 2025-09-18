interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-col justify-center px-12 bg-muted">
        <div className="max-w-md">
          <div className="mb-8">
            <img
              src="https://assets.polymet.ai/blushing-purple-167610"
              alt="Ringer"
              className="h-10 w-auto mb-2"
            />

            <p className="text-sm text-muted-foreground">
              Communications Platform
            </p>
          </div>

          <blockquote className="space-y-4">
            <p className="text-lg">
              "Ringer has transformed our communication infrastructure. The
              platform is reliable, scalable, and incredibly easy to manage."
            </p>
            <footer className="text-sm">
              <strong>Sarah Johnson</strong> - CTO, TechCorp
            </footer>
          </blockquote>

          <div className="mt-8 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary rounded-full" />

              <span className="text-sm">99.9% uptime guarantee</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary rounded-full" />

              <span className="text-sm">Enterprise-grade security</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary rounded-full" />

              <span className="text-sm">24/7 technical support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex flex-col justify-center px-8 py-12">
        <div className="mx-auto w-full max-w-sm">
          {/* Desktop logo */}
          <div className="flex items-center justify-center mb-8">
            <img
              src="https://assets.polymet.ai/blushing-purple-167610"
              alt="Ringer"
              className="h-8 w-auto"
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
