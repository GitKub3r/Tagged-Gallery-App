import "./Footer.css";

export const Footer = () => {
    const year = new Date().getFullYear();
    return (
        <footer className="tagged-footer">
            <span className="tagged-footer-text">&copy; {year} Tagged. All rights reserved.</span>
        </footer>
    );
};
