import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { isDriveMedia } from "../../utils/mediaSource";

// Indica que el original de la media vive en Google Drive. Hereda tamaño y color del texto de metadatos.
// Solo icono en tarjetas y listas; con etiqueta en el detalle.
export const MediaSourceBadge = ({ media, withLabel = false, withSeparator = false }) => {
    if (!isDriveMedia(media)) return null;

    return (
        <>
            {withSeparator ? <span aria-hidden="true">·</span> : null}
            <span className="inline-flex shrink-0 items-center gap-1.5" title="Stored in Google Drive">
                <FontAwesomeIcon icon={faGoogleDrive} aria-hidden="true" />
                {withLabel ? <span>Google Drive</span> : <span className="sr-only">Stored in Google Drive</span>}
            </span>
        </>
    );
};
