export const Skeleton = ({ className = "", style }) => (
    <span
        className={`block animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800 motion-reduce:animate-none ${className}`}
        aria-hidden="true"
        style={style}
    />
);
