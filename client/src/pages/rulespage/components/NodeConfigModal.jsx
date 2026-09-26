import { useState } from "react";
import { Link } from "react-router-dom";
import { faCheck, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { CheckboxOption } from "../../../components/checkbox-control/CheckboxOption";
import { ChipListField, MediaFormModal, MediaTagsField } from "../../../components/media-form-modal/MediaFormModal";
import { mediaFormInputClasses } from "../../../components/media-form-modal/mediaFormStyles";
import { SelectField } from "../../../components/select-field/SelectField";
import { useAlbums } from "../../../hooks/useAlbums";
import { useMediaMetadataForm } from "../../../hooks/useMediaMetadataForm";
import { useMetadata } from "../../../hooks/useMetadata";
import { MEDIA_TYPE_OPTIONS, RULE_CATEGORIES, RULE_NODE_TYPES, RULE_OPTION_LABELS, SIZE_UNITS } from "../../../utils/ruleGraph";
import { buildTagChipStyle } from "../../../utils/tagStyle";

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

const NumberField = ({ label, value, onChange, placeholder, step = "1" }) => (
    <label className="min-w-0 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        <span className="mb-1.5 block">{label}</span>
        <input className={mediaFormInputClasses} type="number" inputMode={step === "1" ? "numeric" : "decimal"} min="0" step={step} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
);

const Hint = ({ children }) => <p className="text-xs text-neutral-500 dark:text-neutral-400">{children}</p>;

// Formulario de cada tipo de nodo. Los campos de tags, nombre y autor reutilizan los del formulario de medias,
// con sus sugerencias. draft: configuración en edición; form: estado de useMediaMetadataForm.
const NodeConfigFields = ({ type, draft, setDraft, form, metadataProps }) => {
    const albumsQuery = useAlbums(type === "action.addToAlbum");
    const update = (changes) => setDraft((current) => ({ ...current, ...changes }));
    const tagsField = (autoFocus) => <MediaTagsField {...form.fieldProps} {...metadataProps} autoFocus={autoFocus} compact />;

    switch (type) {
        case "condition.tags":
            return (
                <>
                    <SelectField autoFocus label="Match" value={draft.match} onChange={(match) => update({ match })} options={toOptions(RULE_OPTION_LABELS.TAG_MATCHES)} />
                    {draft.match === "empty" ? <Hint>The Google Drive tag doesn&apos;t count, so Drive media with only that tag also match.</Hint> : tagsField(false)}
                </>
            );
        case "condition.name":
        case "condition.author": {
            const isName = type === "condition.name";
            const subject = isName ? "media name" : "author";
            const { fieldProps } = form;
            return (
                <>
                    <SelectField autoFocus label="Operator" value={draft.operator} onChange={(operator) => update({ operator })} options={toOptions(RULE_OPTION_LABELS.TEXT_OPERATORS)} />
                    {draft.operator !== "empty" ? (
                        <ChipListField
                            label={isName ? "Media names" : "Authors"}
                            inputValue={fieldProps.tagInput}
                            values={fieldProps.selectedTags}
                            suggestions={fieldProps.tagSuggestions}
                            activeSuggestionField={fieldProps.activeSuggestionField}
                            activeSuggestionIndex={fieldProps.activeSuggestionIndex}
                            placeholder={isName ? "Type a media name and press Enter" : "Type an author and press Enter"}
                            emptyText={isName ? "No media names added" : "No authors added"}
                            maxLength={isName ? 255 : 100}
                            getChipIcon={() => RULE_NODE_TYPES[type].icon}
                            onInputChange={fieldProps.onTagInputChange}
                            onOpenSuggestions={fieldProps.onOpenSuggestions}
                            onCloseSuggestions={fieldProps.onCloseSuggestions}
                            onSuggestionKeyDown={fieldProps.onSuggestionKeyDown}
                            onAdd={fieldProps.onAddTag}
                            onRemove={fieldProps.onRemoveTag}
                            compact
                        />
                    ) : null}
                    <Hint>
                        {draft.operator === "empty"
                            ? `Matches media without a ${subject}.`
                            : `Matches when the ${subject} ${draft.operator === "contains" ? "contains" : "is"} any of these values. Letter case doesn't matter.`}
                    </Hint>
                </>
            );
        }
        case "condition.size":
            return (
                <>
                    <SelectField autoFocus label="Operator" value={draft.operator} onChange={(operator) => update({ operator })} options={toOptions(RULE_OPTION_LABELS.SIZE_OPERATORS)} />
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                        <NumberField label="Size" value={draft.value} onChange={(value) => update({ value })} placeholder="For example: 5" step="any" />
                        <SelectField label="Unit" value={draft.unit} onChange={(unit) => update({ unit })} options={SIZE_UNITS.map((unit) => ({ value: unit, label: unit }))} />
                    </div>
                    <Hint>Uses the size of the original file (1 MB = 1024 KB).</Hint>
                </>
            );
        case "condition.resolution":
            return (
                <>
                    <SelectField autoFocus label="Operator" value={draft.operator} onChange={(operator) => update({ operator })} options={toOptions(RULE_OPTION_LABELS.RESOLUTION_OPERATORS)} />
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Width (px)" value={draft.width} onChange={(width) => update({ width })} placeholder="1920" />
                        <NumberField label="Height (px)" value={draft.height} onChange={(height) => update({ height })} placeholder="1080" />
                    </div>
                    <Hint>Portrait and landscape media both count: 1080 × 1920 matches 1920 × 1080. Media without a known resolution don&apos;t match.</Hint>
                </>
            );
        case "condition.orientation":
            return <SelectField autoFocus label="Orientation" value={draft.orientation} onChange={(orientation) => update({ orientation })} options={toOptions(RULE_OPTION_LABELS.ORIENTATIONS)} />;
        case "condition.mediaType":
            return (
                <fieldset className="grid gap-2">
                    <legend className="mb-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">Media types</legend>
                    {MEDIA_TYPE_OPTIONS.map((option) => (
                        <CheckboxOption
                            key={option.value}
                            title={option.label}
                            checked={draft.types.includes(option.value)}
                            onChange={(checked) => update({ types: checked ? [...draft.types, option.value] : draft.types.filter((item) => item !== option.value) })}
                        />
                    ))}
                </fieldset>
            );
        case "action.addTags":
        case "action.removeTags":
            return tagsField(true);
        case "action.favourite":
            return (
                <SelectField
                    autoFocus
                    label="Favourite"
                    value={draft.value ? "add" : "remove"}
                    onChange={(value) => update({ value: value === "add" })}
                    options={[{ value: "add", label: "Add to favourites" }, { value: "remove", label: "Remove from favourites" }]}
                />
            );
        case "action.addToAlbum": {
            const albums = albumsQuery.data || [];
            return (
                <>
                    <SelectField
                        autoFocus
                        label="Album"
                        value={draft.albumId ? String(draft.albumId) : ""}
                        onChange={(albumId) => update({ albumId: albumId ? Number(albumId) : null })}
                        placeholder={albumsQuery.isPending ? "Loading albums..." : "Choose an album"}
                        disabled={albumsQuery.isPending || albums.length === 0}
                        options={albums.map((album) => ({ value: String(album.id), label: album.albumname }))}
                    />
                    {albumsQuery.isError ? (
                        <button type="button" className={buttonClasses.text} onClick={() => albumsQuery.refetch()}>Could not load albums. Retry</button>
                    ) : null}
                    {!albumsQuery.isPending && !albumsQuery.isError && albums.length === 0 ? (
                        <Hint>You don&apos;t have albums yet. <Link className="font-semibold text-neutral-600 underline dark:text-neutral-300" to="/albums">Create one</Link> and come back.</Hint>
                    ) : null}
                </>
            );
        }
        default:
            return <Hint>This node has no settings.</Hint>;
    }
};

// Configuración de un nodo (como el panel de un nodo en n8n). Los cambios se aplican al workflow en edición;
// se guardan en la regla con "Save".
export const NodeConfigModal = ({ node, onApply, onDelete, onClose }) => {
    const { type, config } = node.data;
    const definition = RULE_NODE_TYPES[type];
    const category = RULE_CATEGORIES.find((item) => item.key === definition.category);
    const { metadata, tagNames, displayNames, authors, tagColorByName, tagTypeByName } = useMetadata();
    const [draft, setDraft] = useState(config);
    // Las listas del nodo (tags, nombres de media o autores) usan el estado de tags del formulario de medias,
    // con las sugerencias que correspondan a cada una.
    const form = useMediaMetadataForm({
        metadata,
        tagNames: type === "condition.name" ? displayNames : type === "condition.author" ? authors : tagNames,
        initialValues: { tags: config.tags ?? config.values },
    });

    const handleSubmit = (event) => {
        event.preventDefault();
        if ("values" in draft) onApply({ ...draft, values: form.getTagsWithPending() });
        else if ("tags" in draft) onApply({ ...draft, tags: form.getTagsWithPending() });
        else onApply(draft);
    };

    return (
        <MediaFormModal titleId="rule-node-config-title" title={definition.label} subtitle={`${category.label} node`} onClose={onClose} compact>
            <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
                <div className="grid min-h-0 content-start gap-4 overflow-y-auto p-4 sm:p-6">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{definition.description}</p>
                    <NodeConfigFields type={type} draft={draft} setDraft={setDraft} form={form} metadataProps={{ tagColorByName, tagTypeByName, getTagStyle: buildTagChipStyle }} />
                </div>
                <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:px-6">
                    <button type="button" className={`${buttonClasses.dangerGhost} sm:mr-auto`} onClick={onDelete}>
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                        Delete node
                    </button>
                    <button type="button" className={buttonClasses.secondary} onClick={onClose}>Cancel</button>
                    {/* Sin campos que enfocar, el foco entra en el diálogo por el botón principal. */}
                    <button type="submit" className={buttonClasses.primary} autoFocus={Object.keys(config).length === 0}>
                        <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                        Apply
                    </button>
                </footer>
            </form>
        </MediaFormModal>
    );
};
