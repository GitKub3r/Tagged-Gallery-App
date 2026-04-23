import { useCallback, useState } from "react";

export const useForm = (initialValues = {}) => {
    const [values, setValues] = useState(initialValues);

    const handleChange = useCallback((event) => {
        const { name, value, type, checked } = event.target;
        setValues((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    }, []);

    const register = useCallback(
        (name) => ({
            name,
            value: values[name] ?? "",
            onChange: handleChange,
        }),
        [handleChange, values],
    );

    const setValue = useCallback((name, value) => {
        setValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    }, []);

    const reset = useCallback(
        (nextValues = initialValues) => {
            setValues(nextValues);
        },
        [initialValues],
    );

    return {
        values,
        setValues,
        handleChange,
        register,
        setValue,
        reset,
    };
};
