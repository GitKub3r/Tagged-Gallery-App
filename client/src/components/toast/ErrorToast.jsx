import { useEffect } from "react";
import { toast } from "sonner";

export const ErrorToast = ({ message }) => {
    useEffect(() => {
        if (message) toast.error(message);
    }, [message]);
    return null;
};
