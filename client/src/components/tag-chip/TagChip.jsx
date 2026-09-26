import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getTagIcon } from "../../utils/tagIcon";
import { buildTagChipStyle } from "../../utils/tagStyle";

// Chip de tag de solo lectura (DESIGN.md §7.4). isExisting: la tag ya está guardada en la biblioteca.
export const TagChip = ({ tag, color, type, isExisting = true }) => (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-xl border px-2 py-1 text-xs font-semibold" style={buildTagChipStyle(color)} title={tag}>
        <FontAwesomeIcon icon={getTagIcon(isExisting, type)} aria-hidden="true" />
        <span className="truncate">{tag}</span>
    </span>
);
