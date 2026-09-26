import { Link } from "react-router-dom";
import { useState } from "react";
import { SelectField } from "../select-field/SelectField";
import { useTemplates } from "../../hooks/useTemplates";

export const TemplateSelector = ({ onApply }) => {
    const [selectedId, setSelectedId] = useState("");
    const { data: templates = [], isPending, isError, refetch } = useTemplates();
    const selectedTemplate = templates.find((template) => String(template.id) === selectedId);

    return (
        <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            <SelectField
                label="Template"
                value={selectedTemplate ? selectedId : ""}
                disabled={isPending || isError || templates.length === 0}
                placeholder={isPending ? "Loading templates..." : "Choose a template"}
                options={templates.map((template) => ({ value: String(template.id), label: template.name }))}
                onChange={(value) => {
                    setSelectedId(value);
                    const selected = templates.find((template) => String(template.id) === value);
                    if (selected) onApply(selected);
                }}
            />
            {isError ? <button type="button" className="mt-1 w-auto! border-0! bg-transparent! p-0! text-xs! text-neutral-600! underline! shadow-none! dark:text-neutral-300!" onClick={() => refetch()}>Could not load templates. Retry</button> : null}
            {!isPending && !isError && templates.length === 0 ? <span className="mt-1 block text-neutral-500 dark:text-neutral-400">No templates yet. <Link className="underline" to="/templates">Create one</Link>.</span> : null}
            {selectedTemplate ? <div className="mt-1 flex items-center justify-between gap-2 text-neutral-500 dark:text-neutral-400"><span>{selectedTemplate.mark_favourite ? "Will add to favourites on save. " : ""}Edits here do not change the template.</span><button type="button" className="w-auto! shrink-0 border-0! bg-transparent! p-0! text-xs! font-semibold! text-neutral-600! underline! shadow-none! dark:text-neutral-300!" onClick={() => onApply(selectedTemplate)}>Reapply</button></div> : null}
        </div>
    );
};
