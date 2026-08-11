import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { EmptyState } from "../empty-state/EmptyState";

export const LoadErrorState = ({ title = "Could not load this page", onRetry, placement = "page" }) => {
    const handleRetry = onRetry || (() => window.location.reload());

    return (
        <EmptyState
            title={title}
            icon={faRotate}
            actionLabel="Try again"
            onAction={handleRetry}
            placement={placement}
        />
    );
};
