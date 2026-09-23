export const applyTemplate = (template, current) => ({
    displayname: template.displayname || current.displayname,
    author: template.author || current.author,
    tags: template.tags.length > 0 ? [...template.tags] : [...current.tags],
    markFavourite: template.mark_favourite === true,
});
