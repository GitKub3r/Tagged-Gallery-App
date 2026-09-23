import { Link } from "react-router-dom";
import { useId } from "react";
import { mediaFormInputClasses } from "../media-form-modal/mediaFormStyles";
import { useTemplates } from "../../hooks/useTemplates";

export const TemplateSelector = ({ onApply }) => {
    const selectId = useId();
    const { data: templates = [], isPending, isError, refetch } = useTemplates();

    return (
        <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            <label className="mb-1.5 block" htmlFor={selectId}>Template</label>
            <select
                id={selectId}
                className={mediaFormInputClasses}
                defaultValue=""
                disabled={isPending || isError || templates.length === 0}
                onChange={(event) => {
                    const selected = templates.find((template) => String(template.id) === event.target.value);
                    if (selected) onApply(selected);
                }}
            >
                <option value="">{isPending ? "Loading templates..." : "Choose a template"}</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            {isError ? <button type="button" className="mt-1 text-xs underline" onClick={() => refetch()}>Could not load templates. Retry</button> : null}
            {!isPending && !isError && templates.length === 0 ? <span className="mt-1 block text-neutral-500 dark:text-neutral-400">No templates yet. <Link className="underline" to="/templates">Create one</Link>.</span> : null}
            {templates.length > 0 ? <span className="mt-1 block text-neutral-500 dark:text-neutral-400">Saved fields are applied. You can adjust them afterwards.</span> : null}
        </div>
    );
};
