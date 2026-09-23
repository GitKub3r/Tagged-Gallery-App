import { useState } from "react";
import { rankSuggestions } from "../utils/suggestionRanking";

export const uniqueNames = (items) => [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const hasTag = (tags, value) => tags.some((tag) => tag.toLowerCase() === value.toLowerCase());

// Estado y sugerencias del formulario común de nombre, autor y tags (MediaMetadataFields).
// Devuelve los valores y `fieldProps`, listos para pasar al componente.
export const useMediaMetadataForm = ({ metadata, tagNames = [], initialValues = {} }) => {
    const [displayName, setDisplayName] = useState(initialValues.displayname || "");
    const [author, setAuthor] = useState(initialValues.author || "");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState(initialValues.tags || []);
    const [activeField, setActiveField] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const displayNameSuggestions = rankSuggestions(uniqueNames((metadata?.displayNames || []).map((item) => typeof item === "string" ? item : item.displayname)), displayName).slice(0, 8);
    const authorSuggestions = rankSuggestions(uniqueNames((metadata?.authors || []).map((item) => typeof item === "string" ? item : item.author)), author).slice(0, 8);
    const tagSuggestions = rankSuggestions(tagNames.filter((item) => !hasTag(tags, item)), tagInput).slice(0, 8);
    const suggestions = { displayname: displayNameSuggestions, author: authorSuggestions, tag: tagSuggestions };

    const openField = (field) => { setActiveField(field); setActiveIndex(0); };
    const closeSuggestions = () => { setActiveField(null); setActiveIndex(0); };
    const addTag = (value) => {
        const next = String(value || "").trim();
        if (next && !hasTag(tags, next)) setTags((current) => [...current, next]);
        setTagInput("");
        closeSuggestions();
    };
    const selectSuggestion = (field, value) => {
        if (field === "displayname") setDisplayName(value);
        else if (field === "author") setAuthor(value);
        else addTag(value);
        closeSuggestions();
    };
    const handleSuggestionKeyDown = (event, field) => {
        const items = suggestions[field] || [];
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length > 0) {
            event.preventDefault();
            setActiveField(field);
            setActiveIndex((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
        } else if (event.key === "Enter" && field === "tag") {
            event.preventDefault();
            addTag(activeField === field && items.length ? items[activeIndex] : tagInput);
        } else if (event.key === "Enter" && activeField === field && items.length) {
            event.preventDefault();
            selectSuggestion(field, items[activeIndex]);
        } else if (event.key === "Escape" && activeField) {
            event.preventDefault();
            closeSuggestions();
        }
    };

    // Tags guardadas más la que el usuario haya escrito sin pulsar Enter.
    const getTagsWithPending = () => {
        const pendingTag = tagInput.trim();
        return pendingTag && !hasTag(tags, pendingTag) ? [...tags, pendingTag] : tags;
    };

    const setValues = (values) => {
        setDisplayName(values.displayname);
        setAuthor(values.author);
        setTags(values.tags);
        setTagInput("");
        closeSuggestions();
    };

    return {
        displayName,
        author,
        tags,
        getTagsWithPending,
        setValues,
        fieldProps: {
            displayNameInput: displayName,
            authorInput: author,
            tagInput,
            selectedTags: tags,
            existingTagNames: tagNames,
            activeSuggestionField: activeField,
            activeSuggestionIndex: activeIndex,
            displayNameSuggestions,
            authorSuggestions,
            tagSuggestions,
            onDisplayNameChange: (event) => { setDisplayName(event.target.value); openField("displayname"); },
            onAuthorChange: (event) => { setAuthor(event.target.value); openField("author"); },
            onTagInputChange: (event) => { setTagInput(event.target.value); openField("tag"); },
            onOpenSuggestions: openField,
            onCloseSuggestions: closeSuggestions,
            onSuggestionKeyDown: handleSuggestionKeyDown,
            onSelectDisplayName: (value) => selectSuggestion("displayname", value),
            onSelectAuthor: (value) => selectSuggestion("author", value),
            onAddTag: addTag,
            onRemoveTag: (value) => setTags((current) => current.filter((tag) => tag !== value)),
        },
    };
};
