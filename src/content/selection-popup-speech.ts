import { logger } from "@/logger";

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultList {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionEvent extends Event {
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

interface SetupSpeechPromptOptions {
  customInput: HTMLInputElement;
  menuContainer: HTMLElement;
  menuShadow: ShadowRoot;
  onSubmitPrompt: (customPrompt: string) => Promise<void>;
  templateList: HTMLDivElement;
}

export interface SpeechPromptController {
  isSupported: boolean;
  isVoiceMode(): boolean;
  reset(): void;
  startFresh(): void;
}

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

export function setupSpeechPrompt({
  customInput,
  menuContainer,
  menuShadow,
  onSubmitPrompt,
  templateList,
}: SetupSpeechPromptOptions): SpeechPromptController {
  const micButton = menuShadow.querySelector(".mic-button") as HTMLButtonElement;
  const voiceBackButton = menuShadow.querySelector(".voice-back-button") as HTMLButtonElement;
  const speechTranscriptElement = menuShadow.querySelector(".speech-textarea") as HTMLTextAreaElement;
  const speechStatusElement = menuShadow.querySelector(".speech-status") as HTMLDivElement;
  const speechToggleButton = menuShadow.querySelector(".speech-toggle-button") as HTMLButtonElement;
  const speechToggleLabel = menuShadow.querySelector(".speech-toggle-label") as HTMLSpanElement;
  const speechSubmitButton = menuShadow.querySelector(".speech-submit-button") as HTMLButtonElement;
  const speechRecognitionConstructor = getSpeechRecognitionConstructor();
  const isSpeechRecognitionSupported = Boolean(speechRecognitionConstructor);

  let speechRecognition: BrowserSpeechRecognition | null = null;
  let isVoiceListening = false;
  let isVoiceMode = false;
  let speechTranscript = "";
  let speechErrorMessage = "";

  const setSpeechTranscript = (value: string, placeholder = "Listening for your prompt...") => {
    speechTranscript = value.trim();
    speechTranscriptElement.value = speechTranscript;
    speechTranscriptElement.placeholder = placeholder;
    speechTranscriptElement.dataset.empty = speechTranscript ? "false" : "true";
    speechSubmitButton.disabled = !speechTranscript;
  };

  const setVoiceMode = (enabled: boolean) => {
    isVoiceMode = enabled;
    menuContainer.dataset.mode = enabled ? "voice" : "default";
    templateList.style.display = enabled ? "none" : templateList.childElementCount > 0 ? "flex" : "none";
    if (!enabled) {
      customInput.focus();
    }
  };

  const setSpeechToggleState = (listening: boolean) => {
    speechToggleLabel.textContent = listening ? "Stop" : "Speak";
  };

  const reset = () => {
    if (speechRecognition) {
      speechRecognition.onresult = null;
      speechRecognition.onerror = null;
      speechRecognition.onend = null;
      speechRecognition.abort();
      speechRecognition = null;
    }

    isVoiceListening = false;
    speechErrorMessage = "";
    setSpeechTranscript("");
    speechStatusElement.textContent = "Listening...";
    setSpeechToggleState(false);
    speechToggleButton.disabled = false;
    setVoiceMode(false);
  };

  const stopVoiceCapture = () => {
    if (!speechRecognition) {
      return;
    }

    isVoiceListening = false;
    speechStatusElement.textContent = speechTranscript ? "Review and press OK." : "Waiting for speech to finish...";
    speechToggleButton.disabled = true;
    speechRecognition.stop();
  };

  const startVoiceCapture = (appendToExistingTranscript: boolean) => {
    if (!speechRecognitionConstructor) {
      return;
    }

    if (speechRecognition) {
      speechRecognition.abort();
    }

    const recognition = new speechRecognitionConstructor();
    speechRecognition = recognition;
    isVoiceListening = true;
    speechErrorMessage = "";

    const transcriptPrefix = appendToExistingTranscript ? speechTranscript.trim() : "";
    if (!appendToExistingTranscript) {
      speechTranscript = "";
    }

    setVoiceMode(true);
    setSpeechTranscript(speechTranscript);
    speechStatusElement.textContent = "Listening...";
    setSpeechToggleState(true);
    speechToggleButton.disabled = false;

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || navigator.language || "en-US";

    recognition.onresult = (event) => {
      let nextTranscript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];

        if (alternative?.transcript) {
          nextTranscript += `${alternative.transcript} `;
        }
      }

      const combinedTranscript = transcriptPrefix ? `${transcriptPrefix} ${nextTranscript}` : nextTranscript;
      setSpeechTranscript(combinedTranscript);
      speechStatusElement.textContent = "Listening...";
    };

    recognition.onerror = (event) => {
      isVoiceListening = false;
      speechToggleButton.disabled = false;
      logger.error("Speech recognition error:", event.error);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        speechErrorMessage = "Microphone permission was denied.";
      } else if (event.error === "no-speech") {
        speechErrorMessage = "No speech detected. Try again.";
      } else if (event.error === "audio-capture") {
        speechErrorMessage = "No microphone was available.";
      } else if (event.error === "network") {
        speechErrorMessage = "Speech service was unavailable.";
      } else if (event.error === "aborted") {
        speechErrorMessage = "Voice input was aborted.";
      } else {
        speechErrorMessage = `Voice input failed (${event.error}).`;
      }

      speechStatusElement.textContent = speechErrorMessage;
    };

    recognition.onend = () => {
      speechRecognition = null;
      isVoiceListening = false;
      speechToggleButton.disabled = false;
      setSpeechToggleState(false);
      speechStatusElement.textContent =
        speechErrorMessage || (speechTranscript ? "Review and press OK." : "No speech detected. Try again.");
      if (!speechTranscript) {
        speechTranscriptElement.focus();
      }
    };

    recognition.start();
  };

  micButton.dataset.supported = isSpeechRecognitionSupported ? "true" : "false";

  speechTranscriptElement.addEventListener("input", () => {
    const nextValue = speechTranscriptElement.value.trim();
    speechTranscript = nextValue;
    speechTranscriptElement.dataset.empty = nextValue ? "false" : "true";
    speechSubmitButton.disabled = !nextValue;
  });

  micButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSpeechRecognitionSupported) {
      return;
    }

    customInput.value = "";
    startVoiceCapture(false);
  });

  voiceBackButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    reset();
  });

  speechToggleButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isVoiceListening) {
      stopVoiceCapture();
      return;
    }

    startVoiceCapture(true);
  });

  speechSubmitButton.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const customPrompt = speechTranscript.trim();
    if (!customPrompt) {
      return;
    }

    if (speechRecognition) {
      speechRecognition.abort();
      speechRecognition = null;
    }

    await onSubmitPrompt(customPrompt);
    customInput.value = "";
  });

  return {
    isSupported: isSpeechRecognitionSupported,
    isVoiceMode: () => isVoiceMode,
    reset,
    startFresh: () => startVoiceCapture(false),
  };
}
