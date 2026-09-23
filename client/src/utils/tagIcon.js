import { faCopyright, faTag, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";

export const getTagIcon = (isExisting, type) => !isExisting
    ? faWandMagicSparkles
    : type === "copyright" ? faCopyright : faTag;
