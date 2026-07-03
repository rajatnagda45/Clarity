'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type OnboardingStep = 
  | 'create_workspace' 
  | 'upload_document' 
  | 'watch_indexing' 
  | 'ask_ai' 
  | 'view_citations' 
  | 'invite_team';

interface OnboardingState {
  hasSeenWelcome: boolean;
  isWizardComplete: boolean;
  completedSteps: Record<OnboardingStep, boolean>;
  dismissedSpotlights: Record<string, boolean>;
}

interface OnboardingContextType {
  state: OnboardingState;
  showWelcome: boolean;
  showWizard: boolean;
  showChecklist: boolean;
  markWelcomeSeen: () => void;
  markWizardComplete: () => void;
  completeStep: (step: OnboardingStep) => void;
  dismissSpotlight: (id: string) => void;
  isSpotlightDismissed: (id: string) => boolean;
  restartOnboarding: () => void;
}

const DEFAULT_STATE: OnboardingState = {
  hasSeenWelcome: false,
  isWizardComplete: false,
  completedSteps: {
    create_workspace: false,
    upload_document: false,
    watch_indexing: false,
    ask_ai: false,
    view_citations: false,
    invite_team: false,
  },
  dismissedSpotlights: {}
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);

  // Load from local storage on mount
  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem('clarity_onboarding');
    if (stored) {
      try {
        setState({ ...DEFAULT_STATE, ...JSON.parse(stored) });
      } catch (e) {
        console.error("Failed to parse onboarding state");
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('clarity_onboarding', JSON.stringify(state));
    }
  }, [state, isClient]);

  const markWelcomeSeen = () => {
    setState(s => ({ ...s, hasSeenWelcome: true }));
  };

  const markWizardComplete = () => {
    setState(s => ({ ...s, isWizardComplete: true }));
  };

  const completeStep = (step: OnboardingStep) => {
    setState(s => {
      // Don't trigger re-render if already complete
      if (s.completedSteps[step]) return s;
      return {
        ...s,
        completedSteps: {
          ...s.completedSteps,
          [step]: true
        }
      };
    });
  };

  const dismissSpotlight = (id: string) => {
    setState(s => ({
      ...s,
      dismissedSpotlights: {
        ...s.dismissedSpotlights,
        [id]: true
      }
    }));
  };

  const isSpotlightDismissed = (id: string) => {
    return !!state.dismissedSpotlights[id];
  };

  const restartOnboarding = () => {
    setState(DEFAULT_STATE);
  };

  // Derived state flags for UI rendering
  const showWelcome = isClient && !state.hasSeenWelcome;
  const showWizard = isClient && state.hasSeenWelcome && !state.isWizardComplete;
  
  // Checklist is visible if wizard is done, but not ALL steps are complete
  const allStepsComplete = Object.values(state.completedSteps).every(Boolean);
  const showChecklist = isClient && state.isWizardComplete && !allStepsComplete;

  return (
    <OnboardingContext.Provider value={{
      state,
      showWelcome,
      showWizard,
      showChecklist,
      markWelcomeSeen,
      markWizardComplete,
      completeStep,
      dismissSpotlight,
      isSpotlightDismissed,
      restartOnboarding
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
