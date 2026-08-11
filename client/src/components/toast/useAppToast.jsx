import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ProgressToast } from "./ProgressToast";

export const useAppToast = (data, { id, onDismiss, onCancel } = {}) => {
    const dismissRef = useRef(onDismiss);
    const cancelRef = useRef(onCancel);

    useEffect(() => {
        dismissRef.current = onDismiss;
        cancelRef.current = onCancel;
    }, [onDismiss, onCancel]);

    useEffect(() => {
        if (!data) {
            toast.dismiss(id);
            return;
        }

        const hasProgress = typeof data.progress === "number" || data.indeterminate || data.speedLabel;
        const handleCancel = cancelRef.current
            ? () => {
                  cancelRef.current?.();
                  toast.dismiss(id);
              }
            : null;
        const commonOptions = {
            id,
            closeButton: true,
            duration: hasProgress ? Infinity : data.duration,
            description: hasProgress ? undefined : data.message,
            onDismiss: () => dismissRef.current?.(),
            onAutoClose: () => dismissRef.current?.(),
            action: !hasProgress && handleCancel ? { label: "Cancel", onClick: handleCancel } : undefined,
        };

        if (hasProgress) {
            toast.custom(
                () => <ProgressToast data={data} onCancel={handleCancel} />,
                commonOptions,
            );
        } else if (data.status === "error") {
            toast.error(data.title || "Something went wrong", commonOptions);
        } else if (data.status === "success") {
            toast.success(data.title || "Done", commonOptions);
        } else {
            toast.info(data.title || "Notice", commonOptions);
        }
    }, [data, id]);

    useEffect(() => () => toast.dismiss(id), [id]);
};
