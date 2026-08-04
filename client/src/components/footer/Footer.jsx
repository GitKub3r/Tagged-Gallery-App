export const Footer = () => {
    const year = new Date().getFullYear();
    return (
        <footer className="text-center text-xs text-neutral-500 dark:text-neutral-500">
            <span>&copy; {year} Tagged. All rights reserved.</span>
        </footer>
    );
};
