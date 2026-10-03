import { faSpinner, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useIsAiReady, useTagMediaWithAi } from "../../hooks/useAiAssistant";

// "Tag with AI" en la barra de selección de la galería y de los álbumes: añade a las medias elegidas las tags que el
// usuario ya usa en medias parecidas. Solo aparece con el asistente instalado. Usa la clase de botón de esa barra
// (legado de GalleryPage.css) para verse igual que el resto de sus acciones.
export const AiTagSelectionButton = ({ mediaIds, onTagged }) => {
    const isAiReady = useIsAiReady();
    const tagMutation = useTagMediaWithAi();
    if (!isAiReady) return null;

    const count = mediaIds.length;
    return (
        <button
            type="button"
            className="tagged-gallery-selection-icon-button"
            disabled={count === 0 || tagMutation.isPending}
            onClick={() => tagMutation.mutate(mediaIds, { onSuccess: (result) => result.changedCount > 0 && onTagged?.() })}
            aria-label={`Tag ${count} selected media with AI`}
            title={tagMutation.isPending ? "Tagging with AI..." : "Tag selected media with AI"}
        >
            <FontAwesomeIcon icon={tagMutation.isPending ? faSpinner : faWandMagicSparkles} spin={tagMutation.isPending} className="motion-reduce:animate-none" aria-hidden="true" />
        </button>
    );
};
