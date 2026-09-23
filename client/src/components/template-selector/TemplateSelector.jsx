import { Link } from "react-router-dom";
import { useId, useState } from "react";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { mediaFormInputClasses } from "../media-form-modal/mediaFormStyles";
import { useTemplates } from "../../hooks/useTemplates";

export const TemplateSelector = ({ onApply }) => {
    const selectId = useId();
    const [selectedId, setSelectedId] = useState("");
    const { data: templates = [], isPending, isError, refetch } = useTemplates();
    const selectedTemplate = templates.find((template) => String(template.id) === selectedId);

    return (
        <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            <label className="mb-1.5 block" htmlFor={selectId}>Template</label>
            <div className="relative">
                <select
                    id={selectId}
                    className={`${mediaFormInputClasses} appearance-none pr-10`}
                    value={selectedTemplate ? selectedId : ""}
                    disabled={isPending || isError || templates.length === 0}
                    onChange={(event) => {
                        setSelectedId(event.target.value);
                        const selected = templates.find((template) => String(template.id) === event.target.value);
                        if (selected) onApply(selected);
                    }}
                >
                    <option value="">{isPending ? "Loading templates..." : "Choose a template"}</option>
                    {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
            </div>
            {isError ? <button type="button" className="mt-1 w-auto! border-0! bg-transparent! p-0! text-xs! text-neutral-600! underline! shadow-none! dark:text-neutral-300!" onClick={() => refetch()}>Could not load templates. Retry</button> : null}
            {!isPending && !isError && templates.length === 0 ? <span className="mt-1 block text-neutral-500 dark:text-neutral-400">No templates yet. <Link className="underline" to="/templates">Create one</Link>.</span> : null}
            {selectedTemplate ? <div className="mt-1 flex items-center justify-between gap-2 text-neutral-500 dark:text-neutral-400"><span>{selectedTemplate.mark_favourite ? "Will add to favourites on save. " : ""}Edits here do not change the template.</span><button type="button" className="w-auto! shrink-0 border-0! bg-transparent! p-0! text-xs! font-semibold! text-neutral-600! underline! shadow-none! dark:text-neutral-300!" onClick={() => onApply(selectedTemplate)}>Reapply</button></div> : null}
        </div>
    );
};
