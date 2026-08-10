const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1").replace(/\/api\/v1\/?$/, "");

const initials = (name) => {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "?").toUpperCase();
};

const getAvatarUrl = (path) => path ? `${API_ORIGIN}${path}` : "";

export const UserAvatar = ({ username, avatarPath, size = "md", className = "" }) => {
    const sizes = { sm: "h-7 w-7 text-[0.65rem]", md: "h-9 w-9 text-xs", lg: "h-24 w-24 text-2xl" };
    return (
        <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-200 font-black text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 ${sizes[size]} ${className}`} aria-label={`${username || "Unknown user"} avatar`}>
            {avatarPath ? <img src={getAvatarUrl(avatarPath)} alt="" className="h-full w-full object-cover" /> : initials(username)}
        </span>
    );
};
