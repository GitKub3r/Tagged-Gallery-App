import { faBullseye, faFeather, faScaleBalanced } from "@fortawesome/free-solid-svg-icons";

// Niveles de confianza del asistente (los umbrales viven en server/utils/aiTagSuggestions.js).
export const STRICTNESS_LEVELS = [
    { value: "strict", label: "Strict", icon: faBullseye, description: "Adds fewer tags, only when several very similar media agree." },
    { value: "balanced", label: "Balanced", icon: faScaleBalanced, description: "Recommended. Most tags it adds are right; a few may need removing." },
    { value: "relaxed", label: "Relaxed", icon: faFeather, description: "Adds more tags with less agreement. Expect more to review." },
];

export const getStrictnessLevel = (value) => STRICTNESS_LEVELS.find((level) => level.value === value) || STRICTNESS_LEVELS[1];
