import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function LoginPage() {
  return (
    <AuthLayout>
      <div className="relative">
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/signup"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "w-full bg-[rgba(15,17,23,0.82)] backdrop-blur-2xl border border-white/[0.08] rounded-[24px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] p-8 sm:p-10 m-0",
              headerTitle: "text-3xl font-bold text-white font-sans tracking-tight",
              headerSubtitle: "text-gray-400 font-sans text-base mt-2",
              
              // Social Buttons
              socialButtonsBlockButton: "bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300 rounded-xl py-3 shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
              socialButtonsBlockButtonText: "font-semibold",
              socialButtonsProviderIcon: "scale-110",
              
              // Divider
              dividerLine: "bg-white/10",
              dividerText: "text-gray-500 font-medium text-sm tracking-wider uppercase",
              
              // Form Elements
              formFieldLabel: "text-sm font-medium text-gray-300 mb-2 clerk-label",
              formFieldInput: "bg-[#05070B] border border-white/10 text-white focus:border-blue-500/50 focus:bg-blue-500/[0.02] rounded-xl px-4 py-3.5 h-auto transition-all duration-300 clerk-input focus:ring-4 focus:ring-blue-500/10",
              formButtonPrimary: "bg-gradient-to-r from-[#4F8CFF] to-[#7C5CFF] hover:from-[#3a75e5] hover:to-[#6a4ae5] text-white rounded-xl py-3.5 shadow-[0_0_20px_rgba(79,140,255,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(79,140,255,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] hover:-translate-y-0.5 transition-all duration-300 font-semibold text-base flex items-center justify-center relative overflow-hidden group clerk-primary-btn",
              
              // Links & Text
              footerActionText: "text-gray-400 font-medium",
              footerActionLink: "text-[#4F8CFF] hover:text-white font-semibold transition-colors duration-300",
              identityPreviewText: "text-gray-300",
              identityPreviewEditButtonIcon: "text-[#4F8CFF]",
              
              // Verification / OTP
              formFieldInputShowPasswordButton: "text-gray-400 hover:text-white transition-colors duration-300",
              otpCodeFieldInput: "bg-[#05070B] border border-white/10 text-white focus:border-blue-500/50 rounded-xl",
            },
            layout: {
              socialButtonsPlacement: "bottom",
              socialButtonsVariant: "blockButton",
              logoPlacement: "none", 
            },
            variables: {
              colorPrimary: "#4F8CFF",
              colorBackground: "transparent",
              colorText: "white",
              colorInputBackground: "#05070B",
              colorInputText: "white",
              fontFamily: "var(--font-sans)",
            }
          }}
        />

        {/* Global CSS Overrides for precise Clerk micro-interactions */}
        <style dangerouslySetInnerHTML={{__html: `
          /* Focus-within label glow effect */
          .cl-formFieldRow:has(.clerk-input:focus) .clerk-label {
            color: #4F8CFF !important;
            text-shadow: 0 0 10px rgba(79, 140, 255, 0.3);
            transition: all 0.3s ease;
          }

          /* Placeholder animations */
          .clerk-input::placeholder {
            color: rgba(255, 255, 255, 0.2);
            transition: color 0.3s ease;
          }
          .clerk-input:focus::placeholder {
            color: transparent;
          }

          /* Primary Button Ripple/Sweep effect */
          .clerk-primary-btn::after {
            content: "";
            position: absolute;
            top: 0;
            left: -100%;
            width: 50%;
            height: 100%;
            background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent);
            transform: skewX(-20deg);
            transition: 0.5s ease;
          }
          .clerk-primary-btn:hover::after {
            left: 150%;
          }
        `}} />
      </div>
    </AuthLayout>
  );
}
