import { useState } from "react";
import "./Input.css";

export const Input = ({ label, type = "text", name, value, onChange }) => {
    const [internalValue, setInternalValue] = useState("");
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;

    const handleChange = (event) => {
        if (!isControlled) {
            setInternalValue(event.target.value);
        }
        onChange?.(event);
    };

    return (
        <div className="tagged-input-container">
            <input
                className="tagged-input"
                type={type}
                id={name}
                name={name}
                value={currentValue}
                onChange={handleChange}
                placeholder=" "
            />
            {label && (
                <label className="tagged-input-label" htmlFor={name}>
                    {label}
                </label>
            )}
        </div>
    );
};
